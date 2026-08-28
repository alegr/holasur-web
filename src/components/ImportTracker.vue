<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { importerApi, type ImportJob } from '@/services/api'
import { importJobs } from '@/composables/useImportJobs'

const jobs = importJobs
const collapsed = ref(false)
let pollTimer: ReturnType<typeof setInterval> | null = null

const entityLabels: Record<string, string> = {
  bookings: 'Reservas',
  properties: 'Propiedades',
  owners: 'Propietarios',
  customers: 'Clientes',
  tasks: 'Tareas',
  payments_received: 'Cobros recibidos',
  payments_made: 'Pagos realizados',
  payments_pending: 'Pagos pendientes',
  payments_outstanding: 'Pagos a cobrar',
  invoices: 'Facturas',
  service_catalog: 'Catalogo de servicios',
}

function jobLabel(job: ImportJob): string {
  if (job.avantioId) {
    const singular: Record<string, string> = {
      bookings: 'Reserva',
      properties: 'Propiedad',
      owners: 'Propietario',
    }
    return `${singular[job.entity] || job.entity} #${job.avantioId}`
  }
  return entityLabels[job.entity] || job.entity
}

const hasJobs = computed(() => jobs.value.length > 0)
const activeCount = computed(() => jobs.value.filter(j => ['queued', 'importing', 'waiting_for_login'].includes(j.status)).length)

const sortedJobs = computed(() => {
  return [...jobs.value].sort((a, b) => {
    const aDone = a.status === 'done' || a.status === 'error' ? 1 : 0
    const bDone = b.status === 'done' || b.status === 'error' ? 1 : 0
    if (aDone !== bDone) return aDone - bDone
    return a.createdAt - b.createdAt
  })
})

async function poll() {
  try {
    jobs.value = await importerApi.getJobs()
  } catch {
    // Importer not reachable — ignore
  }
}

async function dismissJob(jobId: string) {
  try {
    await importerApi.dismissJob(jobId)
    jobs.value = jobs.value.filter(j => j.id !== jobId)
  } catch { /* ignore */ }
}

async function cancelActiveJob() {
  try {
    const result = await importerApi.getActiveSession() as any
    if (result.active && result.sessionId) {
      await importerApi.stopImport(result.sessionId)
    }
  } catch { /* ignore */ }
}

onMounted(() => {
  poll()
  pollTimer = setInterval(poll, 3000)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<template>
  <Teleport to="body">
    <div v-if="hasJobs" class="it">
      <div class="it__header" @click="collapsed = !collapsed">
        <span class="it__title">
          Importaciones
          <span v-if="activeCount > 0" class="it__count">({{ activeCount }})</span>
        </span>
        <button class="it__toggle">
          <span class="it__caret" :class="{ 'it__caret--up': !collapsed }">&#9662;</span>
        </button>
      </div>
      <div v-if="!collapsed" class="it__jobs">
        <div v-for="job in sortedJobs" :key="job.id" class="it__job" :class="{ 'it__job--done': job.status === 'done', 'it__job--error': job.status === 'error' }">
          <div class="it__job-row">
            <div class="it__job-icon">
              <span v-if="job.status === 'waiting_for_login'" class="it__queued">&#128274;</span>
              <span v-else-if="job.status === 'queued'" class="it__queued">&#9719;</span>
              <span v-else-if="job.status === 'importing'" class="it__spinner"></span>
              <span v-else-if="job.status === 'done'" class="it__check">&#10003;</span>
              <span v-else class="it__error-icon">!</span>
            </div>
            <div class="it__job-info">
              <div class="it__job-label">{{ jobLabel(job) }}</div>
              <div class="it__job-status">
                <template v-if="job.status === 'waiting_for_login'">Esperando login...</template>
                <template v-else-if="job.status === 'queued'">En cola...</template>
                <template v-else-if="job.status === 'importing'">Importando...</template>
                <template v-else-if="job.status === 'done'">Completado</template>
                <template v-else-if="job.status === 'error'">Error</template>
                <span v-if="job.records > 0" class="it__job-records">&middot; {{ job.records }} registros</span>
                <span v-if="job.error" class="it__job-error-msg">&middot; {{ job.error }}</span>
              </div>
            </div>
            <button v-if="job.status === 'importing'" class="it__job-cancel" @click.stop="cancelActiveJob">Cancelar</button>
            <button v-else-if="job.status === 'done' || job.status === 'error'" class="it__job-dismiss" @click.stop="dismissJob(job.id)">&times;</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.it {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 280px;
  background: var(--color-surface, #fff);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md, 8px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  z-index: 1000;
  font-size: 0.85rem;
  overflow: hidden;
}

.it__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--color-primary, #16463f);
  color: #fff;
  cursor: pointer;
  user-select: none;
}

.it__title {
  font-weight: 600;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.it__count {
  opacity: 0.8;
  font-weight: 400;
}

.it__toggle {
  background: none;
  border: none;
  color: #fff;
  font-size: 1rem;
  cursor: pointer;
  padding: 0 2px;
  line-height: 1;
}

.it__caret {
  display: inline-block;
  transition: transform 0.2s;
}

.it__caret--up {
  transform: rotate(180deg);
}

.it__jobs {
  padding: 4px 0;
}

.it__job {
  padding: 8px 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.it__job:last-child {
  border-bottom: none;
}

.it__job--done {
  background: #f0faf5;
}

.it__job--error {
  background: #fef2f2;
}

.it__job-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.it__job-icon {
  flex-shrink: 0;
  width: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.it__job-info {
  flex: 1;
  min-width: 0;
}

.it__job-label {
  font-weight: 600;
  font-size: 0.82rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.it__job-status {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  margin-top: 1px;
}

.it__job-records {
  color: var(--color-text-secondary);
}

.it__job-error-msg {
  color: var(--color-error, #dc2626);
}

.it__job-dismiss {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  font-size: 1rem;
  cursor: pointer;
  padding: 0 2px;
  line-height: 1;
  flex-shrink: 0;
}

.it__job-dismiss:hover {
  color: var(--color-text);
}

.it__job-cancel {
  background: none;
  border: none;
  color: var(--color-error, #dc2626);
  font-size: 0.72rem;
  cursor: pointer;
  padding: 2px 6px;
  flex-shrink: 0;
  opacity: 0.7;
}

.it__job-cancel:hover {
  opacity: 1;
  text-decoration: underline;
}

.it__spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary, #16463f);
  border-radius: 50%;
  animation: it-spin 0.8s linear infinite;
  display: block;
}

@keyframes it-spin {
  to { transform: rotate(360deg); }
}

.it__queued {
  color: var(--color-text-secondary);
  font-size: 1rem;
}

.it__check {
  color: var(--color-success, #16a34a);
  font-weight: 700;
  font-size: 0.9rem;
}

.it__error-icon {
  color: var(--color-error, #dc2626);
  font-weight: 700;
  font-size: 0.9rem;
}
</style>
