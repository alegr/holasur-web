<script setup lang="ts">
import { ref, onUnmounted, computed } from 'vue'
import { importerApi, importerAvailable } from '@/services/api'
import { useAvantioSession } from '@/composables/useAvantioSession'
import { hasActiveJob } from '@/composables/useImportJobs'

const props = defineProps<{
  entity: 'properties' | 'bookings' | 'payments_received' | 'payments_made' | 'payments_pending' | 'payments_outstanding' | 'owners' | 'invoices' | 'service_catalog'
}>()

const emit = defineEmits<{ imported: [] }>()

const entityLabels: Record<string, string> = {
  properties: 'propiedades',
  bookings: 'reservas',
  payments_received: 'cobros recibidos',
  payments_made: 'pagos realizados',
  payments_pending: 'pagos pendientes',
  payments_outstanding: 'pagos a cobrar',
  owners: 'propietarios',
  invoices: 'facturas',
  service_catalog: 'catálogo de servicios',
}

const entityLabel = computed(() => entityLabels[props.entity] || props.entity)

const avantio = useAvantioSession()

type Status = 'idle' | 'starting' | 'importing' | 'done' | 'error'

const status = ref<Status>('idle')
const sessionId = ref<string | null>(null)
const error = ref<string | null>(null)
const importedCount = ref(0)
const progressText = ref('')
let pollTimer: ReturnType<typeof setInterval> | null = null

onUnmounted(() => { if (pollTimer) clearInterval(pollTimer) })

async function startImport() {
  error.value = null
  status.value = 'starting'

  try {
    // Create job immediately — shows in tracker before login
    await importerApi.createJob('bulk', props.entity)
    status.value = 'importing'

    // Ensure session is logged in — processQueue picks up the job
    const sid = await avantio.getSession()
    sessionId.value = sid
    startPolling()
  } catch (e) {
    if (e instanceof Error && e.message === 'Cancelled') {
      status.value = 'idle'
    } else {
      const msg = e instanceof Error ? e.message : 'Error al importar'
      error.value = msg.includes('NetworkError') || msg.includes('fetch') ? 'No se pudo conectar con el importador. Intente nuevamente.' : msg
      status.value = 'error'
    }
  }
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = setInterval(async () => {
    if (!sessionId.value) return
    try {
      const result = await importerApi.getStatus(sessionId.value)
      if (result.status === 'importing') {
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
      <button class="btn btn--primary btn--small" :disabled="hasActiveJob(props.entity)" @click="startImport">
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
  </div>
</template>

<style scoped>
.iw { margin-bottom: 16px; }

.iw__row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: var(--radius-md);
  font-size: 0.9rem;
}

.iw__row--info {
  background: #e8f0ef;
  color: var(--color-primary);
}

.iw__row--success {
  background: #e4f3ed;
  color: var(--color-success);
}

.iw__row--error {
  background: #fce8e8;
  color: var(--color-error);
}

.iw__cancel {
  margin-left: auto;
  font-size: 0.8rem;
  cursor: pointer;
  text-decoration: underline;
}
</style>
