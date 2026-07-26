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

const rawDataEntries = computed(() => {
  if (!booking.value?.raw_data) return []
  return Object.entries(booking.value.raw_data)
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
        <h3 class="detail__section-title">Información</h3>
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
            <span class="detail__label">Check-in</span>
            <span class="detail__value">{{ formatDate(booking.check_in) }}</span>
          </div>
          <div class="detail__field">
            <span class="detail__label">Check-out</span>
            <span class="detail__value">{{ formatDate(booking.check_out) }}</span>
          </div>
          <div class="detail__field">
            <span class="detail__label">Noches</span>
            <span class="detail__value">{{ booking.nights ?? '--' }}</span>
          </div>
          <div class="detail__field">
            <span class="detail__label">Huéspedes</span>
            <span class="detail__value">
              <span v-if="booking.adults || booking.children">
                {{ booking.adults || 0 }} adultos{{ booking.children ? ` + ${booking.children} niños` : '' }}
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
          <div class="detail__field">
            <span class="detail__label">Referencia Avantio</span>
            <span class="detail__value">
              <code>{{ booking.avantio_reference || booking.avantio_id || '--' }}</code>
            </span>
          </div>
        </div>
      </div>

      <!-- Datos importados -->
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
