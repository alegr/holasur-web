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

type Status = 'idle' | 'starting' | 'waiting_for_login' | 'importing' | 'done' | 'error'

const status = ref<Status>('idle')
const sessionId = ref<string | null>(null)
const error = ref<string | null>(null)
const importedCount = ref(0)
const progressText = ref('')
let pollTimer: ReturnType<typeof setInterval> | null = null

onUnmounted(() => { if (pollTimer) clearInterval(pollTimer) })

async function startImport() {
  error.value = null

  // Check for existing active session (recycle)
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

  // Start new session — opens browser window for login
  status.value = 'starting'
  try {
    const result = await importerApi.startImport()
    sessionId.value = result.sessionId
    status.value = 'waiting_for_login'
    startPolling()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al iniciar'
    status.value = 'error'
  }
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = setInterval(async () => {
    if (!sessionId.value) return
    try {
      const result = await importerApi.getStatus(sessionId.value)

      if (result.status === 'logged_in' && status.value === 'waiting_for_login') {
        // Logged in — start import automatically
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
        error.value = result.error || 'Error durante la importación'
        status.value = 'error'
      }
    } catch { /* transient */ }
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

function reset() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  sessionId.value = null
  status.value = 'idle'
  error.value = null
  importedCount.value = 0
  progressText.value = ''
}

function cancel() {
  if (sessionId.value) {
    importerApi.stopImport(sessionId.value).catch(() => {})
  }
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
      <span>Abriendo Avantio...</span>
    </div>

    <!-- Waiting for login -->
    <div v-else-if="status === 'waiting_for_login'" class="iw__row iw__row--info">
      <span class="spinner spinner--small"></span>
      <span>Iniciá sesión en la ventana de Avantio</span>
      <a class="iw__cancel" @click.prevent="cancel">Cancelar</a>
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
.iw__cancel { margin-left: auto; color: var(--color-text-secondary); font-size: 0.85rem; cursor: pointer; }
.iw__cancel:hover { color: var(--color-error); }
.spinner--small { width: 18px; height: 18px; border-width: 2px; }
</style>
