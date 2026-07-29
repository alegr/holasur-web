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
const email = ref('')
const password = ref('')
const tfaCode = ref('')
let pollTimer: ReturnType<typeof setInterval> | null = null

const showModal = computed(() => status.value === 'needs_login' || status.value === 'needs_2fa' || status.value === 'logging_in')

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

      if (result.status === 'needs_login' && status.value !== 'needs_login' && status.value !== 'logging_in') {
        status.value = 'needs_login'
      } else if (result.status === 'needs_2fa' && status.value !== 'needs_2fa') {
        status.value = 'needs_2fa'
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

async function submitCredentials() {
  if (!sessionId.value || !email.value || !password.value) return
  status.value = 'logging_in'
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
      error.value = 'Credenciales incorrectas'
    }
  } catch (e) {
    error.value = 'Error al enviar credenciales'
    status.value = 'needs_login'
  }
}

async function submit2FA() {
  if (!sessionId.value || !tfaCode.value) return
  status.value = 'logging_in'
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
    }
  } catch { error.value = 'Error al verificar código' }
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

    <!-- Login / 2FA Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showModal" class="iw-modal-backdrop" @click.self="cancel">
          <div class="iw-modal">
            <!-- Header -->
            <div class="iw-modal__header">
              <h3 class="iw-modal__title">
                {{ status === 'needs_2fa' ? 'Verificación en dos pasos' : 'Iniciar sesión en Avantio' }}
              </h3>
              <button class="iw-modal__close" @click="cancel">&times;</button>
            </div>

            <!-- Login form -->
            <div v-if="status === 'needs_login' || (status === 'logging_in' && !tfaCode)" class="iw-modal__body">
              <p class="iw-modal__desc">Ingresá tus credenciales de Avantio para continuar con la importación.</p>
              <p v-if="error" class="iw-modal__error">{{ error }}</p>
              <div class="iw-modal__fields">
                <label class="iw-modal__label">
                  Email
                  <input v-model="email" type="email" class="iw-modal__input" placeholder="tu@email.com" :disabled="status === 'logging_in'" @keyup.enter="submitCredentials" />
                </label>
                <label class="iw-modal__label">
                  Contraseña
                  <input v-model="password" type="password" class="iw-modal__input" placeholder="Contraseña" :disabled="status === 'logging_in'" @keyup.enter="submitCredentials" />
                </label>
              </div>
              <div class="iw-modal__actions">
                <button class="btn btn--secondary" @click="cancel" :disabled="status === 'logging_in'">Cancelar</button>
                <button class="btn btn--primary" @click="submitCredentials" :disabled="status === 'logging_in'">
                  <span v-if="status === 'logging_in'" class="spinner spinner--small spinner--white"></span>
                  {{ status === 'logging_in' ? 'Ingresando...' : 'Iniciar sesión' }}
                </button>
              </div>
            </div>

            <!-- 2FA form -->
            <div v-else-if="status === 'needs_2fa' || status === 'logging_in'" class="iw-modal__body">
              <p class="iw-modal__desc">Ingresá el código de verificación que recibiste.</p>
              <p v-if="error" class="iw-modal__error">{{ error }}</p>
              <div class="iw-modal__fields">
                <label class="iw-modal__label">
                  Código de verificación
                  <input v-model="tfaCode" type="text" class="iw-modal__input" placeholder="123456" inputmode="numeric" autocomplete="one-time-code" :disabled="status === 'logging_in'" @keyup.enter="submit2FA" />
                </label>
              </div>
              <div class="iw-modal__actions">
                <button class="btn btn--secondary" @click="cancel" :disabled="status === 'logging_in'">Cancelar</button>
                <button class="btn btn--primary" @click="submit2FA" :disabled="status === 'logging_in'">
                  <span v-if="status === 'logging_in'" class="spinner spinner--small spinner--white"></span>
                  {{ status === 'logging_in' ? 'Verificando...' : 'Verificar' }}
                </button>
              </div>
            </div>
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

/* Modal */
.iw-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.iw-modal {
  background: var(--color-surface, #fff);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
  width: 100%;
  max-width: 400px;
  margin: 16px;
  overflow: hidden;
}
.iw-modal__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px 0;
}
.iw-modal__title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text, #1a1a1a);
}
.iw-modal__close {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--color-text-secondary, #888);
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}
.iw-modal__close:hover { color: var(--color-error, #e53935); }
.iw-modal__body { padding: 16px 24px 24px; }
.iw-modal__desc {
  font-size: 0.88rem;
  color: var(--color-text-secondary, #666);
  margin: 0 0 16px;
}
.iw-modal__error {
  color: var(--color-error, #e53935);
  font-size: 0.85rem;
  margin: 0 0 12px;
  padding: 8px 12px;
  background: #fdecea;
  border-radius: 6px;
}
.iw-modal__fields {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 20px;
}
.iw-modal__label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text, #1a1a1a);
}
.iw-modal__input {
  padding: 10px 12px;
  border: 1px solid var(--color-border, #ddd);
  border-radius: 8px;
  font-size: 0.9rem;
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.15s;
}
.iw-modal__input:focus {
  outline: none;
  border-color: var(--color-primary, #16463f);
  box-shadow: 0 0 0 3px rgba(22, 70, 63, 0.1);
}
.iw-modal__input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.iw-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
.iw-modal__actions .btn { min-width: 120px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
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
