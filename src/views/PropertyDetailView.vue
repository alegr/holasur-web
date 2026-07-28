<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import {
  laravelApi,
  analyticsApi,
  importerApi,
  type Property,
  type Booking,
  type Purchase,
  type Expense,
  type PropertyProfitability,
} from '@/services/api'
import QuickCostWidget from '@/components/QuickCostWidget.vue'

const route = useRoute()
const propertyId = computed(() => Number(route.params.id))

const property = ref<Property | null>(null)
const bookings = ref<Booking[]>([])
const purchases = ref<Purchase[]>([])
const expenses = ref<Expense[]>([])
const profitability = ref<PropertyProfitability | null>(null)

const loading = ref(true)
const error = ref<string | null>(null)
const updating = ref(false)
const updateMessage = ref<string | null>(null)

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

// Detail data from raw_data._detail
const detail = computed(() => {
  const rd = property.value?.raw_data as Record<string, unknown> | null
  if (!rd?._detail) return null
  return rd._detail as Record<string, string>
})

const hasDetail = computed(() => detail.value !== null)

// Characteristics
const bedrooms = computed(() => {
  if (!detail.value) return []
  const result: { label: string; description: string }[] = []
  for (let i = 1; i <= 10; i++) {
    const key = `_t_Bedroom ${i}`
    const val = detail.value[key]
    if (val) {
      result.push({ label: `Dormitorio ${i}`, description: translateBedType(val) })
    }
  }
  return result
})

function translateBedType(bed: string): string {
  return bed
    .replace(/Double bed/gi, 'Cama doble')
    .replace(/Single bed/gi, 'Cama individual')
    .replace(/Sofa bed/gi, 'Sofa cama')
    .replace(/Bunk bed/gi, 'Litera')
    .replace(/King bed/gi, 'Cama king')
    .replace(/Queen bed/gi, 'Cama queen')
}

// Amenities
interface Amenity {
  label: string
  available: boolean
  value: string
}

const amenities = computed((): Amenity[] => {
  if (!detail.value) return []
  const mapping: { key: string; label: string }[] = [
    { key: '_t_Parking', label: 'Parking' },
    { key: '_t_Air conditioner', label: 'Aire acondicionado' },
    { key: '_t_Internet access', label: 'Internet' },
    { key: '_t_Bed linen', label: 'Ropa de cama' },
    { key: '_t_Towels', label: 'Toallas' },
    { key: '_t_Swimming pool', label: 'Piscina' },
    { key: '_t_Animals', label: 'Mascotas' },
  ]
  return mapping
    .filter((m) => detail.value![m.key] !== undefined)
    .map((m) => {
      const raw = detail.value![m.key] ?? ''
      const isAvailable = isAmenityAvailable(raw)
      return { label: m.label, available: isAvailable, value: raw }
    })
})

function isAmenityAvailable(val: string): boolean {
  const lower = val.toLowerCase().trim()
  return !(lower === 'no' || lower === 'none' || lower === '')
}

// Distances
interface Distance {
  label: string
  value: string
}

const distances = computed((): Distance[] => {
  if (!detail.value) return []
  const mapping: { key: string; label: string }[] = [
    { key: '_t_Distance to sandy beach', label: 'Playa de arena' },
    { key: '_t_Distance to rocky beach', label: 'Playa de rocas' },
    { key: '_t_Distance to town center', label: 'Centro de la ciudad' },
    { key: '_t_Distance to restaurant', label: 'Restaurante' },
    { key: '_t_Distance to shops', label: 'Tiendas' },
    { key: '_t_Distance to airport', label: 'Aeropuerto' },
    { key: '_t_Distance to bus stop', label: 'Parada de bus' },
    { key: '_t_Distance to supermarket', label: 'Supermercado' },
    { key: '_t_Distance to hospital', label: 'Hospital' },
  ]
  return mapping
    .filter((m) => detail.value![m.key])
    .map((m) => ({ label: m.label, value: detail.value![m.key] ?? '' }))
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
      const profRes = await analyticsApi.getPropertyProfitability(propertyId.value) as any
      profitability.value = profRes?.data || profRes
    } catch {
      profitability.value = null
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar propiedad'
  } finally {
    loading.value = false
  }
}

async function updateFromAvantio() {
  updating.value = true
  updateMessage.value = 'Conectando con Avantio...'
  try {
    // Check for active session or start new one
    let sessionId: string
    const active = await importerApi.getActiveSession()
    if (active.active && active.sessionId) {
      sessionId = active.sessionId
    } else {
      updateMessage.value = 'Abriendo Avantio... Inicia sesión en la ventana del navegador'
      const session = await importerApi.startImport()
      sessionId = session.sessionId
      // Poll for login
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 3000))
        const status = await importerApi.getStatus(sessionId)
        if (status.status === 'logged_in' || status.status === 'done') break
        if (status.status === 'error') throw new Error(status.error || 'Error de login')
      }
    }
    updateMessage.value = 'Importando detalle de propiedad...'
    await importerApi.importDetail(sessionId, 'properties', property.value?.avantio_id || undefined)
    updateMessage.value = 'Actualizado correctamente'
    await fetchData()
    setTimeout(() => { updateMessage.value = null }, 3000)
  } catch (e) {
    updateMessage.value = e instanceof Error ? e.message : 'Error al actualizar'
  } finally {
    updating.value = false
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
      <!-- Update message -->
      <div v-if="updateMessage" class="import-widget__row" :class="updating ? 'import-widget__row--info' : 'import-widget__row--success'" style="margin-bottom: 16px">
        <span v-if="updating" class="spinner spinner--small"></span>
        <span>{{ updateMessage }}</span>
      </div>

      <!-- Header -->
      <div class="detail__header">
        <RouterLink to="/propiedades" class="detail__back">&larr; Volver a propiedades</RouterLink>
        <div class="detail__title-row">
          <h2 class="detail__heading">{{ property.name }}</h2>
          <span v-if="property.avantio_id" class="detail__avantio-id">
            Avantio: {{ property.avantio_id }}
          </span>
          <button class="btn btn--secondary btn--small" :disabled="updating" @click="updateFromAvantio">
            <span v-if="updating" class="spinner spinner--small"></span>
            {{ updating ? '' : '↻' }} Actualizar desde Avantio
          </button>
          <span
            class="badge"
            :class="property.is_active ? 'badge--success' : 'badge--error'"
          >
            {{ property.is_active ? 'Activo' : 'Desactivado' }}
          </span>
          <span v-if="detail?.ESTADO_CD" class="badge" :class="detail.ESTADO_CD === 'DISPONIBLE' ? 'badge--success' : 'badge--warning'">
            {{ detail.ESTADO_CD }}
          </span>
        </div>
      </div>

      <!-- Info card -->
      <div class="card detail__section">
        <h3 class="detail__section-title">Informaci&oacute;n general</h3>
        <div class="detail__grid">
          <div class="detail__field">
            <span class="detail__label">Tipo</span>
            <span class="detail__value">{{ property.type || '--' }}</span>
          </div>
          <div class="detail__field">
            <span class="detail__label">Ubicaci&oacute;n</span>
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
          <template v-if="detail">
            <div v-if="detail['_t_Address'] || detail['_t_Building/house number'] || detail['_t_Floor'] || detail['_t_Apartment / Unit / Suite number']" class="detail__field">
              <span class="detail__label">Direcci&oacute;n completa</span>
              <span class="detail__value">
                {{ [detail['_t_Address'], detail['_t_Building/house number'], detail['_t_Floor'] ? `Piso ${detail['_t_Floor']}` : '', detail['_t_Apartment / Unit / Suite number']].filter(Boolean).join(', ') }}
              </span>
            </div>
            <div v-if="detail['_t_Owner']" class="detail__field">
              <span class="detail__label">Propietario</span>
              <span class="detail__value">{{ detail['_t_Owner'] }}</span>
            </div>
            <div v-if="detail['_t_Assigned rate']" class="detail__field">
              <span class="detail__label">Tarifa asignada</span>
              <span class="detail__value">{{ detail['_t_Assigned rate'] }}</span>
            </div>
          </template>
        </div>
      </div>

      <!-- Quick Cost Widget -->
      <QuickCostWidget :property-id="propertyId" @added="fetchData" />

      <!-- Characteristics card (from _detail) -->
      <div v-if="hasDetail" class="card detail__section">
        <h3 class="detail__section-title">Caracter&iacute;sticas</h3>
        <div class="detail__grid">
          <div v-if="detail!['_t_Number of bedrooms']" class="detail__field">
            <span class="detail__label">Dormitorios</span>
            <span class="detail__value">{{ detail!['_t_Number of bedrooms'] }}</span>
          </div>
          <div v-if="detail!['_t_Square Footage']" class="detail__field">
            <span class="detail__label">Superficie</span>
            <span class="detail__value">{{ detail!['_t_Square Footage'] }}</span>
          </div>
          <div v-if="detail!['_t_Occupation without supplement']" class="detail__field">
            <span class="detail__label">Hu&eacute;spedes m&aacute;ximos</span>
            <span class="detail__value">{{ detail!['_t_Occupation without supplement'] }}</span>
          </div>
        </div>
        <div v-if="bedrooms.length > 0" class="detail__bedrooms">
          <div v-for="bed in bedrooms" :key="bed.label" class="detail__bedroom-item">
            <span class="detail__bedroom-label">{{ bed.label }}</span>
            <span class="detail__bedroom-desc">{{ bed.description }}</span>
          </div>
        </div>
      </div>

      <!-- Amenities card (from _detail) -->
      <div v-if="hasDetail && amenities.length > 0" class="card detail__section">
        <h3 class="detail__section-title">Equipamiento y servicios</h3>
        <div class="detail__amenities">
          <span
            v-for="amenity in amenities"
            :key="amenity.label"
            class="detail__amenity-badge"
            :class="amenity.available ? 'detail__amenity-badge--available' : 'detail__amenity-badge--unavailable'"
            :title="amenity.value"
          >
            {{ amenity.label }}
          </span>
        </div>
      </div>

      <!-- Distances card (from _detail) -->
      <div v-if="hasDetail && distances.length > 0" class="card detail__section">
        <h3 class="detail__section-title">Ubicaci&oacute;n</h3>
        <div class="detail__grid">
          <div v-for="dist in distances" :key="dist.label" class="detail__field">
            <span class="detail__label">{{ dist.label }}</span>
            <span class="detail__value">{{ dist.value }}</span>
          </div>
        </div>
      </div>

      <!-- Internal notes (from _detail) -->
      <div v-if="detail?.['_t_Internal Notes']" class="card detail__section">
        <h3 class="detail__section-title">Notas internas</h3>
        <div class="detail__notes">
          {{ detail['_t_Internal Notes'] }}
        </div>
      </div>

      <!-- No detail data message -->
      <div v-if="!hasDetail" class="card detail__section detail__no-detail">
        <p class="detail__no-detail-text">
          No se encontraron datos detallados de Avantio para esta propiedad.
        </p>
        <p class="detail__no-detail-hint">Importar detalle desde Avantio</p>
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
                <th>Hu&eacute;spedes</th>
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
                    {{ booking.adults || 0 }} ad.{{ booking.children ? ` + ${booking.children} ni&ntilde;os` : '' }}
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
            <span class="detail__value" :style="{ color: (profitability.net_margin ?? 0) >= 0 ? 'var(--color-success)' : 'var(--color-error)' }">
              {{ formatAmount(profitability.net_margin) }}
            </span>
          </div>
          <div class="detail__field">
            <span class="detail__label">ROI</span>
            <span class="detail__value detail__value--highlight">
              {{ (profitability.roi_percent ?? 0).toFixed(1) }}%
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

/* Bedrooms list */
.detail__bedrooms {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail__bedroom-item {
  display: flex;
  gap: 12px;
  padding: 8px 12px;
  background: var(--color-background-soft);
  border-radius: var(--radius-sm);
}

.detail__bedroom-label {
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  min-width: 120px;
  flex-shrink: 0;
}

.detail__bedroom-desc {
  font-size: 0.9rem;
}

/* Amenity badges */
.detail__amenities {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.detail__amenity-badge {
  display: inline-block;
  padding: 4px 14px;
  border-radius: 16px;
  font-size: 0.85rem;
  font-weight: 600;
}

.detail__amenity-badge--available {
  background: #e4f3ed;
  color: var(--color-success);
}

.detail__amenity-badge--unavailable {
  background: var(--color-background-mute);
  color: var(--color-text-secondary);
}

/* Internal notes */
.detail__notes {
  padding: 16px;
  background: var(--color-background-soft);
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  line-height: 1.6;
  white-space: pre-wrap;
  border-left: 3px solid var(--color-border);
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

code {
  font-size: 0.85rem;
  background: var(--color-background-mute);
  padding: 2px 6px;
  border-radius: 4px;
}
</style>
