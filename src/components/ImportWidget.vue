<script setup lang="ts">
import { ref, onUnmounted, computed } from 'vue'
import { importerApi, importerAvailable, IMPORTER_URL } from '@/services/api'

const props = defineProps<{
  entity: 'properties' | 'bookings' | 'payments_received' | 'payments_made' | 'payments_pending' | 'payments_outstanding' | 'owners' | 'invoices'
}>()

const emit = defineEmits<{ imported: [] }>()

const entityLabels: Record<string, string> = {
  properties: 'propiedades',
  bookings: 'reservas',
  payments_received: 'cobros recibidos',
  payments_made: 'pagos realizados',
  payments_pending: 'pagos pendientes',
  payments_outstanding: 'cuentas por cobrar',
  owners: 'propietarios',
  invoices: 'facturas',
}
const entityLabel = computed(() => entityLabels[props.entity] || props.entity)

type Status = 'idle' | 'starting' | 'needs_login' | 'needs_2fa' | 'logging_in' | 'importing' | 'done' | 'error'

const status = ref<Status>('idle')
const sessionId = ref<string | null>(null)
const error = ref<string | null>(null)
const importedCount = ref(0)
const progressText = ref('')
const email = ref('')
const password = ref('')
const tfaCode = ref('')
let pollTimer: ReturnType<typeof setInterval> | null = null

const showModal = computed(() => status.value === 'needs_login' || status.value === 'needs_2fa')

onUnmounted(() => { if (pollTimer) clearInterval(pollTimer) })

async function startImport() {
  error.value = null

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
      console.log('[ImportWidget] poll status:', result.status, 'ui:', status.value)

      if (result.status === 'needs_login' && status.value !== 'needs_login') {
        status.value = 'needs_login'
        submitting.value = false
      } else if (result.status === 'needs_2fa' && status.value !== 'needs_2fa') {
        status.value = 'needs_2fa'
        submitting.value = false
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
    } catch (e) { console.warn('[ImportWidget] poll error:', e) }
  }, 3000)
}

const submitting = ref(false)

async function submitCredentials() {
  if (!sessionId.value || !email.value || !password.value) return
  submitting.value = true
  error.value = null
  try {
    const res = await fetch(`${IMPORTER_URL}/import/${sessionId.value}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value, password: password.value }),
    })
    const data = await res.json()
    if (data.status === 'logged_in') {
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
      status.value = 'importing'
      await runEntityImport()
    } else if (data.status === 'needs_2fa') {
      status.value = 'needs_2fa'
    } else {
      status.value = 'needs_login'
      error.value = data.error || 'Usuario o contraseña incorrectos'
    }
  } catch (e) {
    error.value = 'Error de conexión al enviar credenciales'
    status.value = 'needs_login'
  } finally {
    submitting.value = false
  }
}

async function submit2FA() {
  if (!sessionId.value || !tfaCode.value) return
  submitting.value = true
  error.value = null
  try {
    const res = await fetch(`${IMPORTER_URL}/import/${sessionId.value}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: tfaCode.value }),
    })
    const data = await res.json()
    tfaCode.value = ''
    if (data.status === 'logged_in') {
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
      status.value = 'importing'
      await runEntityImport()
    } else {
      status.value = 'needs_2fa'
      error.value = data.error || 'Código incorrecto, intentá de nuevo'
    }
  } catch {
    error.value = 'Error de conexión al verificar código'
    status.value = 'needs_2fa'
  } finally {
    submitting.value = false
  }
}

async function runEntityImport() {
  if (!sessionId.value) return
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

    <!-- Login / 2FA Modal (Avantio-styled) -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showModal" class="av-backdrop" @click.self="cancel">
          <div class="av-card">
            <!-- Avantio logo -->
            <div class="av-logo">
              <img src="/avantio-logo.svg" alt="Avantio" />
            </div>

            <h3 class="av-heading">{{ status === 'needs_2fa' ? 'VERIFICACION' : 'LOGIN' }}</h3>

            <p v-if="error" class="av-error">{{ error }}</p>

            <!-- Login form -->
            <template v-if="status === 'needs_login'">
              <div class="av-fields">
                <input v-model="email" type="email" class="av-input" placeholder="User's email" :disabled="submitting" @keyup.enter="submitCredentials" />
                <input v-model="password" type="password" class="av-input" placeholder="Password" :disabled="submitting" @keyup.enter="submitCredentials" />
              </div>
              <button class="av-btn" @click="submitCredentials" :disabled="submitting">
                <span v-if="submitting" class="spinner spinner--small spinner--white"></span>
                {{ submitting ? 'LOGGING IN...' : 'LOGIN' }}
              </button>
              <button class="av-cancel" @click="cancel" :disabled="submitting">Cancelar</button>
            </template>

            <!-- 2FA form -->
            <template v-else-if="status === 'needs_2fa'">
              <p class="av-desc">Ingresá el código de verificación de tu app de autenticación.</p>
              <div class="av-fields">
                <input v-model="tfaCode" type="text" class="av-input" placeholder="Verification code" inputmode="numeric" autocomplete="one-time-code" :disabled="submitting" @keyup.enter="submit2FA" />
              </div>
              <button class="av-btn" @click="submit2FA" :disabled="submitting">
                <span v-if="submitting" class="spinner spinner--small spinner--white"></span>
                {{ submitting ? 'VERIFYING...' : 'VERIFY' }}
              </button>
              <button class="av-cancel" @click="cancel" :disabled="submitting">Cancelar</button>
            </template>
          </div>
        </div>
      </Transition>
    </Teleport>
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
.iw__cancel { color: var(--color-text-secondary); font-size: 0.85rem; cursor: pointer; }
.iw__cancel:hover { color: var(--color-error); }
.spinner--small { width: 18px; height: 18px; border-width: 2px; }

/* Modal — Avantio login replica */
.av-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.av-card {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-width: 420px;
  margin: 16px;
  padding: 40px 48px 32px;
  text-align: center;
}
.av-logo { margin-bottom: 16px; }
.av-logo img { height: 48px; width: auto; }
.av-heading {
  margin: 0 0 24px;
  font-size: 1rem;
  font-weight: 400;
  color: #999;
  letter-spacing: 2px;
}
.av-desc {
  font-size: 0.88rem;
  color: #888;
  margin: -8px 0 20px;
  line-height: 1.5;
}
.av-error {
  color: #c0392b;
  font-size: 0.85rem;
  margin: 0 0 16px;
  padding: 10px 14px;
  background: #fdf0ef;
  border-radius: 4px;
  text-align: left;
}
.av-fields {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 28px;
  text-align: left;
}
.av-input {
  padding: 14px 16px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.95rem;
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.2s;
  color: #333;
  background: #fff;
}
.av-input::placeholder { color: #bbb; font-weight: 300; }
.av-input:focus {
  outline: none;
  border-color: #5bbad5;
  box-shadow: 0 0 0 2px rgba(91, 186, 213, 0.25);
}
.av-input:disabled { opacity: 0.5; cursor: not-allowed; background: #f9f9f9; }
.av-btn {
  width: 100%;
  padding: 14px;
  background: #d4553a;
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 1.5px;
  cursor: pointer;
  transition: background 0.15s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.av-btn:hover:not(:disabled) { background: #c04a32; }
.av-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.av-cancel {
  width: 100%;
  padding: 10px;
  background: none;
  color: #aaa;
  border: none;
  font-size: 0.85rem;
  cursor: pointer;
  margin-top: 12px;
}
.av-cancel:hover { color: #c0392b; }
.av-cancel:disabled { opacity: 0.5; cursor: not-allowed; }
.spinner--white { border-color: rgba(255,255,255,0.3); border-top-color: #fff; }

/* Transitions */
.modal-enter-active { transition: opacity 0.2s ease; }
.modal-enter-active .iw-modal { transition: transform 0.2s ease, opacity 0.2s ease; }
.modal-leave-active { transition: opacity 0.15s ease; }
.modal-leave-active .iw-modal { transition: transform 0.15s ease, opacity 0.15s ease; }
.modal-enter-from { opacity: 0; }
.modal-enter-from .iw-modal { transform: scale(0.95) translateY(10px); opacity: 0; }
.modal-leave-to { opacity: 0; }
.modal-leave-to .iw-modal { transform: scale(0.95) translateY(10px); opacity: 0; }
</style>
