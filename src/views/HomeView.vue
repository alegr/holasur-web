<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { laravelApi, type ImportLog } from '@/services/api'

const propertiesCount = ref<number | null>(null)
const lastImport = ref<ImportLog | null>(null)
const loading = ref(true)

onMounted(async () => {
  try {
    const [propsRes, logsRes] = await Promise.allSettled([
      laravelApi.getProperties(),
      laravelApi.getImportLogs(),
    ])

    if (propsRes.status === 'fulfilled') {
      propertiesCount.value = propsRes.value.total
    }

    if (logsRes.status === 'fulfilled' && logsRes.value.data.length > 0) {
      lastImport.value = logsRes.value.data[0] ?? null
    }
  } catch {
    // Stats will show as unavailable
  } finally {
    loading.value = false
  }
})

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div class="home">
    <h2 class="home__heading">Bienvenido a HolaSur</h2>
    <p class="home__description">
      Panel de gestión para la importación y administración de propiedades desde Avantio.
    </p>

    <div class="stats-grid">
      <div class="stat-card">
        <span class="stat-card__icon">&#9962;</span>
        <div class="stat-card__content">
          <span class="stat-card__value">
            <template v-if="loading">...</template>
            <template v-else>{{ propertiesCount ?? '--' }}</template>
          </span>
          <span class="stat-card__label">Propiedades importadas</span>
        </div>
      </div>

      <div class="stat-card">
        <span class="stat-card__icon">&#128197;</span>
        <div class="stat-card__content">
          <span class="stat-card__value">--</span>
          <span class="stat-card__label">Reservas importadas</span>
        </div>
      </div>

      <div class="stat-card">
        <span class="stat-card__icon">&#128337;</span>
        <div class="stat-card__content">
          <span class="stat-card__value">
            <template v-if="loading">...</template>
            <template v-else-if="lastImport">{{ formatDate(lastImport.started_at) }}</template>
            <template v-else>--</template>
          </span>
          <span class="stat-card__label">Última importación</span>
        </div>
      </div>
    </div>

    <div class="quick-actions card">
      <h3>Acciones rápidas</h3>
      <div class="quick-actions__buttons">
        <RouterLink to="/importar" class="btn btn--primary">Iniciar importación</RouterLink>
        <RouterLink to="/propiedades" class="btn btn--secondary">Ver propiedades</RouterLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home__heading {
  font-size: 1.8rem;
  font-weight: 700;
  margin-bottom: 8px;
}

.home__description {
  color: var(--color-text-secondary);
  margin-bottom: 32px;
  font-size: 1.05rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
}

.stat-card {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-card__icon {
  font-size: 2rem;
  width: 56px;
  height: 56px;
  background: var(--color-background-mute);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-card__content {
  display: flex;
  flex-direction: column;
}

.stat-card__value {
  font-size: 1.4rem;
  font-weight: 700;
}

.stat-card__label {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.quick-actions h3 {
  margin-bottom: 16px;
  font-weight: 600;
}

.quick-actions__buttons {
  display: flex;
  gap: 12px;
}

@media (max-width: 768px) {
  .home__heading {
    font-size: 1.4rem;
  }

  .home__description {
    font-size: 0.95rem;
    margin-bottom: 20px;
  }

  .stats-grid {
    grid-template-columns: 1fr;
    gap: 12px;
    margin-bottom: 20px;
  }

  .stat-card {
    padding: 16px;
  }

  .quick-actions__buttons {
    flex-direction: column;
  }
}
</style>
