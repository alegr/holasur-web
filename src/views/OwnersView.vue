<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { reportsApi, type OwnerSummary, type OwnerPnl } from '@/services/api'
import ImportWidget from '@/components/ImportWidget.vue'

const loading = ref(true)
const error = ref<string | null>(null)
const owners = ref<OwnerSummary[]>([])
const expandedOwnerId = ref<number | null>(null)
const ownerPnl = ref<OwnerPnl | null>(null)
const loadingPnl = ref(false)

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD' }).format(value)
}

function marginClass(value: number): string {
  return value >= 0 ? 'text--positive' : 'text--negative'
}

async function fetchOwners() {
  loading.value = true
  error.value = null
  try {
    owners.value = await reportsApi.getOwners()
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Error al cargar propietarios'
  } finally {
    loading.value = false
  }
}

async function toggleOwner(ownerId: number) {
  if (expandedOwnerId.value === ownerId) {
    expandedOwnerId.value = null
    ownerPnl.value = null
    return
  }
  expandedOwnerId.value = ownerId
  loadingPnl.value = true
  try {
    ownerPnl.value = await reportsApi.getOwnerPnl(ownerId)
  } catch {
    ownerPnl.value = null
  } finally {
    loadingPnl.value = false
  }
}

onMounted(fetchOwners)
</script>

<template>
  <div class="owners">
    <div class="owners__header">
      <div>
        <h2 class="owners__heading">Propietarios</h2>
        <p class="owners__subtitle">Listado de propietarios con resumen financiero</p>
      </div>
    </div>

    <ImportWidget entity="owners" @imported="fetchOwners" />

    <div v-if="loading" class="owners__status card">
      <span class="spinner spinner--large"></span>
      <p>Cargando...</p>
    </div>

    <div v-else-if="error" class="owners__status card">
      <p class="owners__error-text">{{ error }}</p>
      <button class="btn btn--primary" @click="fetchOwners">Reintentar</button>
    </div>

    <div v-else-if="owners.length === 0" class="owners__status card">
      <p>No se encontraron propietarios.</p>
    </div>

    <div v-else class="card table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Propietario</th>
            <th>Propiedades</th>
            <th>Ingresos totales</th>
            <th>Margen total</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="owner in owners" :key="owner.id">
            <tr class="owners__row" :class="{ 'owners__row--expanded': expandedOwnerId === owner.id }" @click="toggleOwner(owner.id)">
              <td class="owners__name">{{ owner.name }}</td>
              <td>{{ owner.property_count }}</td>
              <td>{{ formatCurrency(owner.total_revenue) }}</td>
              <td :class="marginClass(owner.total_margin)">{{ formatCurrency(owner.total_margin) }}</td>
              <td class="owners__toggle">{{ expandedOwnerId === owner.id ? '&#9650;' : '&#9660;' }}</td>
            </tr>
            <tr v-if="expandedOwnerId === owner.id">
              <td colspan="5" class="owners__detail-cell">
                <div v-if="loadingPnl" class="owners__detail-loading">
                  <span class="spinner"></span> Cargando detalle...
                </div>
                <div v-else-if="ownerPnl" class="owners__detail">
                  <div class="owners__detail-summary">
                    <div class="owners__detail-kpi">
                      <span class="owners__detail-kpi-label">Reservas</span>
                      <span class="owners__detail-kpi-value">{{ ownerPnl.totals.bookings_count }}</span>
                    </div>
                    <div class="owners__detail-kpi">
                      <span class="owners__detail-kpi-label">Noches vendidas</span>
                      <span class="owners__detail-kpi-value">{{ ownerPnl.totals.nights_sold }}</span>
                    </div>
                    <div class="owners__detail-kpi">
                      <span class="owners__detail-kpi-label">Margen %</span>
                      <span class="owners__detail-kpi-value" :class="marginClass(ownerPnl.totals.margin_percent)">
                        {{ ownerPnl.totals.margin_percent.toFixed(1) }}%
                      </span>
                    </div>
                  </div>
                  <table class="owners__props-table">
                    <thead>
                      <tr>
                        <th>Propiedad</th>
                        <th>Reservas</th>
                        <th>Ingresos</th>
                        <th>Costos</th>
                        <th>Margen neto</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="prop in ownerPnl.properties" :key="prop.id">
                        <td>{{ prop.name }}</td>
                        <td>{{ prop.bookings_count }}</td>
                        <td>{{ formatCurrency(prop.gross_revenue) }}</td>
                        <td class="text--negative">{{ formatCurrency(prop.costs) }}</td>
                        <td :class="marginClass(prop.net_margin)">{{ formatCurrency(prop.net_margin) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div v-else class="owners__detail-loading">
                  No se pudo cargar el detalle.
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.owners__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  margin-bottom: 24px;
}

.owners__heading {
  font-size: 1.6rem;
  font-weight: 700;
  margin-bottom: 4px;
}

.owners__subtitle {
  color: var(--color-text-secondary);
  font-size: 0.9rem;
}

.owners__status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 48px;
  color: var(--color-text-secondary);
}

.owners__error-text {
  color: var(--color-error);
  font-weight: 500;
}

.owners__row {
  cursor: pointer;
  transition: background 0.15s;
}

.owners__row:hover {
  background: var(--color-background-soft);
}

.owners__row--expanded {
  background: var(--color-background-soft);
}

.owners__name {
  font-weight: 600;
}

.owners__toggle {
  text-align: center;
  color: var(--color-text-secondary);
  font-size: 0.8rem;
}

.owners__detail-cell {
  padding: 0 !important;
  background: var(--color-background-mute);
}

.owners__detail {
  padding: 20px 24px;
}

.owners__detail-loading {
  padding: 20px 24px;
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--color-text-secondary);
}

.owners__detail-summary {
  display: flex;
  gap: 32px;
  margin-bottom: 16px;
}

.owners__detail-kpi {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.owners__detail-kpi-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-secondary);
}

.owners__detail-kpi-value {
  font-size: 1.2rem;
  font-weight: 700;
}

.owners__props-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.owners__props-table th {
  text-align: left;
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-secondary);
}

.owners__props-table td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
}

.text--positive {
  color: var(--color-success);
}

.text--negative {
  color: var(--color-error);
}
</style>
