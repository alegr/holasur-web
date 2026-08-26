<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { importerApi } from '@/services/api'

interface ActiveImport {
  sessionId: string
  status: string
  entity: string | null
  importResults: Record<string, number>
}

const activeImport = ref<ActiveImport | null>(null)
const dismissed = ref(false)
let pollTimer: ReturnType<typeof setInterval> | null = null

const entityLabels: Record<string, string> = {
  bookings: 'Reservas',
  properties: 'Propiedades',
  owners: 'Propietarios',
  customers: 'Clientes',
  service_catalog: 'Catálogo de servicios',
}

const statusLabels: Record<string, string> = {
  waiting_for_login: 'Esperando login...',
  needs_login: 'Esperando credenciales...',
  needs_2fa: 'Esperando 2FA...',
  logged_in: 'Conectado',
  importing: 'Importando...',
  done: 'Completado',
  error: 'Error',
}

const statusLabel = computed(() => {
  if (!activeImport.value) return ''
  return statusLabels[activeImport.value.status] || activeImport.value.status
})

const entityLabel = computed(() => {
  if (!activeImport.value?.entity) return ''
  return entityLabels[activeImport.value.entity] || activeImport.value.entity
})

const totalRecords = computed(() => {
  if (!activeImport.value?.importResults) return 0
  return Object.values(activeImport.value.importResults).reduce((a, b) => a + b, 0)
})

const isActive = computed(() => {
  if (!activeImport.value) return false
  return ['waiting_for_login', 'needs_login', 'needs_2fa', 'logged_in', 'importing'].includes(activeImport.value.status)
})

const isDone = computed(() => activeImport.value?.status === 'done')

async function poll() {
  try {
    const result = await importerApi.getActiveSession() as any
    if (result.active) {
      activeImport.value = {
        sessionId: result.sessionId,
        status: result.status,
        entity: result.entity || null,
        importResults: result.importResults || {},
      }
      // Auto-show when a new import starts
      if (isActive.value) dismissed.value = false
      // Auto-dismiss done after 10s
      if (isDone.value) {
        setTimeout(() => { dismissed.value = true; activeImport.value = null }, 10000)
      }
    } else {
      if (isDone.value || !activeImport.value) {
        activeImport.value = null
      }
    }
  } catch {
    // Importer not reachable — ignore
  }
}

onMounted(() => {
  poll()
  pollTimer = setInterval(poll, 5000)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<template>
  <Teleport to="body">
    <div v-if="activeImport && !dismissed" class="it" :class="{ 'it--done': isDone }">
      <div class="it__header">
        <span class="it__title">Importación</span>
        <button class="it__close" @click="dismissed = true">&times;</button>
      </div>
      <div class="it__body">
        <div class="it__status">
          <span v-if="isActive" class="it__spinner"></span>
          <span v-else-if="isDone" class="it__check">&#10003;</span>
          <span>{{ statusLabel }}</span>
        </div>
        <div v-if="entityLabel" class="it__entity">{{ entityLabel }}</div>
        <div v-if="totalRecords > 0" class="it__records">{{ totalRecords }} registros</div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.it {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 240px;
  background: var(--color-surface, #fff);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md, 8px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  z-index: 1000;
  font-size: 0.85rem;
  overflow: hidden;
}

.it--done {
  border-color: var(--color-success, #16a34a);
}

.it__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--color-primary, #16463f);
  color: #fff;
}

.it--done .it__header {
  background: var(--color-success, #16a34a);
}

.it__title {
  font-weight: 600;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.it__close {
  background: none;
  border: none;
  color: #fff;
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0 2px;
  line-height: 1;
  opacity: 0.7;
}

.it__close:hover {
  opacity: 1;
}

.it__body {
  padding: 10px 12px;
}

.it__status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.it__spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary, #16463f);
  border-radius: 50%;
  animation: it-spin 0.8s linear infinite;
}

@keyframes it-spin {
  to { transform: rotate(360deg); }
}

.it__check {
  color: var(--color-success, #16a34a);
  font-weight: 700;
}

.it__entity {
  color: var(--color-text-secondary);
  margin-top: 4px;
}

.it__records {
  color: var(--color-text-secondary);
  margin-top: 2px;
}
</style>
