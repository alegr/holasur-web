<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { laravelApi, type Booking } from '@/services/api'
import ImportWidget from '@/components/ImportWidget.vue'

const bookings = ref<Booking[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const searchQuery = ref('')

const filteredBookings = computed(() => {
  if (!searchQuery.value.trim()) return bookings.value
  const q = searchQuery.value.toLowerCase()
  return bookings.value.filter(
    (b) =>
      b.avantio_reference?.toLowerCase().includes(q) ||
      b.avantio_id?.toLowerCase().includes(q) ||
      b.property?.name?.toLowerCase().includes(q) ||
      b.status?.toLowerCase().includes(q) ||
      b.channel?.toLowerCase().includes(q),
  )
})

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
      return ''
  }
}

function formatDate(d: string | null): string {
  if (!d) return '--'
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatAmount(amount: string | null, currency: string | null): string {
  if (!amount) return '--'
  const num = parseFloat(amount)
  if (isNaN(num)) return amount
  const curr = currency || 'EUR'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: curr }).format(num)
}

async function fetchBookings() {
  loading.value = true
  error.value = null
  try {
    const result = await laravelApi.getBookings()
    bookings.value = result.data || []
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar reservas'
  } finally {
    loading.value = false
  }
}

onMounted(fetchBookings)
</script>

<template>
  <div class="bookings">
    <ImportWidget entity="bookings" @imported="fetchBookings" />
    <div class="bookings__header">
      <div>
        <h2 class="bookings__heading">Reservas</h2>
        <p class="bookings__count" v-if="!loading && !error">
          Mostrando {{ filteredBookings.length }} reservas
        </p>
      </div>
      <div class="bookings__search">
        <input
          v-model="searchQuery"
          type="text"
          class="input"
          placeholder="Buscar por referencia, propiedad, canal..."
        />
      </div>
    </div>

    <div v-if="loading" class="bookings__loading card">
      <span class="spinner spinner--large"></span>
      <p>Cargando reservas...</p>
    </div>

    <div v-else-if="error" class="bookings__error card">
      <p class="bookings__error-text">{{ error }}</p>
      <button class="btn btn--primary" @click="fetchBookings">Reintentar</button>
    </div>

    <div v-else-if="filteredBookings.length === 0" class="bookings__empty card">
      <p v-if="searchQuery">No se encontraron reservas que coincidan con "{{ searchQuery }}"</p>
      <p v-else>No hay reservas importadas. Inicia una importación desde Avantio.</p>
      <RouterLink v-if="!searchQuery" to="/importar" class="btn btn--primary">
        Importar reservas
      </RouterLink>
    </div>

    <div v-else class="card table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Propiedad</th>
            <th>Referencia</th>
            <th>Entrada</th>
            <th>Salida</th>
            <th>Noches</th>
            <th>Huéspedes</th>
            <th>Canal</th>
            <th>Monto</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="booking in filteredBookings" :key="booking.id">
            <td>
              <strong>{{ booking.property?.name || '--' }}</strong>
            </td>
            <td>
              <RouterLink :to="`/reservas/${booking.id}`">
                <code>{{ booking.avantio_reference || booking.avantio_id || '--' }}</code>
              </RouterLink>
            </td>
            <td>{{ formatDate(booking.check_in) }}</td>
            <td>{{ formatDate(booking.check_out) }}</td>
            <td>{{ booking.nights || '--' }}</td>
            <td>
              <span v-if="booking.adults || booking.children">
                {{ booking.adults || 0 }} ad. {{ booking.children ? `+ ${booking.children} niños` : '' }}
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
</template>

<style scoped>
.bookings__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.bookings__heading {
  font-size: 1.6rem;
  font-weight: 700;
  margin-bottom: 4px;
}

.bookings__count {
  color: var(--color-text-secondary);
  font-size: 0.9rem;
}

.bookings__search .input {
  min-width: 300px;
}

.bookings__loading,
.bookings__error,
.bookings__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 48px;
  color: var(--color-text-secondary);
}

.bookings__error-text {
  color: var(--color-error);
  font-weight: 500;
}

.badge--neutral {
  background: var(--color-background-mute);
  color: var(--color-text-secondary);
}

.badge--warning {
  background: #fff3cd;
  color: #856404;
}

code {
  font-size: 0.85rem;
  background: var(--color-background-mute);
  padding: 2px 6px;
  border-radius: 4px;
}

@media (max-width: 768px) {
  .bookings__header {
    flex-direction: column;
    gap: 12px;
  }

  .bookings__heading {
    font-size: 1.3rem;
  }

  .bookings__search .input {
    min-width: 0;
    width: 100%;
  }
}
</style>
