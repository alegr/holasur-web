import { ref, computed, onUnmounted } from 'vue'
import { importerApi, IMPORTER_URL } from '@/services/api'

const sessionId = ref<string | null>(null)
const status = ref<'idle' | 'starting' | 'needs_login' | 'needs_2fa' | 'logged_in' | 'error'>('idle')
const error = ref<string | null>(null)
const email = ref('')
const password = ref('')
const tfaCode = ref('')
const submitting = ref(false)
let pollTimer: ReturnType<typeof setInterval> | null = null
let resolveLogin: ((sid: string) => void) | null = null
let rejectLogin: ((err: Error) => void) | null = null

const showModal = computed(() => status.value === 'needs_login' || status.value === 'needs_2fa')

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

function startPolling() {
  stopPolling()
  pollTimer = setInterval(async () => {
    if (!sessionId.value) return
    try {
      const result = await importerApi.getStatus(sessionId.value)
      if (result.status === 'needs_login' && status.value !== 'needs_login') {
        status.value = 'needs_login'
        submitting.value = false
      } else if (result.status === 'needs_2fa' && status.value !== 'needs_2fa') {
        status.value = 'needs_2fa'
        submitting.value = false
      } else if (result.status === 'logged_in' || result.status === 'done' || result.status === 'importing') {
        stopPolling()
        status.value = 'logged_in'
        if (resolveLogin) { resolveLogin(sessionId.value!); resolveLogin = null }
      } else if (result.status === 'error') {
        stopPolling()
        status.value = 'error'
        error.value = result.error || 'Error'
        if (rejectLogin) { rejectLogin(new Error(error.value!)); rejectLogin = null }
      }
    } catch { /* transient */ }
  }, 3000)
}

/**
 * Get a logged-in Avantio session. Shows the login modal if needed.
 * Returns a promise that resolves with the sessionId once logged in.
 */
async function getSession(): Promise<string> {
  error.value = null

  // Check for existing active session
  try {
    const active = await importerApi.getActiveSession() as any
    if (active.active && active.sessionId) {
      sessionId.value = active.sessionId
      if (['logged_in', 'importing', 'done'].includes(active.status)) {
        status.value = 'logged_in'
        return active.sessionId
      }
      // Session exists but needs login — fall through to polling
    }
  } catch { /* no active session */ }

  // Start new session
  status.value = 'starting'
  const result = await importerApi.startImport()
  sessionId.value = result.sessionId

  // Check if already logged in (saved session)
  try {
    const st = await importerApi.getStatus(result.sessionId)
    if (st.status === 'logged_in' || st.status === 'done' || st.status === 'importing') {
      status.value = 'logged_in'
      return result.sessionId
    }
  } catch { /* continue to polling */ }

  // Need login — start polling and return a promise that resolves when logged in
  startPolling()
  return new Promise<string>((resolve, reject) => {
    resolveLogin = resolve
    rejectLogin = reject
  })
}

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
    // If polling already detected login while we were waiting, skip the response
    if (status.value === 'logged_in') return
    if (data.status === 'logged_in') {
      stopPolling()
      status.value = 'logged_in'
      if (resolveLogin) { resolveLogin(sessionId.value!); resolveLogin = null }
    } else if (data.status === 'needs_2fa') {
      status.value = 'needs_2fa'
    } else {
      status.value = 'needs_login'
      error.value = data.error || 'Usuario o contraseña incorrectos'
    }
  } catch {
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
      stopPolling()
      status.value = 'logged_in'
      if (resolveLogin) { resolveLogin(sessionId.value!); resolveLogin = null }
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

function cancel() {
  stopPolling()
  if (sessionId.value) importerApi.stopImport(sessionId.value).catch(() => {})
  status.value = 'idle'
  sessionId.value = null
  error.value = null
  if (rejectLogin) { rejectLogin(new Error('Cancelled')); rejectLogin = null }
}

export function useAvantioSession() {
  // Don't stop polling on unmount — the session is global and the login modal is in App.vue

  return {
    sessionId,
    status,
    error,
    email,
    password,
    tfaCode,
    submitting,
    showModal,
    getSession,
    submitCredentials,
    submit2FA,
    cancel,
  }
}
