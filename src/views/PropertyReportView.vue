<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { analyticsApi, type PropertyProfitability } from '@/services/api'

const route = useRoute()

const loading = ref(true)
const error = ref<string | null>(null)
const report = ref<PropertyProfitability | null>(null)

const today = new Date()
const firstOfYear = new Date(today.getFullYear(), 0, 1)
const dateFrom = ref(firstOfYear.toISOString().slice(0, 10))
const dateTo = ref(today.toISOString().slice(0, 10))

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD' }).format(value)
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

function marginClass(value: number): string {
  return value >= 0 ? 'text--positive' : 'text--negative'
}

async function fetchReport() {
  const id = Number(route.params.id)
  if (!id) return
  loading.value = true
  error.value = null
  try {
    report.value = await analyticsApi.getPropertyProfitability(id, dateFrom.value, dateTo.value)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Error al cargar reporte'
  } finally {
    loading.value = false
  }
}

onMounted(fetchReport)
watch([dateFrom, dateTo], fetchReport)
</script>

<template>
  <div class="report">
    <RouterLink to="/analisis" class="report__back">&larr; Volver al analisis</RouterLink>

    <!-- Loading -->
    <div v-if="loading" class="report__status card">
      <span class="spinner spinner--large"></span>
      <p>Cargando...</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="report__status card">
      <p class="report__error-text">{{ error }}</p>
      <button class="btn btn--primary" @click="fetchReport">Reintentar</button>
    </div>

    <template v-else-if="report">
      <!-- Header -->
      <div class="report__header">
        <div>
          <h2 class="report__heading">{{ report.property_name }}</h2>
          <p class="report__id">ID: {{ report.property_id }}</p>
        </div>
        <div class="report__filters">
          <label class="report__filter-label">
            Desde
            <input type="date" v-model="dateFrom" class="input" />
          </label>
          <label class="report__filter-label">
            Hasta
            <input type="date" v-model="dateTo" class="input" />
          </label>
        </div>
      </div>

      <!-- P&L Card -->
      <div class="card report__section">
        <h3 class="report__section-title">Estado de resultados</h3>
        <div class="pl-table">
          <div class="pl-row">
            <span class="pl-label">Ingresos brutos</span>
            <span class="pl-value">{{ formatCurrency(report.gross_revenue) }}</span>
          </div>
          <div class="pl-row pl-row--indent">
            <span class="pl-label">(-) Costes directos</span>
            <span class="pl-value text--negative">{{ formatCurrency(report.direct_costs) }}</span>
          </div>
          <div class="pl-row pl-row--subtotal">
            <span class="pl-label">= Margen bruto</span>
            <span class="pl-value" :class="marginClass(report.gross_margin)">
              {{ formatCurrency(report.gross_margin) }}
            </span>
          </div>
          <div class="pl-row pl-row--indent">
            <span class="pl-label">(-) Costes indirectos</span>
            <span class="pl-value text--negative">{{ formatCurrency(report.indirect_costs) }}</span>
          </div>
          <div class="pl-row pl-row--total">
            <span class="pl-label">= Margen neto</span>
            <span class="pl-value" :class="marginClass(report.net_margin)">
              {{ formatCurrency(report.net_margin) }}
            </span>
          </div>
          <div class="pl-row">
            <span class="pl-label">ROI</span>
            <span class="pl-value" :class="marginClass(report.roi_percent)">
              {{ formatPercent(report.roi_percent) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Stats Row -->
      <div class="stats-grid">
        <div class="stat-card card">
          <span class="stat-card__label">Noches vendidas</span>
          <span class="stat-card__value">{{ report.nights_sold }}</span>
        </div>
        <div class="stat-card card">
          <span class="stat-card__label">Reservas</span>
          <span class="stat-card__value">{{ report.bookings_count }}</span>
        </div>
        <div class="stat-card card">
          <span class="stat-card__label">Tarifa promedio</span>
          <span class="stat-card__value">{{ formatCurrency(report.avg_nightly_rate) }}</span>
        </div>
        <div class="stat-card card">
          <span class="stat-card__label">Ocupacion</span>
          <span class="stat-card__value">{{ formatPercent(report.occupancy_rate) }}</span>
        </div>
      </div>

      <!-- Cost Breakdown -->
      <div class="card report__section">
        <h3 class="report__section-title">Desglose de costes</h3>
        <div class="cost-breakdown">
          <div class="cost-breakdown__item">
            <span class="cost-breakdown__label">Costes Hola Sur</span>
            <span class="cost-breakdown__value">{{ formatCurrency(report.holasur_costs) }}</span>
          </div>
          <div class="cost-breakdown__item">
            <span class="cost-breakdown__label">Costes Propietario</span>
            <span class="cost-breakdown__value">{{ formatCurrency(report.owner_costs) }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.report__back {
  display: inline-block;
  margin-bottom: 20px;
  font-weight: 600;
  font-size: 0.95rem;
}

.report__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.report__heading {
  font-size: 1.6rem;
  font-weight: 700;
  margin-bottom: 4px;
}

.report__id {
  color: var(--color-text-secondary);
  font-size: 0.9rem;
}

.report__filters {
  display: flex;
  gap: 16px;
  align-items: flex-end;
}

.report__filter-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.report__status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 48px;
  color: var(--color-text-secondary);
}

.report__error-text {
  color: var(--color-error);
  font-weight: 500;
}

.report__section {
  margin-bottom: 24px;
}

.report__section-title {
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 16px;
}

/* P&L Table */
.pl-table {
  display: flex;
  flex-direction: column;
}

.pl-row {
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid var(--color-border);
}

.pl-row--indent .pl-label {
  padding-left: 20px;
  color: var(--color-text-secondary);
}

.pl-row--subtotal {
  font-weight: 600;
  background: var(--color-background-soft);
  padding: 12px 8px;
  border-radius: var(--radius-sm);
}

.pl-row--total {
  font-weight: 700;
  font-size: 1.1rem;
  background: var(--color-background-mute);
  padding: 14px 8px;
  border-radius: var(--radius-sm);
  border-bottom: none;
}

.pl-label {
  font-size: 0.95rem;
}

.pl-value {
  font-size: 0.95rem;
  font-weight: 600;
}

/* Margin colors */
.text--positive {
  color: var(--color-success);
}

.text--negative {
  color: var(--color-error);
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 20px;
}

.stat-card__label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.stat-card__value {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--color-heading);
}

/* Cost Breakdown */
.cost-breakdown {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.cost-breakdown__item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background: var(--color-background-soft);
  border-radius: var(--radius-md);
}

.cost-breakdown__label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.cost-breakdown__value {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--color-heading);
}

@media (max-width: 768px) {
  .report__filters {
    flex-direction: column;
    width: 100%;
  }

  .cost-breakdown {
    grid-template-columns: 1fr;
  }
}
</style>
