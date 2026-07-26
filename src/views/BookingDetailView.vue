<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { laravelApi, type Booking } from '@/services/api'

const route = useRoute()
const bookingId = computed(() => Number(route.params.id))

const booking = ref<Booking | null>(null)
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
    case 'owner_booking':
    case 'not_available':
      return 'badge--neutral'
    default:
      return 'badge--info'
  }
}

// Detail data from raw_data._detail
const detail = computed(() => {
  if (!booking.value?.raw_data?._detail) return null
  return booking.value.raw_data._detail as Record<string, string>
})

const hasDetail = computed(() => detail.value !== null)

// Currency code to ISO mapping
function currencyFromCode(code: string | undefined): string {
  if (!code) return 'USD'
  switch (code) {
    case '840': return 'USD'
    case '978': return 'EUR'
    case '032': return 'ARS'
    default: return 'USD'
  }
}

// Guest breakdown from _detail
const guestBreakdown = computed(() => {
  if (!detail.value) return null
  const adults = detail.value['_t_Adults']
  const children = detail.value['_t_Children']
  const babies = detail.value['_t_Babies']
  if (!adults && !children && !babies) return null
  const parts: string[] = []
  if (adults && adults !== '0') parts.push(`${adults} adulto${adults === '1' ? '' : 's'}`)
  if (children && children !== '0') parts.push(`${children} ni\u00f1o${children === '1' ? '' : 's'}`)
  if (babies && babies !== '0') parts.push(`${babies} beb\u00e9${babies === '1' ? '' : 's'}`)
  return parts.join(', ')
})

// Economic breakdown
interface BreakdownLine {
  label: string
  value: string
  isTotal?: boolean
}

const economicBreakdown = computed((): BreakdownLine[] => {
  if (!detail.value) return []
  const lines: BreakdownLine[] = []
  if (detail.value['_t_Property']) {
    lines.push({ label: 'Alojamiento', value: detail.value['_t_Property'] })
  }
  if (detail.value['_t_Total extras']) {
    lines.push({ label: 'Extras', value: detail.value['_t_Total extras'] })
  }
  if (detail.value['_t_TOTAL']) {
    lines.push({ label: 'Total', value: detail.value['_t_TOTAL'], isTotal: true })
  }
  return lines
})

// Payment info
interface PaymentInfo {
  amount: string
  currency: string
  status: string
}

const payments = computed((): PaymentInfo[] => {
  if (!detail.value) return []
  const result: PaymentInfo[] = []
  for (let i = 1; i <= 5; i++) {
    const amount = detail.value[`amountHiddenCompPop${i}`]
    if (amount && parseFloat(amount) > 0) {
      const currCode = detail.value[`currencyPago${i}`]
      const currency = currencyFromCode(currCode)
      const paid = detail.value[`pagoRealizado${i}`]
      result.push({
        amount: formatAmount(amount, currency),
        currency,
        status: paid === '1' ? 'Pagado' : 'Pendiente',
      })
    }
  }
  return result
})

const rawDataEntries = computed(() => {
  if (!booking.value?.raw_data) return []
  return Object.entries(booking.value.raw_data).filter(([key]) => key !== '_detail')
})

async function fetchBooking() {
  loading.value = true
  error.value = null
  try {
    booking.value = await laravelApi.getBooking(bookingId.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar reserva'
  } finally {
    loading.value = false
  }
}

onMounted(fetchBooking)
</script>

<template>
  <div class="detail">
    <!-- Loading -->
    <div v-if="loading" class="detail__loading card">
      <span class="spinner spinner--large"></span>
      <p>Cargando reserva...</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="detail__error card">
      <p class="detail__error-text">{{ error }}</p>
      <button class="btn btn--primary" @click="fetchBooking">Reintentar</button>
    </div>

    <!-- Content -->
    <template v-else-if="booking">
      <!-- Header -->
      <div class="detail__header">
        <RouterLink to="/reservas" class="detail__back">&larr; Volver a reservas</RouterLink>
        <div class="detail__title-row">
          <h2 class="detail__heading">
            Reserva #{{ booking.avantio_reference || booking.avantio_id || booking.id }}
          </h2>
          <span class="badge" :class="statusClass(booking.status)">
            {{ booking.status || '--' }}
          </span>
        </div>
      </div>

      <!-- Info card -->
      <div class="card detail__section">
        <h3 class="detail__section-title">Informaci&oacute;n de la reserva</h3>
        <div class="detail__grid">
          <div class="detail__field">
            <span class="detail__label">Propiedad</span>
            <span class="detail__value">
              <RouterLink v-if="booking.property" :to="`/propiedades/${booking.property.id}`">
                {{ booking.property.name }}
              </RouterLink>
              <span v-else>--</span>
            </span>
          </div>
          <div class="detail__field">
            <span class="detail__label">Canal</span>
            <span class="detail__value">{{ booking.channel || '--' }}</span>
          </div>
          <div class="detail__field">
            <span class="detail__label">Referencia Avantio</span>
            <span class="detail__value">
              <code>{{ booking.avantio_reference || booking.avantio_id || '--' }}</code>
            </span>
          </div>
          <div v-if="detail?.record" class="detail__field">
            <span class="detail__label">Registro</span>
            <span class="detail__value">
              <code>{{ detail.record }}</code>
            </span>
          </div>
          <div class="detail__field">
            <span class="detail__label">Check-in</span>
            <span class="detail__value">{{ detail?.fechaEntrada ? formatDate(detail.fechaEntrada) : formatDate(booking.check_in) }}</span>
          </div>
          <div class="detail__field">
            <span class="detail__label">Check-out</span>
            <span class="detail__value">{{ detail?.fechaSalida ? formatDate(detail.fechaSalida) : formatDate(booking.check_out) }}</span>
          </div>
          <div class="detail__field">
            <span class="detail__label">Noches</span>
            <span class="detail__value">{{ booking.nights ?? '--' }}</span>
          </div>
          <div class="detail__field">
            <span class="detail__label">Hu&eacute;spedes</span>
            <span class="detail__value">
              <span v-if="guestBreakdown">{{ guestBreakdown }}</span>
              <span v-else-if="booking.adults || booking.children">
                {{ booking.adults || 0 }} adultos{{ booking.children ? ` + ${booking.children} ni&ntilde;os` : '' }}
              </span>
              <span v-else>--</span>
            </span>
          </div>
          <div class="detail__field">
            <span class="detail__label">Monto total</span>
            <span class="detail__value detail__value--highlight">
              {{ formatAmount(booking.total_amount, booking.currency) }}
            </span>
          </div>
          <div class="detail__field">
            <span class="detail__label">Moneda</span>
            <span class="detail__value">{{ booking.currency || '--' }}</span>
          </div>
          <div class="detail__field">
            <span class="detail__label">Estado</span>
            <span class="detail__value">
              <span class="badge" :class="statusClass(booking.status)">
                {{ booking.status || '--' }}
              </span>
            </span>
          </div>
        </div>
      </div>

      <!-- Economic breakdown (from _detail) -->
      <div v-if="hasDetail && economicBreakdown.length > 0" class="card detail__section">
        <h3 class="detail__section-title">Desglose econ&oacute;mico</h3>
        <div class="detail__breakdown">
          <div
            v-for="line in economicBreakdown"
            :key="line.label"
            class="detail__breakdown-row"
            :class="{ 'detail__breakdown-row--total': line.isTotal }"
          >
            <span class="detail__breakdown-label">{{ line.label }}</span>
            <span class="detail__breakdown-value">{{ line.value }}</span>
          </div>
        </div>
      </div>

      <!-- Payment status (from _detail) -->
      <div v-if="hasDetail && payments.length > 0" class="card detail__section">
        <h3 class="detail__section-title">Estado de pagos</h3>
        <div class="detail__payments">
          <div v-for="(payment, idx) in payments" :key="idx" class="detail__payment-row">
            <div class="detail__field">
              <span class="detail__label">Monto</span>
              <span class="detail__value">{{ payment.amount }}</span>
            </div>
            <div class="detail__field">
              <span class="detail__label">Moneda</span>
              <span class="detail__value">{{ payment.currency }}</span>
            </div>
            <div class="detail__field">
              <span class="detail__label">Estado</span>
              <span class="detail__value">
                <span class="badge" :class="payment.status === 'Pagado' ? 'badge--success' : 'badge--warning'">
                  {{ payment.status }}
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- No detail data message -->
      <div v-if="!hasDetail" class="card detail__section detail__no-detail">
        <p class="detail__no-detail-text">
          No se encontraron datos detallados de Avantio para esta reserva.
        </p>
        <p class="detail__no-detail-hint">Importar detalle desde Avantio</p>
      </div>

      <!-- Datos importados (raw, excluding _detail) -->
      <div v-if="rawDataEntries.length > 0" class="card detail__section">
        <h3 class="detail__section-title">Datos importados</h3>
        <div class="detail__raw-data">
          <div v-for="[key, value] in rawDataEntries" :key="key" class="detail__raw-item">
            <span class="detail__raw-key">{{ key }}</span>
            <span class="detail__raw-value">{{ typeof value === 'object' ? JSON.stringify(value) : value }}</span>
          </div>
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

/* Economic breakdown */
.detail__breakdown {
  display: flex;
  flex-direction: column;
  gap: 0;
  max-width: 400px;
}

.detail__breakdown-row {
  display: flex;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid var(--color-border);
}

.detail__breakdown-row:last-child {
  border-bottom: none;
}

.detail__breakdown-row--total {
  background: var(--color-background-soft);
  border-radius: var(--radius-sm);
  border-bottom: none;
  margin-top: 4px;
}

.detail__breakdown-label {
  font-size: 0.9rem;
  color: var(--color-text-secondary);
}

.detail__breakdown-row--total .detail__breakdown-label {
  font-weight: 700;
  color: var(--color-text);
}

.detail__breakdown-value {
  font-size: 0.9rem;
  font-weight: 600;
}

.detail__breakdown-row--total .detail__breakdown-value {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--color-text);
}

/* Payment rows */
.detail__payments {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail__payment-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  padding: 12px 16px;
  background: var(--color-background-soft);
  border-radius: var(--radius-md);
}

/* No detail data */
.detail__no-detail {
  text-align: center;
  padding: 32px 24px;
}

.detail__no-detail-text {
  color: var(--color-text-secondary);
  font-size: 0.9rem;
  margin-bottom: 8px;
}

.detail__no-detail-hint {
  color: var(--color-primary);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}

.detail__no-detail-hint:hover {
  color: var(--color-primary-light);
}

/* Raw data */
.detail__raw-data {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail__raw-item {
  display: flex;
  gap: 12px;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  background: var(--color-background-soft);
}

.detail__raw-item:nth-child(even) {
  background: var(--color-background-mute);
}

.detail__raw-key {
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  min-width: 180px;
  flex-shrink: 0;
  font-family: monospace;
}

.detail__raw-value {
  font-size: 0.9rem;
  word-break: break-all;
}

.badge--neutral {
  background: var(--color-background-mute);
  color: var(--color-text-secondary);
}

code {
  font-size: 0.85rem;
  background: var(--color-background-mute);
  padding: 2px 6px;
  border-radius: 4px;
}
</style>
