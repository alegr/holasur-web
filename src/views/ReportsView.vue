<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { reportsApi, type GlobalPnl, type ProrationItem } from '@/services/api'

const loading = ref(true)
const error = ref<string | null>(null)

const today = new Date()
const firstOfYear = new Date(today.getFullYear(), 0, 1)
const dateFrom = ref(firstOfYear.toISOString().slice(0, 10))
const dateTo = ref(today.toISOString().slice(0, 10))

const pnl = ref<GlobalPnl | null>(null)

// Proration state
const prorationMethod = ref<string>('revenue')
const prorationMonth = ref(today.toISOString().slice(0, 7))
const prorationData = ref<ProrationItem[]>([])
const prorationTotal = ref(0)
const prorationLoading = ref(false)
const prorationError = ref<string | null>(null)

const methodLabels: Record<string, string> = {
  revenue: 'Facturacion',
  nights: 'Noches',
  equal: 'Igualitario',
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD' }).format(value)
}

function marginClass(value: number): string {
  return value >= 0 ? 'text--positive' : 'text--negative'
}

async function fetchData() {
  loading.value = true
  error.value = null
  try {
    pnl.value = await reportsApi.getGlobalPnl(dateFrom.value, dateTo.value)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Error al cargar datos'
  } finally {
    loading.value = false
  }
}

async function fetchProration() {
  prorationLoading.value = true
  prorationError.value = null
  try {
    const res = await reportsApi.getProration(prorationMonth.value, prorationMethod.value)
    prorationData.value = res.data
    prorationTotal.value = res.total_structural
  } catch (e: unknown) {
    prorationError.value = e instanceof Error ? e.message : 'Error al cargar prorrateo'
  } finally {
    prorationLoading.value = false
  }
}

onMounted(() => {
  fetchData()
  fetchProration()
})
watch([dateFrom, dateTo], fetchData)
watch([prorationMonth, prorationMethod], fetchProration)
</script>

<template>
  <div class="reports">
    <div class="reports__header">
      <div>
        <h2 class="reports__heading">Reportes - Estado de Resultados</h2>
        <p class="reports__subtitle">P&L global de la empresa</p>
      </div>
      <div class="reports__filters">
        <label class="reports__filter-label">
          Desde
          <input type="date" v-model="dateFrom" class="input" />
        </label>
        <label class="reports__filter-label">
          Hasta
          <input type="date" v-model="dateTo" class="input" />
        </label>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="reports__status card">
      <span class="spinner spinner--large"></span>
      <p>Cargando...</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="reports__status card">
      <p class="reports__error-text">{{ error }}</p>
      <button class="btn btn--primary" @click="fetchData">Reintentar</button>
    </div>

    <template v-else-if="pnl">
      <!-- P&L Summary Cards -->
      <div class="pnl-summary">
        <div class="pnl-card card">
          <span class="pnl-card__label">Ingresos brutos</span>
          <span class="pnl-card__value">{{ formatCurrency(pnl.revenue.gross_revenue) }}</span>
          <span class="pnl-card__sub">{{ pnl.revenue.total_bookings }} reservas</span>
        </div>
        <div class="pnl-card card">
          <span class="pnl-card__label">Comisiones plataforma</span>
          <span class="pnl-card__value text--negative">{{ formatCurrency(pnl.costs.platform_commissions) }}</span>
        </div>
        <div class="pnl-card card">
          <span class="pnl-card__label">Margen bruto</span>
          <span class="pnl-card__value" :class="marginClass(pnl.margin.gross_margin)">
            {{ formatCurrency(pnl.margin.gross_margin) }}
          </span>
        </div>
        <div class="pnl-card card">
          <span class="pnl-card__label">Costos directos</span>
          <span class="pnl-card__value text--negative">{{ formatCurrency(pnl.costs.direct_costs) }}</span>
        </div>
        <div class="pnl-card card">
          <span class="pnl-card__label">Costos estructurales</span>
          <span class="pnl-card__value text--negative">{{ formatCurrency(pnl.costs.structural_costs) }}</span>
        </div>
        <div class="pnl-card card pnl-card--highlight">
          <span class="pnl-card__label">Margen neto</span>
          <span class="pnl-card__value" :class="marginClass(pnl.margin.net_margin)">
            {{ formatCurrency(pnl.margin.net_margin) }}
          </span>
          <span class="pnl-card__sub" :class="marginClass(pnl.margin.margin_percent)">
            {{ pnl.margin.margin_percent.toFixed(1) }}%
          </span>
        </div>
      </div>

      <!-- P&L Statement Table -->
      <div class="card reports__section">
        <h3 class="reports__section-title">Estado de Resultados</h3>
        <table class="pnl-table">
          <tbody>
            <tr class="pnl-table__header">
              <td colspan="2">Ingresos</td>
            </tr>
            <tr class="pnl-table__row pnl-table__row--indent">
              <td>Ingresos brutos ({{ pnl.revenue.total_bookings }} reservas)</td>
              <td class="pnl-table__amount">{{ formatCurrency(pnl.revenue.gross_revenue) }}</td>
            </tr>

            <tr class="pnl-table__header">
              <td colspan="2">Costos variables</td>
            </tr>
            <tr class="pnl-table__row pnl-table__row--indent">
              <td>Comisiones de plataforma</td>
              <td class="pnl-table__amount pnl-table__amount--cost">{{ formatCurrency(pnl.costs.platform_commissions) }}</td>
            </tr>
            <tr class="pnl-table__row pnl-table__row--subtotal">
              <td>Margen bruto</td>
              <td class="pnl-table__amount" :class="marginClass(pnl.margin.gross_margin)">
                {{ formatCurrency(pnl.margin.gross_margin) }}
              </td>
            </tr>

            <tr class="pnl-table__header">
              <td colspan="2">Costos operativos</td>
            </tr>
            <tr class="pnl-table__row pnl-table__row--indent">
              <td>Costos directos (propiedades y reservas)</td>
              <td class="pnl-table__amount pnl-table__amount--cost">{{ formatCurrency(pnl.costs.direct_costs) }}</td>
            </tr>
            <tr class="pnl-table__row pnl-table__row--subtotal">
              <td>Margen operativo</td>
              <td class="pnl-table__amount" :class="marginClass(pnl.margin.operating_margin)">
                {{ formatCurrency(pnl.margin.operating_margin) }}
              </td>
            </tr>

            <tr class="pnl-table__header">
              <td colspan="2">Costos estructurales</td>
            </tr>
            <tr class="pnl-table__row pnl-table__row--indent">
              <td>Costos de estructura</td>
              <td class="pnl-table__amount pnl-table__amount--cost">{{ formatCurrency(pnl.costs.structural_costs) }}</td>
            </tr>
            <tr class="pnl-table__row pnl-table__row--total">
              <td>Margen neto</td>
              <td class="pnl-table__amount" :class="marginClass(pnl.margin.net_margin)">
                {{ formatCurrency(pnl.margin.net_margin) }}
                <small>({{ pnl.margin.margin_percent.toFixed(1) }}%)</small>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Revenue by Channel -->
      <div class="card reports__section">
        <h3 class="reports__section-title">Ingresos por canal</h3>
        <div v-if="pnl.revenue.by_channel.length === 0" class="reports__empty">Sin datos de canales.</div>
        <div v-else class="bar-chart">
          <div v-for="ch in pnl.revenue.by_channel" :key="ch.channel" class="bar-chart__row">
            <span class="bar-chart__label">{{ ch.channel }}</span>
            <div class="bar-chart__track">
              <div
                class="bar-chart__bar"
                :style="{
                  width: Math.max(
                    (ch.total / Math.max(...pnl.revenue.by_channel.map(c => c.total))) * 100,
                    4
                  ) + '%'
                }"
              ></div>
            </div>
            <span class="bar-chart__value">{{ formatCurrency(ch.total) }}</span>
            <span class="bar-chart__count">{{ ch.count }} res.</span>
          </div>
        </div>
      </div>

      <!-- Costs by Category -->
      <div class="card reports__section">
        <h3 class="reports__section-title">Costos por categoria</h3>
        <div v-if="pnl.costs.by_category.length === 0" class="reports__empty">Sin datos de categorias.</div>
        <div v-else class="bar-chart">
          <div v-for="cat in pnl.costs.by_category" :key="cat.category" class="bar-chart__row">
            <span class="bar-chart__label">{{ cat.category }}</span>
            <div class="bar-chart__track">
              <div
                class="bar-chart__bar bar-chart__bar--cost"
                :style="{
                  width: Math.max(
                    (cat.total / Math.max(...pnl.costs.by_category.map(c => c.total))) * 100,
                    4
                  ) + '%'
                }"
              ></div>
            </div>
            <span class="bar-chart__value">{{ formatCurrency(cat.total) }}</span>
          </div>
        </div>
      </div>

      <!-- Properties Ranking by Margin -->
      <div class="card reports__section table-wrapper">
        <h3 class="reports__section-title">Propiedades por margen</h3>
        <div v-if="pnl.properties.length === 0" class="reports__empty">Sin datos de propiedades.</div>
        <table v-else>
          <thead>
            <tr>
              <th>Propiedad</th>
              <th>Ingresos</th>
              <th>Costos</th>
              <th>Margen</th>
              <th>Reservas</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in pnl.properties" :key="p.id">
              <td>
                <RouterLink :to="`/propiedades/${p.id}`" class="reports__property-link">
                  {{ p.name }}
                </RouterLink>
              </td>
              <td>{{ formatCurrency(p.revenue) }}</td>
              <td class="text--negative">{{ formatCurrency(p.costs) }}</td>
              <td :class="marginClass(p.margin)">{{ formatCurrency(p.margin) }}</td>
              <td>{{ p.bookings_count }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- Proration Section -->
    <div class="card reports__section">
      <div class="proration__header">
        <h3 class="reports__section-title">Prorrateo de costos estructurales</h3>
        <div class="proration__controls">
          <label class="reports__filter-label">
            Metodo
            <select v-model="prorationMethod" class="input">
              <option value="revenue">Facturacion</option>
              <option value="nights">Noches</option>
              <option value="equal">Igualitario</option>
            </select>
          </label>
          <label class="reports__filter-label">
            Mes
            <input type="month" v-model="prorationMonth" class="input" />
          </label>
        </div>
      </div>

      <div v-if="prorationLoading" class="reports__status" style="padding: 24px">
        <span class="spinner"></span>
        <p>Cargando prorrateo...</p>
      </div>

      <div v-else-if="prorationError" class="reports__status" style="padding: 24px">
        <p class="reports__error-text">{{ prorationError }}</p>
        <button class="btn btn--primary" @click="fetchProration">Reintentar</button>
      </div>

      <template v-else>
        <p class="proration__total">
          Total costos estructurales ({{ prorationMonth }}):
          <strong>{{ formatCurrency(prorationTotal) }}</strong>
          &mdash; Metodo: <strong>{{ methodLabels[prorationMethod] }}</strong>
        </p>
        <div v-if="prorationData.length === 0" class="reports__empty">
          Sin propiedades activas para este mes.
        </div>
        <div v-else class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Propiedad</th>
                <th>% Participacion</th>
                <th>Monto asignado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in prorationData" :key="item.property_id">
                <td class="proration__property">{{ item.property_name }}</td>
                <td>{{ item.share_percent.toFixed(2) }}%</td>
                <td>{{ formatCurrency(item.allocated_amount) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.reports__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.reports__heading {
  font-size: 1.6rem;
  font-weight: 700;
  margin-bottom: 4px;
}

.reports__subtitle {
  color: var(--color-text-secondary);
  font-size: 0.9rem;
}

.reports__filters {
  display: flex;
  gap: 16px;
  align-items: flex-end;
}

.reports__filter-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.reports__status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 48px;
  color: var(--color-text-secondary);
}

.reports__error-text {
  color: var(--color-error);
  font-weight: 500;
}

.reports__section {
  margin-bottom: 24px;
}

.reports__section-title {
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 16px;
}

.reports__empty {
  text-align: center;
  padding: 24px;
  color: var(--color-text-secondary);
}

.reports__property-link {
  font-weight: 600;
}

/* P&L Summary cards */
.pnl-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.pnl-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 20px;
}

.pnl-card--highlight {
  border: 2px solid var(--color-primary);
}

.pnl-card__label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.pnl-card__value {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--color-heading);
}

.pnl-card__sub {
  font-size: 0.9rem;
  color: var(--color-text-secondary);
  font-weight: 600;
}

/* P&L statement table */
.pnl-table {
  width: 100%;
  max-width: 700px;
  border-collapse: collapse;
}

.pnl-table td {
  padding: 10px 14px;
  font-size: 0.95rem;
}

.pnl-table__header td {
  font-weight: 700;
  font-size: 1rem;
  padding-top: 20px;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--color-border);
  color: var(--color-heading);
}

.pnl-table__row--indent td:first-child {
  padding-left: 28px;
}

.pnl-table__row--subtotal {
  background: var(--color-background-soft);
  border-radius: var(--radius-sm);
}

.pnl-table__row--subtotal td {
  font-weight: 700;
}

.pnl-table__row--total {
  background: var(--color-background-mute);
  border-radius: var(--radius-sm);
}

.pnl-table__row--total td {
  font-weight: 700;
  font-size: 1.05rem;
  padding-top: 14px;
  padding-bottom: 14px;
}

.pnl-table__row--total td small {
  font-size: 0.85rem;
  font-weight: 500;
}

.pnl-table__amount {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.pnl-table__amount--cost {
  color: var(--color-error);
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

.bar-chart__bar--cost {
  background: var(--color-error);
  opacity: 0.7;
}

.bar-chart__value {
  font-size: 0.9rem;
  font-weight: 600;
  text-align: right;
}

.bar-chart__count {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  text-align: right;
}

/* Proration */
.proration__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.proration__controls {
  display: flex;
  gap: 16px;
  align-items: flex-end;
}

.proration__total {
  font-size: 0.95rem;
  color: var(--color-text-secondary);
  margin-bottom: 16px;
}

.proration__property {
  font-weight: 600;
}

@media (max-width: 768px) {
  .pnl-summary {
    grid-template-columns: 1fr;
  }

  .bar-chart__row {
    grid-template-columns: 80px 1fr 80px 40px;
    gap: 6px;
  }

  .bar-chart__label {
    font-size: 0.8rem;
  }

  .bar-chart__value {
    font-size: 0.8rem;
  }

  .bar-chart__count {
    font-size: 0.75rem;
  }

  .reports__header {
    flex-direction: column;
    gap: 12px;
  }

  .reports__heading {
    font-size: 1.3rem;
  }

  .reports__filters {
    flex-direction: column;
    width: 100%;
  }

  .pnl-card {
    padding: 14px;
  }

  .pnl-card__value {
    font-size: 1.2rem;
  }

  .reports__section {
    margin-bottom: 16px;
  }
}
</style>
