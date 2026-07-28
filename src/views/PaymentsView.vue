<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { laravelApi, type AvantioPayment, type PaymentSummary } from '@/services/api'
import ImportWidget from '@/components/ImportWidget.vue'

type PaymentTab = 'received' | 'made' | 'pending' | 'outstanding'

const tabConfigs: { key: PaymentTab; label: string; entity: 'payments_received' | 'payments_made' | 'payments_pending' | 'payments_outstanding' }[] = [
  { key: 'received', label: 'Cobros recibidos', entity: 'payments_received' },
  { key: 'made', label: 'Pagos realizados', entity: 'payments_made' },
  { key: 'pending', label: 'Pagos pendientes', entity: 'payments_pending' },
  { key: 'outstanding', label: 'Cuentas por cobrar', entity: 'payments_outstanding' },
]

const activeTab = ref<PaymentTab>('received')
const payments = ref<AvantioPayment[]>([])
const summary = ref<PaymentSummary[]>([])
const loading = ref(true)
const summaryLoading = ref(true)
const error = ref<string | null>(null)
const searchQuery = ref('')
const dateFrom = ref('')
const dateTo = ref('')

const currentTabConfig = computed(() => tabConfigs.find((t) => t.key === activeTab.value)!)

function getSummaryForType(type: string): PaymentSummary | undefined {
  return summary.value.find((s) => s.payment_type === type)
}

const summaryCards = computed(() => [
  {
    key: 'received' as const,
    label: 'Cobros recibidos',
    color: '#22876b',
    bg: '#e4f3ed',
    icon: '\u25BC',
    data: getSummaryForType('received'),
  },
  {
    key: 'made' as const,
    label: 'Pagos realizados',
    color: '#3a8a9e',
    bg: '#e6f2f5',
    icon: '\u25B2',
    data: getSummaryForType('made'),
  },
  {
    key: 'pending' as const,
    label: 'Pagos pendientes',
    color: '#d4a853',
    bg: '#faf4e4',
    icon: '\u25CF',
    data: getSummaryForType('pending'),
  },
  {
    key: 'outstanding' as const,
    label: 'Cuentas por cobrar',
    color: '#c44b4b',
    bg: '#fbeaea',
    icon: '\u26A0',
    data: getSummaryForType('outstanding'),
  },
])

const filteredPayments = computed(() => {
  if (!searchQuery.value.trim()) return payments.value
  const q = searchQuery.value.toLowerCase()
  return payments.value.filter(
    (p) =>
      p.booking_reference?.toLowerCase().includes(q) ||
      p.property_code?.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q) ||
      p.counterpart?.toLowerCase().includes(q) ||
      p.payment_method?.toLowerCase().includes(q) ||
      p.state?.toLowerCase().includes(q),
  )
})

function formatDate(d: string | null): string {
  if (!d) return '--'
  return new Date(d).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatAmount(amount: string | null, currency: string | null): string {
  if (!amount) return '--'
  const num = parseFloat(amount)
  if (isNaN(num)) return amount
  const curr = currency || 'USD'
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: curr }).format(num)
}

function formatSummaryAmount(amount: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD' }).format(amount)
}

function stateClass(state: string | null): string {
  if (!state) return ''
  const s = state.toLowerCase()
  if (s.includes('pagado') || s.includes('cobrado') || s.includes('paid') || s.includes('completed')) return 'badge--success'
  if (s.includes('pendiente') || s.includes('pending')) return 'badge--warning'
  if (s.includes('cancelado') || s.includes('cancelled') || s.includes('anulado')) return 'badge--error'
  return 'badge--info'
}

async function fetchPayments() {
  loading.value = true
  error.value = null
  try {
    const result = await laravelApi.getPayments({
      payment_type: activeTab.value,
      from: dateFrom.value || undefined,
      to: dateTo.value || undefined,
    })
    payments.value = result.data || []
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar pagos'
  } finally {
    loading.value = false
  }
}

async function fetchSummary() {
  summaryLoading.value = true
  try {
    summary.value = await laravelApi.getPaymentsSummary(
      dateFrom.value || undefined,
      dateTo.value || undefined,
    )
  } catch {
    // Summary errors are non-blocking
  } finally {
    summaryLoading.value = false
  }
}

function switchTab(tab: PaymentTab) {
  activeTab.value = tab
  searchQuery.value = ''
  fetchPayments()
}

function onDateChange() {
  fetchPayments()
  fetchSummary()
}

function onImported() {
  fetchPayments()
  fetchSummary()
}

onMounted(() => {
  fetchPayments()
  fetchSummary()
})
</script>

<template>
  <div class="payments">
    <div class="payments__header">
      <div>
        <h2 class="payments__heading">Pagos</h2>
        <p class="payments__count" v-if="!loading && !error">
          Mostrando {{ filteredPayments.length }} registros
        </p>
      </div>
      <div class="payments__filters">
        <div class="payments__date-filter">
          <label class="payments__date-label">Desde</label>
          <input
            v-model="dateFrom"
            type="date"
            class="input"
            @change="onDateChange"
          />
        </div>
        <div class="payments__date-filter">
          <label class="payments__date-label">Hasta</label>
          <input
            v-model="dateTo"
            type="date"
            class="input"
            @change="onDateChange"
          />
        </div>
      </div>
    </div>

    <!-- Summary cards -->
    <div class="summary-grid">
      <div
        v-for="card in summaryCards"
        :key="card.key"
        class="summary-card"
        :style="{ borderLeftColor: card.color }"
      >
        <div class="summary-card__icon" :style="{ background: card.bg, color: card.color }">
          {{ card.icon }}
        </div>
        <div class="summary-card__content">
          <span class="summary-card__label">{{ card.label }}</span>
          <span class="summary-card__value" v-if="summaryLoading">...</span>
          <template v-else>
            <span class="summary-card__value">{{ card.data?.count ?? 0 }}</span>
            <span class="summary-card__total" :style="{ color: card.color }">
              {{ formatSummaryAmount(card.data?.total ?? 0) }}
            </span>
          </template>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="payments__tabs-row">
      <div class="payments__tabs">
        <button
          v-for="tab in tabConfigs"
          :key="tab.key"
          class="payments__tab"
          :class="{ 'payments__tab--active': activeTab === tab.key }"
          @click="switchTab(tab.key)"
        >
          {{ tab.label }}
        </button>
      </div>
      <div class="payments__tab-actions">
        <ImportWidget :entity="currentTabConfig.entity" @imported="onImported" />
      </div>
    </div>

    <!-- Search -->
    <div class="payments__search">
      <input
        v-model="searchQuery"
        type="text"
        class="input"
        placeholder="Buscar por referencia, propiedad, contraparte..."
      />
    </div>

    <!-- Loading -->
    <div v-if="loading" class="payments__status card">
      <span class="spinner spinner--large"></span>
      <p>Cargando pagos...</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="payments__status card">
      <p class="payments__error-text">{{ error }}</p>
      <button class="btn btn--primary" @click="fetchPayments">Reintentar</button>
    </div>

    <!-- Empty -->
    <div v-else-if="filteredPayments.length === 0" class="payments__status card">
      <p v-if="searchQuery">No se encontraron registros que coincidan con "{{ searchQuery }}"</p>
      <p v-else>No hay registros de {{ currentTabConfig.label.toLowerCase() }}.</p>
    </div>

    <!-- Table -->
    <div v-else class="card table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Referencia reserva</th>
            <th>Detalle / Propiedad</th>
            <th>Contraparte</th>
            <th>M&eacute;todo de pago</th>
            <th class="text-right">Monto</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="payment in filteredPayments" :key="payment.id">
            <td>{{ formatDate(payment.date) }}</td>
            <td>
              <code v-if="payment.booking_reference">{{ payment.booking_reference }}</code>
              <span v-else>--</span>
            </td>
            <td>
              <div>{{ payment.description || '--' }}</div>
              <small v-if="payment.property_code" class="text-secondary">
                {{ payment.property_code }}
              </small>
            </td>
            <td>{{ payment.counterpart || '--' }}</td>
            <td>{{ payment.payment_method || '--' }}</td>
            <td class="text-right">{{ formatAmount(payment.amount, payment.currency) }}</td>
            <td>
              <span
                v-if="payment.state"
                class="badge"
                :class="stateClass(payment.state)"
              >
                {{ payment.state }}
              </span>
              <span v-else>--</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.payments__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.payments__heading {
  font-size: 1.6rem;
  font-weight: 700;
  margin-bottom: 4px;
}

.payments__count {
  color: var(--color-text-secondary);
  font-size: 0.9rem;
}

.payments__filters {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.payments__date-filter {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.payments__date-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.payments__date-filter .input {
  width: 160px;
}

/* Summary cards */
.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 28px;
}

.summary-card {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 14px;
  border-left: 4px solid transparent;
}

.summary-card__icon {
  font-size: 1.4rem;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.summary-card__content {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.summary-card__label {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-bottom: 2px;
}

.summary-card__value {
  font-size: 1.3rem;
  font-weight: 700;
  line-height: 1.2;
}

.summary-card__total {
  font-size: 0.9rem;
  font-weight: 600;
}

/* Tabs */
.payments__tabs-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  gap: 16px;
  flex-wrap: wrap;
}

.payments__tabs {
  display: flex;
  gap: 0;
  border-bottom: 2px solid var(--color-border);
}

.payments__tab {
  padding: 12px 24px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
  white-space: nowrap;
}

.payments__tab:hover {
  color: var(--color-text);
}

.payments__tab--active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.payments__tab-actions {
  flex-shrink: 0;
}

/* Search */
.payments__search {
  margin-bottom: 20px;
}

.payments__search .input {
  min-width: 300px;
}

/* Status states */
.payments__status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 48px;
  color: var(--color-text-secondary);
}

.payments__error-text {
  color: var(--color-error);
  font-weight: 500;
}

/* Utility */
.text-right {
  text-align: right;
}

.text-secondary {
  color: var(--color-text-secondary);
}

code {
  font-size: 0.85rem;
  background: var(--color-background-mute);
  padding: 2px 6px;
  border-radius: 4px;
}

@media (max-width: 1100px) {
  .summary-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .payments__header {
    flex-direction: column;
    gap: 12px;
  }

  .payments__heading {
    font-size: 1.3rem;
  }

  .payments__filters {
    flex-direction: column;
    width: 100%;
  }

  .payments__date-filter .input {
    width: 100%;
  }

  .payments__tabs {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .payments__tab {
    padding: 10px 16px;
    font-size: 0.85rem;
  }

  .payments__tabs-row {
    flex-direction: column;
    align-items: stretch;
  }

  .payments__search .input {
    min-width: 0;
    width: 100%;
  }
}
</style>
