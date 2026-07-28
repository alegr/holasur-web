<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import {
  laravelApi,
  reportsApi,
  type Property,
  type DeviationItem,
  type CostCategory,
  type StandardCostItem,
} from '@/services/api'

const properties = ref<Property[]>([])
const categories = ref<CostCategory[]>([])
const selectedPropertyId = ref<number | null>(null)
const deviations = ref<DeviationItem[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

// Standard cost editing
const editingStandards = ref(false)
const standardDraft = ref<Record<number, number>>({})
const savingStandards = ref(false)

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD' }).format(value)
}

function deviationClass(deviation: number): string {
  if (deviation > 0) return 'deviation--over'
  if (deviation < 0) return 'deviation--under'
  return ''
}

async function loadProperties() {
  try {
    const res = await laravelApi.getProperties()
    properties.value = res.data
  } catch {
    // ignore
  }
}

async function loadCategories() {
  try {
    categories.value = await laravelApi.getCostCategories()
  } catch {
    // ignore
  }
}

async function fetchDeviations() {
  if (!selectedPropertyId.value) return
  loading.value = true
  error.value = null
  try {
    deviations.value = await reportsApi.getDeviations(selectedPropertyId.value)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Error al cargar desvíos'
  } finally {
    loading.value = false
  }
}

async function startEditing() {
  if (!selectedPropertyId.value) return
  editingStandards.value = true
  // Load current standards
  try {
    const standards = await reportsApi.getStandardCosts(selectedPropertyId.value)
    standardDraft.value = {}
    for (const s of standards) {
      standardDraft.value[s.cost_category_id] = s.standard_amount
    }
    // Also populate from deviations that have standards
    for (const d of deviations.value) {
      if (d.standard > 0 && !(d.cost_category_id in standardDraft.value)) {
        standardDraft.value[d.cost_category_id] = d.standard
      }
    }
  } catch {
    // use deviations data as fallback
    standardDraft.value = {}
    for (const d of deviations.value) {
      standardDraft.value[d.cost_category_id] = d.standard
    }
  }
}

async function saveStandards() {
  if (!selectedPropertyId.value) return
  savingStandards.value = true
  try {
    const items = Object.entries(standardDraft.value)
      .filter(([, amount]) => amount > 0)
      .map(([catId, amount]) => ({
        property_id: selectedPropertyId.value!,
        cost_category_id: Number(catId),
        standard_amount: amount,
      }))

    if (items.length > 0) {
      await reportsApi.saveStandardCosts(items)
    }
    editingStandards.value = false
    await fetchDeviations()
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Error al guardar costos estándar'
  } finally {
    savingStandards.value = false
  }
}

function cancelEditing() {
  editingStandards.value = false
  standardDraft.value = {}
}

function getCategoryName(catId: number): string {
  return categories.value.find((c) => c.id === catId)?.name ?? `Categoría ${catId}`
}

watch(selectedPropertyId, () => {
  editingStandards.value = false
  if (selectedPropertyId.value) {
    fetchDeviations()
  } else {
    deviations.value = []
  }
})

onMounted(() => {
  loadProperties()
  loadCategories()
})
</script>

<template>
  <div class="deviations">
    <div class="deviations__header">
      <div>
        <h2 class="deviations__heading">Desvíos de Costos</h2>
        <p class="deviations__subtitle">Comparación entre costos estándar y costos reales por propiedad</p>
      </div>
      <div class="deviations__filters">
        <label class="deviations__filter-label">
          Propiedad
          <select v-model="selectedPropertyId" class="input">
            <option :value="null">Seleccionar propiedad...</option>
            <option v-for="prop in properties" :key="prop.id" :value="prop.id">
              {{ prop.name }}
            </option>
          </select>
        </label>
      </div>
    </div>

    <div v-if="!selectedPropertyId" class="deviations__status card">
      <p>Seleccione una propiedad para ver los desvíos de costos.</p>
    </div>

    <div v-else-if="loading" class="deviations__status card">
      <span class="spinner spinner--large"></span>
      <p>Cargando...</p>
    </div>

    <div v-else-if="error" class="deviations__status card">
      <p class="deviations__error-text">{{ error }}</p>
      <button class="btn btn--primary" @click="fetchDeviations">Reintentar</button>
    </div>

    <template v-else>
      <div class="deviations__actions">
        <button
          v-if="!editingStandards"
          class="btn btn--secondary"
          @click="startEditing"
        >
          Editar costos estándar
        </button>
        <template v-else>
          <button class="btn btn--primary" :disabled="savingStandards" @click="saveStandards">
            {{ savingStandards ? 'Guardando...' : 'Guardar' }}
          </button>
          <button class="btn btn--ghost" @click="cancelEditing">Cancelar</button>
        </template>
      </div>

      <!-- Editing mode: show all categories -->
      <div v-if="editingStandards" class="card table-wrapper">
        <h3 class="deviations__section-title">Definir costos estándar</h3>
        <table>
          <thead>
            <tr>
              <th>Categoría</th>
              <th>Costo estándar (USD)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="cat in categories" :key="cat.id">
              <td>{{ cat.name }}</td>
              <td>
                <input
                  type="number"
                  class="input deviations__input"
                  step="0.01"
                  min="0"
                  :value="standardDraft[cat.id] ?? 0"
                  @input="standardDraft[cat.id] = Number(($event.target as HTMLInputElement).value)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Deviations table -->
      <div v-if="!editingStandards" class="card table-wrapper">
        <div v-if="deviations.length === 0" class="deviations__empty">
          No hay datos de desvíos. Defina costos estándar primero.
        </div>
        <table v-else>
          <thead>
            <tr>
              <th>Categoría</th>
              <th>Costo estándar</th>
              <th>Costo real</th>
              <th>Desvío</th>
              <th>% Desvío</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in deviations" :key="d.cost_category_id" :class="deviationClass(d.deviation)">
              <td class="deviations__category">{{ d.category }}</td>
              <td>{{ formatCurrency(d.standard) }}</td>
              <td>{{ formatCurrency(d.actual) }}</td>
              <td :class="deviationClass(d.deviation)" class="deviations__deviation-value">
                {{ d.deviation >= 0 ? '+' : '' }}{{ formatCurrency(d.deviation) }}
              </td>
              <td :class="deviationClass(d.deviation)" class="deviations__deviation-value">
                {{ d.deviation_percent >= 0 ? '+' : '' }}{{ d.deviation_percent.toFixed(1) }}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped>
.deviations__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.deviations__heading {
  font-size: 1.6rem;
  font-weight: 700;
  margin-bottom: 4px;
}

.deviations__subtitle {
  color: var(--color-text-secondary);
  font-size: 0.9rem;
}

.deviations__filters {
  display: flex;
  gap: 16px;
  align-items: flex-end;
}

.deviations__filter-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.deviations__filter-label select {
  min-width: 250px;
}

.deviations__status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 48px;
  color: var(--color-text-secondary);
}

.deviations__error-text {
  color: var(--color-error);
  font-weight: 500;
}

.deviations__actions {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.deviations__section-title {
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 16px;
}

.deviations__empty {
  text-align: center;
  padding: 24px;
  color: var(--color-text-secondary);
}

.deviations__input {
  width: 140px;
  text-align: right;
}

.deviations__category {
  font-weight: 600;
}

.deviations__deviation-value {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.deviation--over {
  --row-tint: rgba(220, 38, 38, 0.04);
}

.deviation--under {
  --row-tint: rgba(22, 163, 74, 0.04);
}

tr.deviation--over {
  background: var(--row-tint);
}

tr.deviation--under {
  background: var(--row-tint);
}

td.deviation--over,
.deviation--over .deviations__deviation-value {
  color: var(--color-error);
}

td.deviation--under,
.deviation--under .deviations__deviation-value {
  color: var(--color-success);
}

.btn--secondary {
  background: var(--color-background-mute);
  color: var(--color-heading);
  border: 1px solid var(--color-border);
  padding: 8px 16px;
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn--secondary:hover {
  background: var(--color-background-soft);
}

.btn--ghost {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  padding: 8px 16px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
}

.btn--ghost:hover {
  color: var(--color-heading);
}
</style>
