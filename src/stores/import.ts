import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { importerApi, type ImportStatus } from '@/services/api'

export const useImportStore = defineStore('import', () => {
  const sessionId = ref<string | null>(null)
  const status = ref<ImportStatus['status'] | null>(null)
  const importResults = ref<Record<string, number>>({})
  const error = ref<string | null>(null)
  const pollTimer = ref<ReturnType<typeof setInterval> | null>(null)

  const statusTextMap: Record<string, string> = {
    waiting_for_login: 'Esperando inicio de sesión...',
    logged_in: 'Sesión iniciada',
    importing: 'Importando datos...',
    done: 'Importación completada',
    error: 'Error en la importación',
  }

  const statusText = computed(() => {
    if (!status.value) return ''
    return statusTextMap[status.value] || status.value
  })

  const isImporting = computed(() => status.value === 'importing')
  const isLoggedIn = computed(() => status.value === 'logged_in')
  const isDone = computed(() => status.value === 'done')
  const isWaitingForLogin = computed(() => status.value === 'waiting_for_login')
  const hasError = computed(() => status.value === 'error')
  const isActive = computed(() =>
    ['waiting_for_login', 'logged_in', 'importing'].includes(status.value || ''),
  )

  function reset() {
    stopPolling()
    sessionId.value = null
    status.value = null
    importResults.value = {}
    error.value = null
  }

  function stopPolling() {
    if (pollTimer.value) {
      clearInterval(pollTimer.value)
      pollTimer.value = null
    }
  }

  async function startImport() {
    reset()
    error.value = null
    try {
      const result = await importerApi.startImport()
      sessionId.value = result.sessionId
      status.value = 'waiting_for_login'
      startPolling(3000)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error desconocido'
      status.value = 'error'
    }
  }

  function startPolling(interval: number) {
    stopPolling()
    pollTimer.value = setInterval(async () => {
      await pollStatus()
    }, interval)
  }

  async function pollStatus() {
    if (!sessionId.value) return
    try {
      const result = await importerApi.getStatus(sessionId.value)
      status.value = result.status
      if (result.importResults) {
        importResults.value = result.importResults
      }
      if (result.error) {
        error.value = result.error
      }

      // When logged_in, stop polling (user decides next step)
      if (result.status === 'logged_in') {
        stopPolling()
      }

      // When done or error, stop polling
      if (result.status === 'done' || result.status === 'error') {
        stopPolling()
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error al consultar estado'
    }
  }

  async function runImport() {
    if (!sessionId.value) return
    try {
      await importerApi.runImport(sessionId.value)
      status.value = 'importing'
      startPolling(5000)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error al ejecutar importación'
      status.value = 'error'
    }
  }

  async function stopImport() {
    if (!sessionId.value) return
    try {
      await importerApi.stopImport(sessionId.value)
      stopPolling()
      status.value = 'done'
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error al detener importación'
    }
  }

  return {
    sessionId,
    status,
    importResults,
    error,
    statusText,
    isImporting,
    isLoggedIn,
    isDone,
    isWaitingForLogin,
    hasError,
    isActive,
    startImport,
    pollStatus,
    runImport,
    stopImport,
    reset,
  }
})
