<script setup lang="ts">
import { ref, onUnmounted, computed } from 'vue'
import { importerApi } from '@/services/api'

const props = defineProps<{
  entity: 'properties' | 'bookings' | 'payments_received' | 'payments_made' | 'payments_pending' | 'payments_outstanding'
}>()

const emit = defineEmits<{
  imported: []
}>()

const entityLabels: Record<string, string> = {
  properties: 'propiedades',
  bookings: 'reservas',
  payments_received: 'cobros recibidos',
  payments_made: 'pagos realizados',
  payments_pending: 'pagos pendientes',
  payments_outstanding: 'cuentas por cobrar',
}

const entityLabel = computed(() => entityLabels[props.entity] || props.entity)

type WidgetStatus = 'idle' | 'starting' | 'waiting_for_login' | 'logged_in' | 'importing' | 'done' | 'error'

const status = ref<WidgetStatus>('idle')
const sessionId = ref<string | null>(null)
const error = ref<string | null>(null)
const importedCount = ref<number>(0)
const progressText = ref<string>('')
const pollTimer = ref<ReturnType<typeof setInterval> | null>(null)
const autoCloseTimer = ref<ReturnType<typeof setTimeout> | null>(null)

function stopPolling() {
  if (pollTimer.value) {
    clearInterval(pollTimer.value)
    pollTimer.value = null
  }
}

function clearAutoClose() {
  if (autoCloseTimer.value) {
    clearTimeout(autoCloseTimer.value)
    autoCloseTimer.value = null
  }
}

onUnmounted(() => {
  stopPolling()
  clearAutoClose()
})

async function startImport() {
  status.value = 'starting'
  error.value = null
  try {
    // Check for an existing active session first (reuse if logged in)
    const activeRes = await fetch('http://localhost:3100/import/active')
    const active = await activeRes.json()
    if (active.active && active.sessionId) {
      sessionId.value = active.sessionId
      status.value = 'importing'
      await runEntityImport()
      return
    }

    // No active session — start a new one
    const result = await importerApi.startImport()
    sessionId.value = result.sessionId
    status.value = 'waiting_for_login'
    startPolling()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al iniciar importación'
    status.value = 'error'
  }
}

function startPolling() {
  stopPolling()
  pollTimer.value = setInterval(async () => {
    if (!sessionId.value) return
    try {
      const result = await importerApi.getStatus(sessionId.value)
      if (result.status === 'logged_in' && status.value === 'waiting_for_login') {
        stopPolling()
        status.value = 'importing'
        await runEntityImport()
      } else if (result.status === 'importing') {
        const results = result.importResults || {}
        const total = Object.values(results).reduce((a, b) => a + b, 0)
        if (total > 0) progressText.value = `${total} registros encontrados...`
      } else if (result.status === 'done') {
        stopPolling()
        const results = result.importResults || {}
        const total = Object.values(results).reduce((a, b) => a + b, 0)
        importedCount.value = total
        status.value = 'done'
        emit('imported')
        // Close browser window
        setTimeout(async () => {
          if (sessionId.value) {
            try { await importerApi.stopImport(sessionId.value) } catch { /* ignore */ }
          }
        }, 2000)
      } else if (result.status === 'error') {
        stopPolling()
        error.value = result.error || 'Error durante la importación'
        status.value = 'error'
      }
    } catch (e) {
      // Don't stop polling on transient errors
    }
  }, 3000)
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

async function stopSession() {
  if (sessionId.value) {
    try {
      await importerApi.stopImport(sessionId.value)
    } catch {
      // Ignore stop errors
    }
  }
  resetWidget()
}

function resetWidget() {
  stopPolling()
  clearAutoClose()
  sessionId.value = null
  status.value = 'idle'
  error.value = null
  importedCount.value = 0
}

async function cancel() {
  stopPolling()
  clearAutoClose()
  if (sessionId.value) {
    try {
      await importerApi.stopImport(sessionId.value)
    } catch {
      // Ignore
    }
  }
  resetWidget()
}

function retry() {
  resetWidget()
  startImport()
}
</script>

<template>
  <div class="import-widget">
    <!-- Idle -->
    <div v-if="status === 'idle'" class="import-widget__row">
      <button class="btn btn--primary btn--small" @click="startImport">
        <span class="import-widget__icon">&#8635;</span>
        Importar desde Avantio
      </button>
    </div>

    <!-- Starting -->
    <div v-else-if="status === 'starting'" class="import-widget__row import-widget__row--info">
      <span class="spinner spinner--small"></span>
      <span>Iniciando sesión de importación...</span>
    </div>

    <!-- Waiting for login -->
    <div v-else-if="status === 'waiting_for_login'" class="import-widget__row import-widget__row--info">
      <span class="spinner spinner--small"></span>
      <span>Abriendo Avantio... Inicia sesión en la ventana del navegador</span>
      <a class="import-widget__cancel" @click.prevent="cancel">Cancelar</a>
    </div>

    <!-- Importing -->
    <div v-else-if="status === 'importing'" class="import-widget__row import-widget__row--info">
      <span class="spinner spinner--small"></span>
      <span>Importando {{ entityLabel }}... {{ progressText }}</span>
      <a class="import-widget__cancel" @click.prevent="cancel">Cancelar</a>
    </div>

    <!-- Done -->
    <div v-else-if="status === 'done'" class="import-widget__row import-widget__row--success">
      <span class="import-widget__check">&#10003;</span>
      <span>Importación completada: {{ importedCount }} registros</span>
    </div>

    <!-- Error -->
    <div v-else-if="status === 'error'" class="import-widget__row import-widget__row--error">
      <span class="import-widget__cross">&#10007;</span>
      <span>{{ error }}</span>
      <button class="btn btn--primary btn--small" @click="retry">Reintentar</button>
      <a class="import-widget__cancel" @click.prevent="resetWidget">Cerrar</a>
    </div>
  </div>
</template>

<style scoped>
.import-widget {
  margin-bottom: 16px;
}

.import-widget__row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
  font-size: 0.9rem;
}

.import-widget__row--info {
  background: #ebf5fb;
  border-left: 3px solid var(--color-info);
}

.import-widget__row--success {
  background: #e8f8f0;
  border-left: 3px solid var(--color-success);
}

.import-widget__row--error {
  background: #fdecea;
  border-left: 3px solid var(--color-error);
}

.import-widget__icon {
  font-size: 1.1rem;
}

.import-widget__check {
  color: var(--color-success);
  font-weight: 700;
  font-size: 1.1rem;
}

.import-widget__cross {
  color: var(--color-error);
  font-weight: 700;
  font-size: 1.1rem;
}

.import-widget__cancel {
  margin-left: auto;
  color: var(--color-text-secondary);
  font-size: 0.85rem;
  cursor: pointer;
}

.import-widget__cancel:hover {
  color: var(--color-error);
}

.btn--small {
  padding: 6px 16px;
  font-size: 0.85rem;
}

.spinner--small {
  width: 18px;
  height: 18px;
  border-width: 2px;
}
</style>
