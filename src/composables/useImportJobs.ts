import { ref } from 'vue'
import type { ImportJob } from '@/services/api'

// Global shared state — updated by ImportTracker polling
export const importJobs = ref<ImportJob[]>([])

export function hasActiveJob(entity: string, avantioId?: string): boolean {
  return importJobs.value.some(j =>
    j.entity === entity &&
    (avantioId ? j.avantioId === avantioId : !j.avantioId) &&
    ['queued', 'importing', 'waiting_for_login'].includes(j.status)
  )
}

export function hasAnyActiveJob(): boolean {
  return importJobs.value.some(j => ['queued', 'importing', 'waiting_for_login'].includes(j.status))
}
