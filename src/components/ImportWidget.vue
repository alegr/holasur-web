<script setup lang="ts">
import { ref, onUnmounted, computed } from 'vue'
import { importerApi, importerAvailable, IMPORTER_URL } from '@/services/api'

const props = defineProps<{
  entity: 'properties' | 'bookings' | 'payments_received' | 'payments_made' | 'payments_pending' | 'payments_outstanding'
}>()

const emit = defineEmits<{ imported: [] }>()

const entityLabels: Record<string, string> = {
  properties: 'propiedades',
  bookings: 'reservas',
  payments_received: 'cobros recibidos',
  payments_made: 'pagos realizados',
  payments_pending: 'pagos pendientes',
  payments_outstanding: 'cuentas por cobrar',
}
const entityLabel = computed(() => entityLabels[props.entity] || props.entity)

type Status = 'idle' | 'starting' | 'needs_login' | 'needs_2fa' | 'logging_in' | 'importing' | 'done' | 'error'

const status = ref<Status>('idle')
const sessionId = ref<string | null>(null)
const error = ref<string | null>(null)
const importedCount = ref(0)
const progressText = ref('')
const screenshot = ref<string | null>(null)
const email = ref('')
const password = ref('')
const tfaCode = ref('')
let pollTimer: ReturnType<typeof setInterval> | null = null

onUnmounted(() => { if (pollTimer) clearInterval(pollTimer) })

async function startImport() {
  error.value = null
  screenshot.value = null

  // Check for existing active session
  try {
    const res = await fetch(`${IMPORTER_URL}/import/active`)
    const active = await res.json()
    if (active.active && active.sessionId) {
      sessionId.value = active.sessionId
      status.value = 'importing'
      await runEntityImport()
      return
    }
  } catch { /* no active session */ }

  // Start new session
  status.value = 'starting'
  try {
    const result = await importerApi.startImport()
    sessionId.value = result.sessionId
    startPolling()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al conectar con el importador'
    status.value = 'error'
  }
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = setInterval(async () => {
    if (!sessionId.value) return
    try {
      const result = await importerApi.getStatus(sessionId.value)

      if (result.status === 'needs_login' && status.value !== 'needs_login' && status.value !== 'logging_in') {
        status.value = 'needs_login'
        await fetchScreenshot()
      } else if (result.status === 'needs_2fa' && status.value !== 'needs_2fa') {
        status.value = 'needs_2fa'
        await fetchScreenshot()
      } else if (result.status === 'logged_in') {
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
        status.value = 'importing'
        await runEntityImport()
      } else if (result.status === 'importing') {
        status.value = 'importing'
        const total = Object.values(result.importResults || {}).reduce((a, b) => a + b, 0)
        if (total > 0) progressText.value = `${total} registros...`
      } else if (result.status === 'done') {
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
        const total = Object.values(result.importResults || {}).reduce((a, b) => a + b, 0)
        importedCount.value = total
        status.value = 'done'
        emit('imported')
      } else if (result.status === 'error') {
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
        error.value = result.error || 'Error'
        status.value = 'error'
      }
    } catch { /* transient */ }
  }, 3000)
}

async function fetchScreenshot() {
  if (!sessionId.value) return
  try {
    const res = await fetch(`${IMPORTER_URL}/import/${sessionId.value}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const data = await res.json()
    if (data.screenshot) screenshot.value = data.screenshot
  } catch { /* ignore */ }
}

async function submitCredentials() {
  if (!sessionId.value || !email.value || !password.value) return
  status.value = 'logging_in'
  try {
    const res = await fetch(`${IMPORTER_URL}/import/${sessionId.value}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value, password: password.value }),
    })
    const data = await res.json()
    if (data.screenshot) screenshot.value = data.screenshot
    if (data.status === 'logged_in') {
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
      status.value = 'importing'
      await runEntityImport()
    } else if (data.status === 'needs_2fa') {
      status.value = 'needs_2fa'
    } else {
      status.value = 'needs_login'
      error.value = 'Credenciales incorrectas'
    }
  } catch (e) {
    error.value = 'Error al enviar credenciales'
    status.value = 'needs_login'
  }
}

async function submit2FA() {
  if (!sessionId.value || !tfaCode.value) return
  try {
    const res = await fetch(`${IMPORTER_URL}/import/${sessionId.value}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: tfaCode.value }),
    })
    const data = await res.json()
    tfaCode.value = ''
    if (data.screenshot) screenshot.value = data.screenshot
    if (data.status === 'logged_in') {
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
      status.value = 'importing'
      await runEntityImport()
    }
  } catch { error.value = 'Error al verificar código' }
}

async function runEntityImport() {
  if (!sessionId.value) return
  screenshot.value = null
  try {
    await importerApi.importEntity(sessionId.value, props.entity)
    startPolling()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al importar'
    status.value = 'error'
  }
}

function reset() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  sessionId.value = null
  status.value = 'idle'
  error.value = null
  importedCount.value = 0
  progressText.value = ''
  screenshot.value = null
}

function cancel() {
  if (sessionId.value) importerApi.stopImport(sessionId.value).catch(() => {})
  reset()
}
</script>

<template>
  <div v-if="importerAvailable" class="iw">
    <!-- Idle -->
    <div v-if="status === 'idle'" class="iw__row">
      <button class="btn btn--primary btn--small" @click="startImport">
        &#8635; Importar desde Avantio
      </button>
    </div>

    <!-- Starting -->
    <div v-else-if="status === 'starting'" class="iw__row iw__row--info">
      <span class="spinner spinner--small"></span>
      <span>Conectando con Avantio...</span>
    </div>

    <!-- Login needed — show screenshot + credentials -->
    <div v-else-if="status === 'needs_login'" class="iw__login-card">
      <div class="iw__login-header">
        <span>Iniciar sesión en Avantio</span>
        <a class="iw__cancel" @click.prevent="cancel">Cancelar</a>
      </div>
      <img v-if="screenshot" :src="screenshot" class="iw__screenshot" alt="Avantio login" />
      <p v-if="error" class="iw__login-error">{{ error }}</p>
      <div class="iw__login-fields">
        <input v-model="email" type="email" class="iw__input" placeholder="Email de Avantio" @keyup.enter="submitCredentials" />
        <input v-model="password" type="password" class="iw__input" placeholder="Contraseña" @keyup.enter="submitCredentials" />
        <button class="btn btn--primary" @click="submitCredentials">Iniciar sesión</button>
      </div>
    </div>

    <!-- Logging in -->
    <div v-else-if="status === 'logging_in'" class="iw__row iw__row--info">
      <span class="spinner spinner--small"></span>
      <span>Iniciando sesión...</span>
    </div>

    <!-- 2FA needed -->
    <div v-else-if="status === 'needs_2fa'" class="iw__login-card">
      <div class="iw__login-header">
        <span>Verificación en dos pasos</span>
        <a class="iw__cancel" @click.prevent="cancel">Cancelar</a>
      </div>
      <img v-if="screenshot" :src="screenshot" class="iw__screenshot" alt="2FA" />
      <div class="iw__login-fields">
        <input v-model="tfaCode" type="text" class="iw__input" placeholder="Código de verificación" @keyup.enter="submit2FA" />
        <button class="btn btn--primary" @click="submit2FA">Verificar</button>
      </div>
    </div>

    <!-- Importing -->
    <div v-else-if="status === 'importing'" class="iw__row iw__row--info">
      <span class="spinner spinner--small"></span>
      <span>Importando {{ entityLabel }}... {{ progressText }}</span>
      <a class="iw__cancel" @click.prevent="cancel">Cancelar</a>
    </div>

    <!-- Done -->
    <div v-else-if="status === 'done'" class="iw__row iw__row--success">
      <span>&#10003;</span>
      <span>Importación completada: {{ importedCount }} registros</span>
      <a class="iw__cancel" @click.prevent="reset">Cerrar</a>
    </div>

    <!-- Error -->
    <div v-else-if="status === 'error'" class="iw__row iw__row--error">
      <span>&#10007; {{ error }}</span>
      <button class="btn btn--primary btn--small" @click="reset">Reintentar</button>
    </div>
  </div>
</template>

<style scoped>
.iw { margin-bottom: 16px; }
.iw__row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
  font-size: 0.9rem;
}
.iw__row--info { background: var(--color-primary-lighter); border-left: 3px solid var(--color-primary); }
.iw__row--success { background: #e8f8f0; border-left: 3px solid var(--color-success); }
.iw__row--error { background: #fdecea; border-left: 3px solid var(--color-error); }

.iw__login-card {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  padding: 20px;
  max-width: 420px;
}
.iw__login-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 500;
  margin-bottom: 12px;
}
.iw__screenshot {
  width: 100%;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  margin-bottom: 12px;
}
.iw__login-fields {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.iw__login-error {
  color: var(--color-error);
  font-size: 0.85rem;
  margin-bottom: 8px;
}
.iw__input {
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 0.9rem;
  width: 100%;
}
.iw__input:focus { outline: none; border-color: var(--color-primary); }
.iw__cancel { color: var(--color-text-secondary); font-size: 0.85rem; cursor: pointer; }
.iw__cancel:hover { color: var(--color-error); }
.spinner--small { width: 18px; height: 18px; border-width: 2px; }
</style>
