<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { laravelApi, type Property } from '@/services/api'
import ImportWidget from '@/components/ImportWidget.vue'

const properties = ref<Property[]>([])
const totalCount = ref(0)
const loading = ref(true)
const error = ref<string | null>(null)
const searchQuery = ref('')

const filteredProperties = computed(() => {
  if (!searchQuery.value.trim()) return properties.value
  const q = searchQuery.value.toLowerCase()
  return properties.value.filter(
    (p) =>
      p.name?.toLowerCase().includes(q) ||
      p.location?.toLowerCase().includes(q) ||
      p.avantio_id?.toLowerCase().includes(q),
  )
})

async function fetchProperties() {
  loading.value = true
  error.value = null
  try {
    const result = await laravelApi.getProperties()
    properties.value = result.data
    totalCount.value = result.total
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar propiedades'
  } finally {
    loading.value = false
  }
}

onMounted(fetchProperties)
</script>

<template>
  <div class="properties">
    <ImportWidget entity="properties" @imported="fetchProperties" />
    <div class="properties__header">
      <div>
        <h2 class="properties__heading">Propiedades</h2>
        <p class="properties__count" v-if="!loading && !error">
          Mostrando {{ filteredProperties.length }} propiedades
        </p>
      </div>
      <div class="properties__search">
        <input
          v-model="searchQuery"
          type="text"
          class="input"
          placeholder="Buscar por nombre, ubicación o ID..."
        />
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="properties__loading card">
      <span class="spinner spinner--large"></span>
      <p>Cargando propiedades...</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="properties__error card">
      <p class="properties__error-text">{{ error }}</p>
      <button class="btn btn--primary" @click="fetchProperties">Reintentar</button>
    </div>

    <!-- Empty -->
    <div v-else-if="filteredProperties.length === 0" class="properties__empty card">
      <p v-if="searchQuery">No se encontraron propiedades que coincidan con "{{ searchQuery }}"</p>
      <p v-else>No hay propiedades importadas. Inicia una importación desde Avantio.</p>
      <RouterLink v-if="!searchQuery" to="/importar" class="btn btn--primary">
        Importar propiedades
      </RouterLink>
    </div>

    <!-- Table -->
    <div v-else class="card table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>ID Avantio</th>
            <th>Tipo</th>
            <th>Ubicación</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="property in filteredProperties" :key="property.id">
            <td>
              <RouterLink :to="`/propiedades/${property.id}`">
                <strong>{{ property.name }}</strong>
              </RouterLink>
            </td>
            <td>
              <code>{{ property.avantio_id || '--' }}</code>
            </td>
            <td>{{ property.type || '--' }}</td>
            <td>{{ property.location || '--' }}</td>
            <td>
              <span
                class="badge"
                :class="property.is_active ? 'badge--success' : 'badge--error'"
              >
                {{ property.is_active ? 'Activo' : 'Desactivado' }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.properties__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.properties__heading {
  font-size: 1.6rem;
  font-weight: 700;
  margin-bottom: 4px;
}

.properties__count {
  color: var(--color-text-secondary);
  font-size: 0.9rem;
}

.properties__search .input {
  min-width: 300px;
}

.properties__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 48px;
  color: var(--color-text-secondary);
}

.properties__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 48px;
}

.properties__error-text {
  color: var(--color-error);
  font-weight: 500;
}

.properties__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 48px;
  text-align: center;
  color: var(--color-text-secondary);
}

code {
  font-size: 0.85rem;
  background: var(--color-background-mute);
  padding: 2px 6px;
  border-radius: 4px;
}
</style>
