<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import {
  laravelApi,
  analyticsApi,
  type Property,
  type Booking,
  type Purchase,
  type Expense,
  type PropertyProfitability,
} from '@/services/api'

const route = useRoute()
const propertyId = computed(() => Number(route.params.id))

const property = ref<Property | null>(null)
const bookings = ref<Booking[]>([])
const purchases = ref<Purchase[]>([])
const expenses = ref<Expense[]>([])
const profitability = ref<PropertyProfitability | null>(null)

const loading = ref(true)
const error = ref<string | null>(null)

function formatDate(d: string | null): string {
  if (!d) return '--'
  return new Date(d).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatAmount(amount: string | number | null, currency?: string | null): string {
  if (amount === null || amount === undefined) return '--'
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(num)) return String(amount)
  const curr = currency || 'EUR'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: curr }).format(num)
}

function statusClass(status: string | null): string {
  switch (status?.toLowerCase()) {
    case 'confirmed':
    case 'invoiced':
    case 'paid':
      return 'badge--success'
    case 'pre-booking':
    case 'pre_booking':
      return 'badge--warning'
    case 'cancelled':
      return 'badge--error'
    default:
      return 'badge--info'
  }
}

const totalPurchases = computed(() => {
  return purchases.value.reduce((sum, p) => sum + parseFloat(p.total || '0'), 0)
})

const totalExpenses = computed(() => {
  return expenses.value.reduce((sum, e) => sum + parseFloat(e.amount || '0'), 0)
})

async function fetchData() {
  loading.value = true
  error.value = null
  try {
    const [propResult, bookingsResult, purchasesResult, expensesResult] = await Promise.all([
      laravelApi.getProperty(propertyId.value),
      laravelApi.getBookings(),
      laravelApi.getPurchases({ property_id: propertyId.value }),
      laravelApi.getExpenses({ property_id: propertyId.value }),
    ])
    property.value = propResult
    bookings.value = (bookingsResult.data || []).filter(
      (b) => b.property_id === propertyId.value || b.property?.id === propertyId.value,
    )
    purchases.value = purchasesResult.data || []
    expenses.value = expensesResult.data || []

    // Fetch profitability (may fail if no data)
    try {
      profitability.value = await analyticsApi.getPropertyProfitability(propertyId.value)
    } catch {
      profitability.value = null
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar propiedad'
  } finally {
    loading.value = false
  }
}

onMounted(fetchData)
</script>

<template>
  <div class="detail">
    <!-- Loading -->
    <div v-if="loading" class="detail__loading card">
      <span class="spinner spinner--large"></span>
      <p>Cargando propiedad...</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="detail__error card">
      <p class="detail__error-text">{{ error }}</p>
      <button class="btn btn--primary" @click="fetchData">Reintentar</button>
    </div>

    <!-- Content -->
    <template v-else-if="property">
      <!-- Header -->
      <div class="detail__header">
        <RouterLink to="/propiedades" class="detail__back">&larr; Volver a propiedades</RouterLink>
        <div class="detail__title-row">
          <h2 class="detail__heading">{{ property.name }}</h2>
          <span v-if="property.avantio_id" class="detail__avantio-id">
            Avantio: {{ property.avantio_id }}
          </span>
          <span
            class="badge"
            :class="property.is_active ? 'badge--success' : 'badge--error'"
          >
            {{ property.is_active ? 'Activo' : 'Desactivado' }}
          </span>
        </div>
      </div>

      <!-- Info card -->
      <div class="card detail__section">
        <h3 class="detail__section-title">Información</h3>
        <div class="detail__grid">
          <div class="detail__field">
            <span class="detail__label">Tipo</span>
            <span class="detail__value">{{ property.type || '--' }}</span>
          </div>
          <div class="detail__field">
            <span class="detail__label">Ubicación</span>
            <span class="detail__value">{{ property.location || '--' }}</span>
          </div>
          <div class="detail__field">
            <span class="detail__label">Estado</span>
            <span class="detail__value">{{ property.is_active ? 'Activo' : 'Desactivado' }}</span>
          </div>
          <div class="detail__field">
            <span class="detail__label">ID Avantio</span>
            <span class="detail__value">
              <code>{{ property.avantio_id || '--' }}</code>
            </span>
          </div>
        </div>
      </div>

      <!-- Reservas -->
      <div class="card detail__section">
        <h3 class="detail__section-title">Reservas</h3>
        <div v-if="bookings.length === 0" class="detail__empty">
          No hay reservas para esta propiedad.
        </div>
        <div v-else class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Referencia</th>
                <th>Entrada</th>
                <th>Salida</th>
                <th>Huéspedes</th>
                <th>Canal</th>
                <th>Monto</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="booking in bookings" :key="booking.id">
                <td>
                  <RouterLink :to="`/reservas/${booking.id}`">
                    <code>{{ booking.avantio_reference || booking.avantio_id || '--' }}</code>
                  </RouterLink>
                </td>
                <td>{{ formatDate(booking.check_in) }}</td>
                <td>{{ formatDate(booking.check_out) }}</td>
                <td>
                  <span v-if="booking.adults || booking.children">
                    {{ booking.adults || 0 }} ad.{{ booking.children ? ` + ${booking.children} niños` : '' }}
                  </span>
                  <span v-else>--</span>
                </td>
                <td>{{ booking.channel || '--' }}</td>
                <td>{{ formatAmount(booking.total_amount, booking.currency) }}</td>
                <td>
                  <span class="badge" :class="statusClass(booking.status)">
                    {{ booking.status || '--' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Costes -->
      <div class="card detail__section">
        <h3 class="detail__section-title">Costes</h3>
        <div class="detail__costs-summary">
          <div class="detail__cost-box">
            <span class="detail__cost-label">Total compras</span>
            <span class="detail__cost-value">{{ formatAmount(totalPurchases) }}</span>
          </div>
          <div class="detail__cost-box">
            <span class="detail__cost-label">Total egresos</span>
            <span class="detail__cost-value">{{ formatAmount(totalExpenses) }}</span>
          </div>
        </div>

        <div v-if="purchases.length > 0" class="detail__subsection">
          <h4 class="detail__subsection-title">Compras recientes</h4>
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>N.o</th>
                  <th>Proveedor</th>
                  <th>Fecha</th>
                  <th>Total</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="purchase in purchases" :key="purchase.id">
                  <td><code>{{ purchase.purchase_number || '--' }}</code></td>
                  <td>{{ purchase.supplier_name || '--' }}</td>
                  <td>{{ formatDate(purchase.voucher_date) }}</td>
                  <td>{{ formatAmount(purchase.total, purchase.currency) }}</td>
                  <td>
                    <span class="badge" :class="purchase.payment_status === 'paid' ? 'badge--success' : 'badge--warning'">
                      {{ purchase.payment_status || '--' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="expenses.length > 0" class="detail__subsection">
          <h4 class="detail__subsection-title">Egresos recientes</h4>
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>N.o</th>
                  <th>Beneficiario</th>
                  <th>Tipo</th>
                  <th>Monto</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="expense in expenses" :key="expense.id">
                  <td><code>{{ expense.expense_number || '--' }}</code></td>
                  <td>{{ expense.beneficiary_name || '--' }}</td>
                  <td>{{ expense.expense_type || '--' }}</td>
                  <td>{{ formatAmount(expense.amount, expense.currency) }}</td>
                  <td>
                    <span class="badge" :class="expense.payment_status === 'paid' ? 'badge--success' : 'badge--warning'">
                      {{ expense.payment_status || '--' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="purchases.length === 0 && expenses.length === 0" class="detail__empty">
          No hay costes registrados para esta propiedad.
        </div>
      </div>

      <!-- Rentabilidad -->
      <div class="card detail__section">
        <h3 class="detail__section-title">Rentabilidad</h3>
        <div v-if="profitability" class="detail__grid detail__grid--3">
          <div class="detail__field">
            <span class="detail__label">Ingresos</span>
            <span class="detail__value detail__value--highlight">
              {{ formatAmount(profitability.gross_revenue) }}
            </span>
          </div>
          <div class="detail__field">
            <span class="detail__label">Costes directos</span>
            <span class="detail__value">{{ formatAmount(profitability.direct_costs) }}</span>
          </div>
          <div class="detail__field">
            <span class="detail__label">Margen bruto</span>
            <span class="detail__value">{{ formatAmount(profitability.gross_margin) }}</span>
          </div>
          <div class="detail__field">
            <span class="detail__label">Costes indirectos</span>
            <span class="detail__value">{{ formatAmount(profitability.indirect_costs) }}</span>
          </div>
          <div class="detail__field">
            <span class="detail__label">Margen neto</span>
            <span class="detail__value" :style="{ color: profitability.net_margin >= 0 ? 'var(--color-success)' : 'var(--color-error)' }">
              {{ formatAmount(profitability.net_margin) }}
            </span>
          </div>
          <div class="detail__field">
            <span class="detail__label">ROI</span>
            <span class="detail__value detail__value--highlight">
              {{ profitability.roi_percent.toFixed(1) }}%
            </span>
          </div>
        </div>
        <div v-else class="detail__empty">
          No hay datos de rentabilidad disponibles.
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.detail__loading,
.detail__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 48px;
  color: var(--color-text-secondary);
}

.detail__error-text {
  color: var(--color-error);
  font-weight: 500;
}

.detail__header {
  margin-bottom: 24px;
}

.detail__back {
  font-size: 0.9rem;
  color: var(--color-text-secondary);
  display: inline-block;
  margin-bottom: 12px;
}

.detail__back:hover {
  color: var(--color-primary);
}

.detail__title-row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.detail__heading {
  font-size: 1.6rem;
  font-weight: 700;
}

.detail__avantio-id {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  font-family: monospace;
  background: var(--color-background-mute);
  padding: 2px 8px;
  border-radius: 4px;
}

.detail__section {
  margin-bottom: 20px;
}

.detail__section-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border);
}

.detail__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.detail__grid--3 {
  grid-template-columns: repeat(3, 1fr);
}

.detail__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail__label {
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-secondary);
}

.detail__value {
  font-size: 1rem;
}

.detail__value--highlight {
  font-weight: 700;
  font-size: 1.1rem;
}

.detail__empty {
  color: var(--color-text-secondary);
  font-size: 0.9rem;
  padding: 16px 0;
}

.detail__costs-summary {
  display: flex;
  gap: 24px;
  margin-bottom: 20px;
}

.detail__cost-box {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 20px;
  background: var(--color-background-soft);
  border-radius: var(--radius-md);
}

.detail__cost-label {
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-secondary);
}

.detail__cost-value {
  font-size: 1.15rem;
  font-weight: 700;
}

.detail__subsection {
  margin-top: 20px;
}

.detail__subsection-title {
  font-size: 0.95rem;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--color-text-secondary);
}

code {
  font-size: 0.85rem;
  background: var(--color-background-mute);
  padding: 2px 6px;
  border-radius: 4px;
}
</style>
