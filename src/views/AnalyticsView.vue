<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { RouterLink } from 'vue-router'
import {
  analyticsApi,
  type AnalyticsKpis,
  type RevenueByMonth,
  type PropertyRanking,
  type ChannelAnalysis,
  type PaymentMethodsAnalysis,
  type EnhancedCashFlow,
  type CashFlowMonthly,
} from '@/services/api'

const loading = ref(true)
const error = ref<string | null>(null)

const today = new Date()
const firstOfYear = new Date(today.getFullYear(), 0, 1)
const dateFrom = ref(firstOfYear.toISOString().slice(0, 10))
const dateTo = ref(today.toISOString().slice(0, 10))

const kpis = ref<AnalyticsKpis | null>(null)
const channelsData = ref<ChannelAnalysis[]>([])
const months = ref<RevenueByMonth[]>([])
const ranking = ref<PropertyRanking[]>([])
const cashflow = ref<EnhancedCashFlow | null>(null)
const paymentMethods = ref<PaymentMethodsAnalysis | null>(null)

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD' }).format(value)
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

function marginClass(value: number): string {
  return value >= 0 ? 'text--positive' : 'text--negative'
}

const MONTH_NAMES: Record<string, string> = {
  '01': 'Ene',
  '02': 'Feb',
  '03': 'Mar',
  '04': 'Abr',
  '05': 'May',
  '06': 'Jun',
  '07': 'Jul',
  '08': 'Ago',
  '09': 'Sep',
  '10': 'Oct',
  '11': 'Nov',
  '12': 'Dic',
}

function formatMonth(ym: string): string {
  const parts = ym.split('-')
  if (parts.length === 2) {
    const monthKey = parts[1] as string
    const yearStr = parts[0] as string
    return `${MONTH_NAMES[monthKey] ?? monthKey} ${yearStr}`
  }
  return ym
}

function maxCashflowValue(monthly: CashFlowMonthly[]): number {
  let max = 0
  for (const m of monthly) {
    if (Math.abs(m.income_received) > max) max = Math.abs(m.income_received)
    if (Math.abs(m.payments_made) > max) max = Math.abs(m.payments_made)
  }
  return max || 1
}

const PAYMENT_METHOD_COLORS = [
  'var(--color-primary)',
  'var(--color-accent)',
  'var(--color-success)',
  'var(--color-info)',
  'var(--color-warning)',
  'var(--color-error)',
  '#8e7cc3',
  '#6fa8dc',
]

async function fetchAll() {
  loading.value = true
  error.value = null
  try {
    const from = dateFrom.value
    const to = dateTo.value
    const [kpisData, chData, monthsData, rankingData, cashflowData, pmData] = await Promise.all([
      analyticsApi.getKpis(from, to),
      analyticsApi.getChannels(from, to),
      analyticsApi.getRevenueByMonth(new Date(from).getFullYear()),
      analyticsApi.getPropertiesRanking(from, to),
      analyticsApi.getCashFlow(6, from, to),
      analyticsApi.getPaymentMethods(from, to),
    ])
    kpis.value = kpisData
    channelsData.value = chData
    months.value = monthsData
    ranking.value = rankingData.sort((a: PropertyRanking, b: PropertyRanking) => b.net_margin - a.net_margin)
    cashflow.value = cashflowData
    paymentMethods.value = pmData
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
      <!-- KPIs - 4x2 grid -->
      <div class="kpi-grid">
        <div class="kpi-card card">
          <span class="kpi-card__label">Ingresos totales</span>
          <span class="kpi-card__value">{{ formatCurrency(kpis.total_revenue) }}</span>
        </div>
        <div class="kpi-card card">
          <span class="kpi-card__label">Margen bruto %</span>
          <span class="kpi-card__value" :class="marginClass(kpis.gross_margin_percent)">
            {{ formatPercent(kpis.gross_margin_percent) }}
          </span>
        </div>
        <div class="kpi-card card">
          <span class="kpi-card__label">Ocupacion %</span>
          <span class="kpi-card__value">{{ formatPercent(kpis.avg_occupancy) }}</span>
        </div>
        <div class="kpi-card card">
          <span class="kpi-card__label">Tarifa promedio / noche</span>
          <span class="kpi-card__value">{{ formatCurrency(kpis.avg_nightly_rate) }}</span>
        </div>
        <div class="kpi-card card">
          <span class="kpi-card__label">Reservas totales</span>
          <span class="kpi-card__value">{{ kpis.total_bookings }}</span>
        </div>
        <div class="kpi-card card">
          <span class="kpi-card__label">Comision promedio %</span>
          <span class="kpi-card__value">{{ formatPercent(kpis.avg_commission_rate) }}</span>
        </div>
        <div class="kpi-card card">
          <span class="kpi-card__label">Eficiencia de cobro %</span>
          <span class="kpi-card__value">{{ formatPercent(kpis.collection_efficiency) }}</span>
        </div>
        <div class="kpi-card card">
          <span class="kpi-card__label">Mejor propiedad</span>
          <span class="kpi-card__value kpi-card__value--text">
            {{ kpis.top_property?.name || '--' }}
          </span>
        </div>
      </div>

      <!-- Channel Analysis Section (HS-42) -->
      <div class="card analytics__section">
        <h3 class="analytics__section-title">Analisis por canal</h3>
        <div v-if="channelsData.length === 0" class="analytics__empty">Sin datos de canales.</div>
        <template v-else>
          <!-- Bar chart: revenue + commission overlay -->
          <div class="bar-chart">
            <div v-for="ch in channelsData" :key="ch.channel" class="bar-chart__row bar-chart__row--dual">
              <span class="bar-chart__label">{{ ch.channel }}</span>
              <div class="bar-chart__track">
                <div
                  class="bar-chart__bar bar-chart__bar--revenue"
                  :style="{ width: ch.market_share_percent + '%' }"
                ></div>
                <div
                  v-if="ch.total_revenue > 0"
                  class="bar-chart__bar bar-chart__bar--commission"
                  :style="{ width: (ch.total_commission / (channelsData[0]?.total_revenue || 1)) * 100 + '%' }"
                ></div>
              </div>
              <span class="bar-chart__value">{{ formatCurrency(ch.net_revenue) }}</span>
              <span class="bar-chart__pct">{{ formatPercent(ch.market_share_percent) }}</span>
            </div>
          </div>
          <div class="analytics__legend">
            <span class="analytics__legend-item">
              <span class="analytics__legend-dot analytics__legend-dot--revenue"></span>
              Ingresos
            </span>
            <span class="analytics__legend-item">
              <span class="analytics__legend-dot analytics__legend-dot--commission"></span>
              Comisiones
            </span>
          </div>
          <!-- Channel table -->
          <div class="table-wrapper analytics__table-mt">
            <table>
              <thead>
                <tr>
                  <th>Canal</th>
                  <th>Reservas</th>
                  <th>Ingresos</th>
                  <th>Comisiones</th>
                  <th>Ingreso neto</th>
                  <th>% mercado</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="ch in channelsData" :key="'tbl-' + ch.channel">
                  <td class="text--bold">{{ ch.channel }}</td>
                  <td>{{ ch.bookings_count }}</td>
                  <td>{{ formatCurrency(ch.total_revenue) }}</td>
                  <td>{{ formatCurrency(ch.total_commission) }}</td>
                  <td :class="marginClass(ch.net_revenue)">{{ formatCurrency(ch.net_revenue) }}</td>
                  <td>{{ formatPercent(ch.market_share_percent) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </div>

      <!-- Payment Methods Section (HS-43) -->
      <div class="card analytics__section">
        <h3 class="analytics__section-title">Metodos de pago</h3>
        <div v-if="!paymentMethods || paymentMethods.overall.length === 0" class="analytics__empty">
          Sin datos de metodos de pago.
        </div>
        <template v-else>
          <!-- Horizontal bars -->
          <div class="bar-chart">
            <div
              v-for="(pm, idx) in paymentMethods.overall"
              :key="pm.payment_method"
              class="bar-chart__row"
            >
              <span class="bar-chart__label">{{ pm.payment_method }}</span>
              <div class="bar-chart__track">
                <div
                  class="bar-chart__bar"
                  :style="{
                    width: pm.percentage_of_total + '%',
                    background: PAYMENT_METHOD_COLORS[idx % PAYMENT_METHOD_COLORS.length],
                  }"
                ></div>
              </div>
              <span class="bar-chart__value">{{ formatCurrency(pm.total_amount) }}</span>
              <span class="bar-chart__pct">{{ formatPercent(pm.percentage_of_total) }}</span>
            </div>
          </div>

          <!-- Payment methods table -->
          <div class="table-wrapper analytics__table-mt">
            <table>
              <thead>
                <tr>
                  <th>Metodo</th>
                  <th>Cantidad</th>
                  <th>Monto total</th>
                  <th>% del total</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="pm in paymentMethods.overall" :key="'pm-tbl-' + pm.payment_method">
                  <td class="text--bold">{{ pm.payment_method }}</td>
                  <td>{{ pm.count }}</td>
                  <td>{{ formatCurrency(pm.total_amount) }}</td>
                  <td>{{ formatPercent(pm.percentage_of_total) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </div>

      <!-- Cash Flow Section (HS-44 enhanced) -->
      <div class="card analytics__section">
        <h3 class="analytics__section-title">Flujo de caja</h3>
        <div v-if="!cashflow || cashflow.monthly.length === 0" class="analytics__empty">
          Sin datos de flujo de caja.
        </div>
        <template v-else>
          <!-- Monthly bar chart -->
          <div class="cashflow-chart">
            <div
              v-for="m in cashflow.monthly"
              :key="m.month"
              class="cashflow-chart__col"
              :class="{ 'cashflow-chart__col--future': m.is_future }"
            >
              <div class="cashflow-chart__bars">
                <div
                  class="cashflow-chart__bar cashflow-chart__bar--income"
                  :style="{ height: (m.income_received / maxCashflowValue(cashflow!.monthly)) * 100 + '%' }"
                  :title="'Cobros: ' + formatCurrency(m.income_received)"
                ></div>
                <div
                  class="cashflow-chart__bar cashflow-chart__bar--expense"
                  :style="{ height: (m.payments_made / maxCashflowValue(cashflow!.monthly)) * 100 + '%' }"
                  :title="'Pagos: ' + formatCurrency(m.payments_made)"
                ></div>
              </div>
              <span class="cashflow-chart__label">{{ formatMonth(m.month) }}</span>
              <span class="cashflow-chart__net" :class="marginClass(m.net_flow)">
                {{ formatCurrency(m.net_flow) }}
              </span>
            </div>
          </div>
          <div class="analytics__legend">
            <span class="analytics__legend-item">
              <span class="analytics__legend-dot analytics__legend-dot--income"></span>
              Cobros
            </span>
            <span class="analytics__legend-item">
              <span class="analytics__legend-dot analytics__legend-dot--expense"></span>
              Pagos
            </span>
            <span class="analytics__legend-item">
              <span class="analytics__legend-dot analytics__legend-dot--future"></span>
              Proyeccion
            </span>
          </div>

          <!-- Cash flow table -->
          <div class="table-wrapper analytics__table-mt">
            <table>
              <thead>
                <tr>
                  <th>Mes</th>
                  <th>Cobros</th>
                  <th>Pagos</th>
                  <th>Flujo neto</th>
                  <th>Balance acumulado</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="m in cashflow.monthly"
                  :key="'cf-' + m.month"
                  :class="{ 'row--future': m.is_future }"
                >
                  <td class="text--bold">{{ formatMonth(m.month) }}</td>
                  <td>{{ formatCurrency(m.income_received) }}</td>
                  <td>{{ formatCurrency(m.payments_made) }}</td>
                  <td :class="marginClass(m.net_flow)">{{ formatCurrency(m.net_flow) }}</td>
                  <td :class="marginClass(m.running_balance)">{{ formatCurrency(m.running_balance) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
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
              <td>{{ formatMonth(m.month) }}</td>
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

.analytics__table-mt {
  margin-top: 20px;
}

/* Legend */
.analytics__legend {
  display: flex;
  gap: 20px;
  margin-top: 12px;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.analytics__legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.analytics__legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  flex-shrink: 0;
}

.analytics__legend-dot--revenue {
  background: var(--color-primary);
}

.analytics__legend-dot--commission {
  background: var(--color-accent);
}

.analytics__legend-dot--income {
  background: var(--color-success);
}

.analytics__legend-dot--expense {
  background: var(--color-error);
}

.analytics__legend-dot--future {
  background: var(--color-background-mute);
  border: 2px dashed var(--color-border);
}

/* KPI grid - 4x2 */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
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
  font-size: 1.1rem;
}

/* Margin colors */
.text--positive {
  color: var(--color-success);
}

.text--negative {
  color: var(--color-error);
}

.text--bold {
  font-weight: 600;
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
  position: relative;
}

.bar-chart__bar {
  height: 100%;
  border-radius: var(--radius-sm);
  min-width: 4px;
  transition: width 0.4s ease;
}

.bar-chart__bar--revenue {
  background: var(--color-primary);
  position: absolute;
  top: 0;
  left: 0;
}

.bar-chart__bar--commission {
  background: var(--color-accent);
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  opacity: 0.8;
}

.bar-chart__row--dual .bar-chart__track {
  position: relative;
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

/* Cash flow chart */
.cashflow-chart {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  min-height: 200px;
  padding: 16px 0;
  overflow-x: auto;
}

.cashflow-chart__col {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  min-width: 70px;
}

.cashflow-chart__col--future {
  opacity: 0.6;
}

.cashflow-chart__bars {
  display: flex;
  gap: 4px;
  align-items: flex-end;
  height: 140px;
}

.cashflow-chart__bar {
  width: 20px;
  min-height: 2px;
  border-radius: 3px 3px 0 0;
  transition: height 0.4s ease;
}

.cashflow-chart__bar--income {
  background: var(--color-success);
}

.cashflow-chart__bar--expense {
  background: var(--color-error);
}

.cashflow-chart__col--future .cashflow-chart__bar--income {
  background: var(--color-success-light);
  opacity: 0.5;
}

.cashflow-chart__col--future .cashflow-chart__bar--expense {
  background: var(--color-error-light);
  opacity: 0.5;
}

.cashflow-chart__label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-top: 6px;
}

.cashflow-chart__net {
  font-size: 0.7rem;
  font-weight: 700;
}

.row--future {
  opacity: 0.6;
  font-style: italic;
}

@media (max-width: 1200px) {
  .kpi-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .kpi-grid {
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
