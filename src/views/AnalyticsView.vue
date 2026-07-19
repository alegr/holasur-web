<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { RouterLink } from 'vue-router'
import {
  analyticsApi,
  type AnalyticsKpis,
  type RevenueByChannel,
  type RevenueByMonth,
  type PropertyRanking,
  type CashFlow,
} from '@/services/api'

const loading = ref(true)
const error = ref<string | null>(null)

const today = new Date()
const firstOfYear = new Date(today.getFullYear(), 0, 1)
const dateFrom = ref(firstOfYear.toISOString().slice(0, 10))
const dateTo = ref(today.toISOString().slice(0, 10))

const kpis = ref<AnalyticsKpis | null>(null)
const channels = ref<RevenueByChannel[]>([])
const months = ref<RevenueByMonth[]>([])
const ranking = ref<PropertyRanking[]>([])
const cashflow = ref<CashFlow | null>(null)

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD' }).format(value)
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

function marginClass(value: number): string {
  return value >= 0 ? 'text--positive' : 'text--negative'
}

async function fetchAll() {
  loading.value = true
  error.value = null
  try {
    const from = dateFrom.value
    const to = dateTo.value
    const [kpisData, channelsData, monthsData, rankingData, cashflowData] = await Promise.all([
      analyticsApi.getKpis(from, to),
      analyticsApi.getRevenueByChannel(from, to),
      analyticsApi.getRevenueByMonth(new Date(from).getFullYear()),
      analyticsApi.getPropertiesRanking(from, to),
      analyticsApi.getCashFlow(6),
    ])
    kpis.value = kpisData
    channels.value = channelsData
    months.value = monthsData
    ranking.value = rankingData.sort((a, b) => b.net_margin - a.net_margin)
    cashflow.value = cashflowData
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Error al cargar datos'
  } finally {
    loading.value = false
  }
}

onMounted(fetchAll)

watch([dateFrom, dateTo], fetchAll)
</script>

<template>
  <div class="analytics">
    <div class="analytics__header">
      <div>
        <h2 class="analytics__heading">Analisis</h2>
        <p class="analytics__subtitle">Panel de metricas y rendimiento</p>
      </div>
      <div class="analytics__filters">
        <label class="analytics__filter-label">
          Desde
          <input type="date" v-model="dateFrom" class="input" />
        </label>
        <label class="analytics__filter-label">
          Hasta
          <input type="date" v-model="dateTo" class="input" />
        </label>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="analytics__status card">
      <span class="spinner spinner--large"></span>
      <p>Cargando...</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="analytics__status card">
      <p class="analytics__error-text">{{ error }}</p>
      <button class="btn btn--primary" @click="fetchAll">Reintentar</button>
    </div>

    <template v-else-if="kpis">
      <!-- KPIs -->
      <div class="kpi-grid">
        <div class="kpi-card card">
          <span class="kpi-card__label">Ingresos totales</span>
          <span class="kpi-card__value">{{ formatCurrency(kpis.total_revenue) }}</span>
        </div>
        <div class="kpi-card card">
          <span class="kpi-card__label">Costes totales</span>
          <span class="kpi-card__value">{{ formatCurrency(kpis.total_costs) }}</span>
        </div>
        <div class="kpi-card card">
          <span class="kpi-card__label">Margen neto</span>
          <span class="kpi-card__value" :class="marginClass(kpis.net_margin)">
            {{ formatCurrency(kpis.net_margin) }}
          </span>
        </div>
        <div class="kpi-card card">
          <span class="kpi-card__label">Propiedades activas</span>
          <span class="kpi-card__value">{{ kpis.total_properties }}</span>
        </div>
        <div class="kpi-card card">
          <span class="kpi-card__label">Reservas totales</span>
          <span class="kpi-card__value">{{ kpis.total_bookings }}</span>
        </div>
        <div class="kpi-card card">
          <span class="kpi-card__label">Ocupacion promedio</span>
          <span class="kpi-card__value">{{ formatPercent(kpis.avg_occupancy) }}</span>
        </div>
        <div class="kpi-card card">
          <span class="kpi-card__label">Tarifa promedio por noche</span>
          <span class="kpi-card__value">{{ formatCurrency(kpis.avg_nightly_rate) }}</span>
        </div>
        <div class="kpi-card card">
          <span class="kpi-card__label">Canal principal</span>
          <span class="kpi-card__value kpi-card__value--text">{{ kpis.top_channel || '--' }}</span>
        </div>
      </div>

      <!-- Revenue by Channel -->
      <div class="card analytics__section">
        <h3 class="analytics__section-title">Ingresos por canal</h3>
        <div v-if="channels.length === 0" class="analytics__empty">Sin datos de canales.</div>
        <div v-else class="bar-chart">
          <div v-for="ch in channels" :key="ch.channel" class="bar-chart__row">
            <span class="bar-chart__label">{{ ch.channel }}</span>
            <div class="bar-chart__track">
              <div
                class="bar-chart__bar"
                :style="{ width: ch.percentage + '%' }"
              ></div>
            </div>
            <span class="bar-chart__value">{{ formatCurrency(ch.total_revenue) }}</span>
            <span class="bar-chart__pct">{{ formatPercent(ch.percentage) }}</span>
          </div>
        </div>
      </div>

      <!-- Revenue by Month -->
      <div class="card analytics__section table-wrapper">
        <h3 class="analytics__section-title">Ingresos por mes</h3>
        <div v-if="months.length === 0" class="analytics__empty">Sin datos mensuales.</div>
        <table v-else>
          <thead>
            <tr>
              <th>Mes</th>
              <th>Reservas</th>
              <th>Ingresos</th>
              <th>Costes</th>
              <th>Margen</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in months" :key="m.month">
              <td>{{ m.month }}</td>
              <td>{{ m.bookings_count }}</td>
              <td>{{ formatCurrency(m.revenue) }}</td>
              <td>{{ formatCurrency(m.costs) }}</td>
              <td :class="marginClass(m.net_margin)">{{ formatCurrency(m.net_margin) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Properties Ranking -->
      <div class="card analytics__section table-wrapper">
        <h3 class="analytics__section-title">Ranking de propiedades</h3>
        <div v-if="ranking.length === 0" class="analytics__empty">Sin datos de propiedades.</div>
        <table v-else>
          <thead>
            <tr>
              <th>Propiedad</th>
              <th>Ingresos</th>
              <th>Costes</th>
              <th>Margen</th>
              <th>Reservas</th>
              <th>Ocupacion %</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in ranking" :key="p.property_id">
              <td>
                <RouterLink :to="`/analisis/propiedad/${p.property_id}`" class="analytics__property-link">
                  {{ p.property_name }}
                </RouterLink>
              </td>
              <td>{{ formatCurrency(p.revenue) }}</td>
              <td>{{ formatCurrency(p.costs) }}</td>
              <td :class="marginClass(p.net_margin)">{{ formatCurrency(p.net_margin) }}</td>
              <td>{{ p.bookings_count }}</td>
              <td>{{ formatPercent(p.occupancy_rate) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Cash Flow -->
      <div class="cashflow-grid">
        <div class="card analytics__section table-wrapper">
          <h3 class="analytics__section-title">Ingresos proyectados</h3>
          <div v-if="!cashflow || cashflow.upcoming_income.length === 0" class="analytics__empty">
            Sin ingresos proyectados.
          </div>
          <table v-else>
            <thead>
              <tr>
                <th>Mes</th>
                <th>Reservas</th>
                <th>Monto</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in cashflow.upcoming_income" :key="'inc-' + item.month">
                <td>{{ item.month }}</td>
                <td>{{ item.count }}</td>
                <td>{{ formatCurrency(item.total) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="card analytics__section table-wrapper">
          <h3 class="analytics__section-title">Egresos pendientes</h3>
          <div v-if="!cashflow || cashflow.upcoming_expenses.length === 0" class="analytics__empty">
            Sin egresos pendientes.
          </div>
          <table v-else>
            <thead>
              <tr>
                <th>Mes</th>
                <th>Cantidad</th>
                <th>Monto</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in cashflow.upcoming_expenses" :key="'exp-' + item.month">
                <td>{{ item.month }}</td>
                <td>{{ item.count }}</td>
                <td>{{ formatCurrency(item.total) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.analytics__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.analytics__heading {
  font-size: 1.6rem;
  font-weight: 700;
  margin-bottom: 4px;
}

.analytics__subtitle {
  color: var(--color-text-secondary);
  font-size: 0.9rem;
}

.analytics__filters {
  display: flex;
  gap: 16px;
  align-items: flex-end;
}

.analytics__filter-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.analytics__status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 48px;
  color: var(--color-text-secondary);
}

.analytics__error-text {
  color: var(--color-error);
  font-weight: 500;
}

.analytics__section {
  margin-bottom: 24px;
}

.analytics__section-title {
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 16px;
}

.analytics__empty {
  text-align: center;
  padding: 24px;
  color: var(--color-text-secondary);
}

.analytics__property-link {
  font-weight: 600;
}

/* KPI grid */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.kpi-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 20px;
}

.kpi-card__label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.kpi-card__value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-heading);
}

.kpi-card__value--text {
  font-size: 1.2rem;
}

/* Margin colors */
.text--positive {
  color: var(--color-success);
}

.text--negative {
  color: var(--color-error);
}

/* CSS Bar chart */
.bar-chart {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.bar-chart__row {
  display: grid;
  grid-template-columns: 140px 1fr 120px 60px;
  align-items: center;
  gap: 12px;
}

.bar-chart__label {
  font-weight: 600;
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bar-chart__track {
  height: 24px;
  background: var(--color-background-mute);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.bar-chart__bar {
  height: 100%;
  background: var(--color-primary);
  border-radius: var(--radius-sm);
  min-width: 4px;
  transition: width 0.4s ease;
}

.bar-chart__value {
  font-size: 0.9rem;
  font-weight: 600;
  text-align: right;
}

.bar-chart__pct {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  text-align: right;
}

/* Cash flow grid */
.cashflow-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

@media (max-width: 768px) {
  .cashflow-grid {
    grid-template-columns: 1fr;
  }

  .bar-chart__row {
    grid-template-columns: 100px 1fr 90px 50px;
  }

  .analytics__filters {
    flex-direction: column;
    width: 100%;
  }
}
</style>
