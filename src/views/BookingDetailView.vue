<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import {
  laravelApi,
  importerApi,
  importerAvailable,
  reportsApi,
  operationalApi,
  IMPORTER_URL,
  type Booking,
  type BookingPnl,
  type BookingOperation,
} from '@/services/api'

const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8001/api' : '/api'
import QuickCostWidget from '@/components/QuickCostWidget.vue'
import AvantioLoginModal from '@/components/AvantioLoginModal.vue'
import { useAvantioSession } from '@/composables/useAvantioSession'

const avantio = useAvantioSession()

const route = useRoute()
const bookingId = computed(() => Number(route.params.id))

const booking = ref<Booking | null>(null)
const pnl = ref<BookingPnl | null>(null)
const pnlLoading = ref(false)
const loading = ref(true)
const error = ref<string | null>(null)
const updating = ref(false)
const updateMessage = ref<string | null>(null)

// Services
interface BookingServiceItem {
  id: number
  category: string
  concept: string
  price_label: string | null
  quantity: string | null
  tax: string | null
  total: string
  currency: string
  charge_moment: string | null
  service_catalog_id: number | null
  unit_cost: string | null
  cost_units: string | null
  total_cost: string | null
  cost_override: boolean
  is_from_avantio: boolean
  _previous_cost?: string | null // strikethrough value
  _is_manual?: boolean // manually added, not from Avantio
}
interface CatalogItem {
  id: number
  name: string
  category: string
  default_unit_cost: string | null
  cost_unit: string
  default_unit_price: string | null
  is_active: boolean
}
const services = ref<BookingServiceItem[]>([])
const catalog = ref<CatalogItem[]>([])
const servicesLoading = ref(false)
const servicesEditing = ref(false)
const servicesSaving = ref(false)
const newServiceConcept = ref('')

async function fetchServices() {
  servicesLoading.value = true
  try {
    const [svcRes, catRes] = await Promise.all([
      fetch(`${API_URL}/bookings/${bookingId.value}/services`),
      fetch(`${API_URL}/service-catalog`),
    ])
    if (svcRes.ok) services.value = await svcRes.json()
    if (catRes.ok) catalog.value = await catRes.json()
  } catch { /* ignore */ }
  finally { servicesLoading.value = false }
}

function onCostEdit(s: BookingServiceItem, newValue: string) {
  // Track previous cost for strikethrough display
  if (s.total_cost && s.total_cost !== newValue) {
    s._previous_cost = s.total_cost
  }
  s.total_cost = newValue
  s.cost_override = true
}

function resetCost(s: BookingServiceItem) {
  // Recalculate quantity from the Avantio total and catalog unit price
  const cat = catalog.value.find(c => c.id === s.service_catalog_id || c.name === s.concept)
  const unitPrice = cat?.default_unit_price ? Number(cat.default_unit_price) : 0
  const total = Number(s.total) || 0
  const qty = unitPrice > 0 ? Math.round(total / unitPrice) : (s.quantity ? Number(s.quantity) : 1)
  s.cost_units = String(qty)
  if (s.unit_cost) {
    s.total_cost = String((Number(s.unit_cost) * qty).toFixed(2))
  }
  s.cost_override = false
  saveServices()
}

function recalcCost(s: BookingServiceItem) {
  const qty = Number(s.cost_units) || 0
  // Recalculate cost total
  if (s.unit_cost) {
    const newCost = String((Number(s.unit_cost) * qty).toFixed(2))
    s.total_cost = newCost
  }
  // Recalculate price total for manual services
  if (s._is_manual || !s.is_from_avantio) {
    const cat = catalog.value.find(c => c.id === s.service_catalog_id || c.name === s.concept)
    if (cat?.default_unit_price) {
      s.total = String((Number(cat.default_unit_price) * qty).toFixed(2))
    }
  }
}

function addService() {
  if (!newServiceConcept.value) return
  const cat = catalog.value.find(c => c.name === newServiceConcept.value)
  const unitPrice = cat?.default_unit_price ? Number(cat.default_unit_price) : 0
  const unitCost = cat?.default_unit_cost ? Number(cat.default_unit_cost) : 0
  services.value.push({
    id: 0,
    category: 'service',
    concept: newServiceConcept.value,
    price_label: null,
    quantity: '1',
    tax: null,
    total: String(unitPrice),
    currency: 'USD',
    charge_moment: null,
    service_catalog_id: cat?.id || null,
    unit_cost: unitCost ? String(unitCost) : null,
    cost_units: '1',
    total_cost: unitCost ? String(unitCost) : null,
    cost_override: false,
    is_from_avantio: false,
    _is_manual: true,
  })
  newServiceConcept.value = ''
}

function removeService(idx: number) {
  if (!services.value[idx].is_from_avantio) {
    services.value.splice(idx, 1)
  }
}

async function saveServices() {
  servicesSaving.value = true
  try {
    const data = services.value.map(s => ({
      category: s.category,
      concept: s.concept,
      price_label: s.price_label,
      quantity: s.quantity,
      tax: s.tax,
      total: Number(s.total) || 0,
      currency: s.currency,
      charge_moment: s.charge_moment,
      service_catalog_id: s.service_catalog_id,
      unit_cost: s.unit_cost ? Number(s.unit_cost) : null,
      cost_units: s.cost_units ? Number(s.cost_units) : null,
      total_cost: s.total_cost ? Number(s.total_cost) : null,
      cost_override: s.cost_override,
    }))
    const res = await fetch(`${API_URL}/bookings/${bookingId.value}/services`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, replace: true }),
    })
    if (res.ok) {
      servicesEditing.value = false
      await fetchServices()
    }
  } catch { /* ignore */ }
  finally { servicesSaving.value = false }
}

function catalogPrice(s: BookingServiceItem): string {
  const cat = catalog.value.find(c => c.id === s.service_catalog_id || c.name === s.concept)
  if (cat?.default_unit_price) return formatAmount(Number(cat.default_unit_price))
  return '--'
}

const availableServices = computed(() =>
  catalog.value
    .filter(c => c.is_active && !services.value.some(s => s.concept === c.name))
    .map(c => c.name)
)

// Operative record state
const operation = ref<BookingOperation | null>(null)
const operationLoading = ref(false)
const operationSaving = ref(false)
let saveTimeout: ReturnType<typeof setTimeout> | null = null

const opStatuses: string[] = ['pre_reserva', 'confirmada', 'en_curso', 'cerrada', 'cancelada']
const opStatusLabels: Record<string, string> = {
  pre_reserva: 'Pre-reserva',
  confirmada: 'Confirmada',
  en_curso: 'En curso',
  cerrada: 'Cerrada',
  cancelada: 'Cancelada',
}

const incidentTypes = [
  { value: 'limpieza', label: 'Limpieza' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'huesped', label: 'Huesped' },
  { value: 'cobro', label: 'Cobro' },
  { value: 'otro', label: 'Otro' },
]

const incidentLevels = [
  { value: 'bajo', label: 'Bajo' },
  { value: 'medio', label: 'Medio' },
  { value: 'alto', label: 'Alto' },
]

const checklistItems = [
  { key: 'cleaning_coordinated', label: 'Limpieza coordinada', field: true },
  { key: 'requires_maintenance', label: 'Requiere mantenimiento', field: true },
  { key: 'pending_followup', label: 'Seguimiento pendiente', field: true },
  { key: 'dni_received', label: 'DNI recibido', field: false },
  { key: 'receipt_sent', label: 'Comprobante enviado', field: false },
  { key: 'contract_sent', label: 'Contrato enviado', field: false },
  { key: 'guarantee_received', label: 'Garantia recibida', field: false },
  { key: 'operation_closed', label: 'Operacion cerrada', field: false },
]

function getChecklistValue(item: { key: string; field: boolean }): boolean {
  if (!operation.value) return false
  if (item.field) {
    return (operation.value as Record<string, unknown>)[item.key] as boolean
  }
  return operation.value.checklist?.[item.key] === true
}

function toggleChecklist(item: { key: string; field: boolean }) {
  if (!operation.value) return
  const current = getChecklistValue(item)
  if (item.field) {
    ;(operation.value as Record<string, unknown>)[item.key] = !current
  } else {
    if (!operation.value.checklist) operation.value.checklist = {}
    operation.value.checklist[item.key] = !current
  }
  debouncedSaveOperation()
}

function setOperationStatus(status: string) {
  if (!operation.value) return
  operation.value.status = status
  debouncedSaveOperation()
}

function debouncedSaveOperation() {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(() => saveOperation(), 800)
}

async function saveOperation() {
  if (!operation.value) return
  operationSaving.value = true
  try {
    const res = await operationalApi.updateBookingOperation(bookingId.value, {
      status: operation.value.status,
      responsible: operation.value.responsible,
      commercial_notes: operation.value.commercial_notes,
      operational_notes: operation.value.operational_notes,
      checklist: operation.value.checklist,
      incident_type: operation.value.incident_type,
      incident_level: operation.value.incident_level,
      cleaning_coordinated: operation.value.cleaning_coordinated,
      requires_maintenance: operation.value.requires_maintenance,
      pending_followup: operation.value.pending_followup,
      documentation: operation.value.documentation,
    })
    operation.value = res.data
  } catch {
    // silent fail on auto-save
  } finally {
    operationSaving.value = false
  }
}

async function fetchOperation() {
  operationLoading.value = true
  try {
    const res = await operationalApi.getBookingOperation(bookingId.value)
    operation.value = res.data
  } catch {
    operation.value = null
  } finally {
    operationLoading.value = false
  }
}

async function createOperation() {
  operationLoading.value = true
  try {
    const res = await operationalApi.createBookingOperation(bookingId.value)
    operation.value = res.data
  } catch {
    // ignore
  } finally {
    operationLoading.value = false
  }
}

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

async function fetchPnl() {
  pnlLoading.value = true
  try {
    pnl.value = await reportsApi.getBookingPnl(bookingId.value)
  } catch {
    pnl.value = null
  } finally {
    pnlLoading.value = false
  }
}

async function fetchBooking() {
  loading.value = true
  error.value = null
  try {
    booking.value = await laravelApi.getBooking(bookingId.value)
    fetchPnl()
    fetchOperation()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar reserva'
  } finally {
    loading.value = false
  }
}

async function updateFromAvantio() {
  updating.value = true
  updateMessage.value = 'Conectando con Avantio...'
  try {
    const sessionId = await avantio.getSession()
    updateMessage.value = 'Importando detalle de reserva...'
    await importerApi.importDetail(sessionId, 'bookings', booking.value?.avantio_id || undefined)
    updateMessage.value = 'Actualizado correctamente'
    await fetchBooking()
    await fetchServices()
    setTimeout(() => { updateMessage.value = null }, 3000)
  } catch (e) {
    if (e instanceof Error && e.message === 'Cancelled') {
      updateMessage.value = null
    } else {
      updateMessage.value = e instanceof Error ? e.message : 'Error al actualizar'
    }
  } finally {
    updating.value = false
  }
}

onMounted(() => { fetchBooking(); fetchServices() })
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
      <!-- Update message -->
      <div v-if="updateMessage" class="import-widget__row" :class="updating ? 'import-widget__row--info' : 'import-widget__row--success'" style="margin-bottom: 16px">
        <span v-if="updating" class="spinner spinner--small"></span>
        <span>{{ updateMessage }}</span>
      </div>

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
          <button v-if="importerAvailable" class="btn btn--secondary btn--small" :disabled="updating" @click="updateFromAvantio">
            <span v-if="updating" class="spinner spinner--small"></span>
            {{ updating ? '' : '↻' }} Actualizar desde Avantio
          </button>
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

      <!-- Services / Amounts breakdown -->
      <div v-if="services.length > 0 || servicesEditing" class="card detail__section">
        <div class="detail__section-header">
          <h3 class="detail__section-title">Desglose de importes</h3>
          <div class="detail__section-actions">
            <button v-if="!servicesEditing" class="btn btn--secondary btn--small" @click="servicesEditing = true">Editar costos</button>
            <template v-else>
              <button class="btn btn--primary btn--small" :disabled="servicesSaving" @click="saveServices">
                {{ servicesSaving ? 'Guardando...' : 'Guardar' }}
              </button>
              <button class="btn btn--secondary btn--small" @click="servicesEditing = false; fetchServices()">Cancelar</button>
            </template>
          </div>
        </div>
        <table class="services__table">
          <thead>
            <tr>
              <th>Concepto</th>
              <th class="text--right">Precio unitario</th>
              <th class="text--right">Cantidad</th>
              <th class="text--right">Precio total</th>
              <th class="text--right">Costo unitario</th>
              <th class="text--right">Costo total</th>
              <th v-if="servicesEditing"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(s, idx) in services" :key="s.id || idx" :class="{ 'services__row--property': s.category === 'property' }">
              <td class="services__concept">{{ s.concept }}</td>
              <td class="text--right">{{ catalogPrice(s) }}</td>
              <td class="text--right">
                <input v-if="servicesEditing" v-model="s.cost_units" type="number" step="1" min="0" class="services__input"
                  @change="recalcCost(s)" />
                <span v-else>{{ s.cost_units || s.quantity || '--' }}</span>
              </td>
              <td class="text--right services__total">{{ formatAmount(Number(s.total), s.currency) }}</td>
              <td class="text--right">
                {{ s.unit_cost ? formatAmount(Number(s.unit_cost)) : '--' }}
              </td>
              <td class="text--right">
                <div v-if="servicesEditing" class="services__cost-edit">
                  <span v-if="s.cost_override && s.unit_cost && s.cost_units" class="services__prev-cost">
                    {{ formatAmount(Number(s.unit_cost) * Number(s.cost_units)) }}
                  </span>
                  <input v-model="s.total_cost" type="number" step="0.01" class="services__input services__input--cost"
                    @change="onCostEdit(s, s.total_cost || '0')" />
                </div>
                <template v-else>
                  <div v-if="s.cost_override && s.unit_cost && s.cost_units" class="services__cost-edit">
                    <span class="services__prev-cost">{{ formatAmount(Number(s.unit_cost) * Number(s.cost_units)) }}</span>
                    <span>{{ formatAmount(Number(s.total_cost)) }}</span>
                    <button class="services__reset" @click="resetCost(s)" title="Volver al costo calculado">&#8634;</button>
                  </div>
                  <span v-else>{{ s.total_cost ? formatAmount(Number(s.total_cost)) : '--' }}</span>
                </template>
              </td>
              <td v-if="servicesEditing">
                <button v-if="!s.is_from_avantio" class="services__remove" @click="removeService(idx)">&times;</button>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="services__totals">
              <td colspan="2"><strong>Totales</strong></td>
              <td></td>
              <td class="text--right"><strong>{{ formatAmount(services.reduce((a, s) => a + Number(s.total || 0), 0)) }}</strong></td>
              <td></td>
              <td class="text--right"><strong>{{ formatAmount(services.reduce((a, s) => a + Number(s.total_cost || 0), 0)) }}</strong></td>
              <td v-if="servicesEditing"></td>
            </tr>
          </tfoot>
        </table>
        <!-- Add service -->
        <div v-if="servicesEditing" class="services__add">
          <select v-model="newServiceConcept" class="services__select" @change="addService">
            <option value="">+ Agregar servicio...</option>
            <option v-for="name in availableServices" :key="name" :value="name">{{ name }}</option>
          </select>
        </div>
      </div>
      <div v-else-if="servicesLoading" class="card detail__section">
        <h3 class="detail__section-title">Desglose de importes</h3>
        <div class="detail__empty"><span class="spinner spinner--small"></span> Cargando...</div>
      </div>

      <!-- Quick Cost Widget -->
      <QuickCostWidget
        :booking-id="bookingId"
        :property-id="booking.property_id ?? undefined"
        @added="fetchBooking"
      />

      <!-- Estado de Resultados (P&L) -->
      <div class="card detail__section">
        <h3 class="detail__section-title">Estado de Resultados</h3>
        <div v-if="pnlLoading" class="detail__empty">
          <span class="spinner spinner--small"></span> Cargando...
        </div>
        <div v-else-if="pnl" class="pnl">
          <table class="pnl__table">
            <tbody>
              <!-- Datos de la reserva (contexto) -->
              <tr class="pnl__section-header">
                <td colspan="2">Datos de la reserva</td>
              </tr>
              <tr class="pnl__row pnl__row--indent pnl__row--muted">
                <td>Alquiler</td>
                <td class="pnl__amount">{{ formatAmount(pnl.revenue.rent) }}</td>
              </tr>
              <tr class="pnl__row pnl__row--indent pnl__row--muted">
                <td>Extras</td>
                <td class="pnl__amount">{{ formatAmount(pnl.revenue.extras) }}</td>
              </tr>
              <tr class="pnl__row pnl__row--indent pnl__row--muted">
                <td>Total bruto reserva</td>
                <td class="pnl__amount">{{ formatAmount(pnl.revenue.gross_total) }}</td>
              </tr>

              <!-- Ingresos Hola Sur -->
              <tr class="pnl__section-header">
                <td colspan="2">Ingresos Hola Sur</td>
              </tr>
              <tr v-if="pnl.revenue.hs_commission_percent" class="pnl__row pnl__row--indent">
                <td>Comisión alquiler ({{ pnl.revenue.hs_commission_percent }}%)</td>
                <td class="pnl__amount pnl__amount--positive">{{ formatAmount(pnl.revenue.hs_rent_commission) }}</td>
              </tr>
              <tr v-else class="pnl__row pnl__row--indent pnl__row--warning">
                <td colspan="2">
                  <span class="pnl__warning">⚠ Comisión no definida — <router-link :to="'/propiedades/' + booking.property_id">actualizar propiedad</router-link></span>
                </td>
              </tr>
              <tr class="pnl__row pnl__row--indent">
                <td>Ingresos por servicios</td>
                <td class="pnl__amount pnl__amount--positive">{{ formatAmount(pnl.revenue.hs_extras_revenue) }}</td>
              </tr>
              <template v-if="pnl.revenue.owner_returns?.length > 0">
                <tr
                  v-for="ret in pnl.revenue.owner_returns"
                  :key="'ret-' + ret.service"
                  class="pnl__row pnl__row--indent2 pnl__row--muted"
                >
                  <td>{{ ret.service }} ({{ ret.owner_percent }}% propietario)</td>
                  <td class="pnl__amount pnl__amount--cost">-{{ formatAmount(ret.owner_amount) }}</td>
                </tr>
              </template>
              <tr class="pnl__row pnl__row--total">
                <td>Total ingresos HS</td>
                <td class="pnl__amount pnl__amount--positive">{{ formatAmount(pnl.revenue.hs_total_revenue) }}</td>
              </tr>

              <!-- Costos operativos -->
              <tr class="pnl__section-header">
                <td colspan="2">Costos operativos</td>
              </tr>
              <tr v-if="pnl.costs.service_costs > 0" class="pnl__row pnl__row--indent">
                <td>Costos de servicios</td>
                <td class="pnl__amount pnl__amount--cost">{{ formatAmount(pnl.costs.service_costs) }}</td>
              </tr>
              <template v-if="pnl.costs.service_costs_breakdown?.length > 0">
                <tr
                  v-for="item in pnl.costs.service_costs_breakdown"
                  :key="'svc-' + item.category"
                  class="pnl__row pnl__row--indent2"
                >
                  <td>{{ item.category }}</td>
                  <td class="pnl__amount pnl__amount--cost">{{ formatAmount(item.amount) }}</td>
                </tr>
              </template>
              <tr v-if="pnl.costs.direct_costs > 0" class="pnl__row pnl__row--indent">
                <td>Compras directas</td>
                <td class="pnl__amount pnl__amount--cost">{{ formatAmount(pnl.costs.direct_costs) }}</td>
              </tr>
              <template v-if="pnl.costs.direct_costs_breakdown?.length > 0">
                <tr
                  v-for="item in pnl.costs.direct_costs_breakdown"
                  :key="'dc-' + item.category"
                  class="pnl__row pnl__row--indent2"
                >
                  <td>{{ item.category }}</td>
                  <td class="pnl__amount pnl__amount--cost">{{ formatAmount(item.amount) }}</td>
                </tr>
              </template>
              <tr class="pnl__row pnl__row--total">
                <td>Total costos</td>
                <td class="pnl__amount pnl__amount--cost">{{ formatAmount(pnl.costs.total_costs) }}</td>
              </tr>

              <!-- Resultado -->
              <tr class="pnl__section-header">
                <td colspan="2">Resultado</td>
              </tr>
              <tr class="pnl__row pnl__row--total">
                <td>Resultado neto</td>
                <td class="pnl__amount" :class="pnl.margin.net_margin >= 0 ? 'pnl__amount--positive' : 'pnl__amount--negative'">
                  {{ formatAmount(pnl.margin.net_margin) }}
                </td>
              </tr>
              <tr class="pnl__row pnl__row--indent">
                <td>% Margen</td>
                <td class="pnl__amount" :class="pnl.margin.margin_percent >= 0 ? 'pnl__amount--positive' : 'pnl__amount--negative'">
                  {{ pnl.margin.margin_percent.toFixed(1) }}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="detail__empty">
          No hay datos de estado de resultados disponibles.
        </div>
      </div>

      <!-- Registro operativo (HS-46) -->
      <div class="card detail__section">
        <div class="op__header">
          <h3 class="detail__section-title" style="margin-bottom: 0; border-bottom: none; padding-bottom: 0;">Registro operativo</h3>
          <span v-if="operationSaving" class="op__saving">Guardando...</span>
          <span v-if="operation" class="op__id">{{ operation.operation_id }}</span>
        </div>

        <div v-if="operationLoading" class="detail__empty">
          <span class="spinner spinner--small"></span> Cargando...
        </div>

        <div v-else-if="!operation" class="op__empty">
          <p>No hay registro operativo para esta reserva.</p>
          <button class="btn btn--primary btn--small" @click="createOperation">Crear registro operativo</button>
        </div>

        <div v-else class="op__content">
          <!-- Status stepper -->
          <div class="op__stepper">
            <div
              v-for="(s, idx) in opStatuses.filter(st => st !== 'cancelada')"
              :key="s"
              class="op__step"
              :class="{
                'op__step--active': operation.status === s,
                'op__step--done': opStatuses.indexOf(operation.status) > idx && operation.status !== 'cancelada',
              }"
              @click="setOperationStatus(s)"
            >
              <div class="op__step-dot">
                <span v-if="opStatuses.indexOf(operation.status) > idx && operation.status !== 'cancelada'">&#10003;</span>
                <span v-else>{{ idx + 1 }}</span>
              </div>
              <span class="op__step-label">{{ opStatusLabels[s] }}</span>
              <div v-if="idx < 3" class="op__step-line" :class="{ 'op__step-line--done': opStatuses.indexOf(operation.status) > idx }"></div>
            </div>
          </div>
          <div v-if="operation.status !== 'cancelada'" class="op__cancel-row">
            <button class="btn btn--secondary btn--small op__cancel-btn" @click="setOperationStatus('cancelada')">Cancelar reserva</button>
          </div>
          <div v-else class="op__cancelled-badge">
            <span class="badge badge--error">Cancelada</span>
            <button class="btn btn--secondary btn--small" @click="setOperationStatus('pre_reserva')">Reactivar</button>
          </div>

          <!-- Responsable -->
          <div class="op__field-row">
            <label class="op__field-label">Responsable</label>
            <input
              v-model="operation.responsible"
              type="text"
              class="input op__input"
              placeholder="Nombre del responsable"
              @input="debouncedSaveOperation()"
            />
          </div>

          <!-- Observaciones comerciales -->
          <div class="op__field-row">
            <label class="op__field-label">Observaciones comerciales</label>
            <textarea
              v-model="operation.commercial_notes"
              class="input op__textarea"
              rows="2"
              placeholder="Notas comerciales..."
              @input="debouncedSaveOperation()"
            ></textarea>
          </div>

          <!-- Observaciones operativas -->
          <div class="op__field-row">
            <label class="op__field-label">Observaciones operativas</label>
            <textarea
              v-model="operation.operational_notes"
              class="input op__textarea"
              rows="2"
              placeholder="Notas operativas..."
              @input="debouncedSaveOperation()"
            ></textarea>
          </div>

          <!-- Checklist -->
          <div class="op__checklist">
            <label class="op__field-label">Checklist</label>
            <div class="op__checklist-grid">
              <div
                v-for="item in checklistItems"
                :key="item.key"
                class="op__check-item"
                @click="toggleChecklist(item)"
              >
                <span class="op__checkbox" :class="{ 'op__checkbox--checked': getChecklistValue(item) }">
                  <span v-if="getChecklistValue(item)">&#10003;</span>
                </span>
                <span class="op__check-label">{{ item.label }}</span>
              </div>
            </div>
          </div>

          <!-- Incidencia -->
          <div class="op__incident">
            <label class="op__field-label">Incidencia</label>
            <div class="op__incident-row">
              <select v-model="operation.incident_type" class="input op__select" @change="debouncedSaveOperation()">
                <option :value="null">Sin incidencia</option>
                <option v-for="t in incidentTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
              </select>
              <div class="op__level-group">
                <button
                  v-for="l in incidentLevels"
                  :key="l.value"
                  class="op__level-btn"
                  :class="{
                    'op__level-btn--active': operation.incident_level === l.value,
                    ['op__level-btn--' + l.value]: true,
                  }"
                  @click="operation.incident_level = l.value; debouncedSaveOperation()"
                >{{ l.label }}</button>
              </div>
            </div>
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

    <AvantioLoginModal />
  </div>
</template>

<style scoped>
/* Services table */
.services__table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
.services__table th { text-align: left; padding: 8px 10px; font-weight: 500; color: var(--color-text-secondary); border-bottom: 2px solid var(--color-border); font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.5px; }
.services__table td { padding: 8px 10px; border-bottom: 1px solid var(--color-border-light, #f0f0f0); }
.services__row--property { font-weight: 500; }
.services__concept { max-width: 250px; }
.services__total { font-weight: 500; }
.services__charge { color: var(--color-text-secondary); font-size: 0.82rem; }
.text--right { text-align: right; }
.services__input { width: 80px; padding: 4px 6px; border: 1px solid var(--color-border); border-radius: 4px; font-size: 0.85rem; text-align: right; }
.services__input--cost { background: #fffde7; }
.services__input:focus { outline: none; border-color: var(--color-primary); }
.services__cost-edit { display: flex; align-items: center; gap: 6px; justify-content: flex-end; }
.services__prev-cost { text-decoration: line-through; color: var(--color-text-secondary); font-size: 0.8rem; }
.services__reset { background: none; border: none; color: var(--color-text-secondary); font-size: 0.9rem; cursor: pointer; padding: 0 2px; }
.services__reset:hover { color: var(--color-primary); }
.services__remove { background: none; border: none; color: var(--color-text-secondary); font-size: 1.2rem; cursor: pointer; padding: 0 4px; }
.services__remove:hover { color: var(--color-error); }
.services__totals { border-top: 2px solid var(--color-border); }
.services__totals td { padding-top: 10px; }
.services__add { display: flex; gap: 8px; align-items: center; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--color-border-light, #f0f0f0); }
.services__select { padding: 6px 10px; border: 1px solid var(--color-border); border-radius: 4px; font-size: 0.85rem; min-width: 200px; }
.detail__section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.detail__section-actions { display: flex; gap: 8px; }

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

/* P&L Table */
.pnl__table {
  width: 100%;
  max-width: 500px;
  border-collapse: collapse;
}

.pnl__table td {
  padding: 8px 12px;
  font-size: 0.9rem;
}

.pnl__section-header td {
  font-weight: 700;
  font-size: 0.95rem;
  padding-top: 16px;
  padding-bottom: 6px;
  border-bottom: 2px solid var(--color-border);
  color: var(--color-heading);
}

.pnl__row--indent td:first-child {
  padding-left: 24px;
}

.pnl__row--indent2 td:first-child {
  padding-left: 40px;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.pnl__row--total {
  background: var(--color-background-soft);
  border-radius: var(--radius-sm);
}

.pnl__row--total td {
  font-weight: 700;
}

.pnl__amount {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.pnl__amount--cost {
  color: var(--color-error);
}

.pnl__amount--positive {
  color: var(--color-success);
}

.pnl__amount--negative {
  color: var(--color-error);
}

.pnl__row--muted td {
  color: #9ca3af;
}

.pnl__warning {
  color: #b45309;
  font-size: 0.85rem;
}

.pnl__warning a {
  color: #b45309;
  text-decoration: underline;
}

/* Operative record styles */
.op__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border);
}

.op__saving {
  font-size: 0.8rem;
  color: var(--color-primary);
  font-weight: 500;
}

.op__id {
  font-size: 0.8rem;
  font-family: monospace;
  color: var(--color-text-secondary);
  background: var(--color-background-mute);
  padding: 2px 8px;
  border-radius: 4px;
}

.op__empty {
  text-align: center;
  padding: 24px;
  color: var(--color-text-secondary);
}

.op__empty p {
  margin-bottom: 12px;
  font-size: 0.9rem;
}

.op__content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Stepper */
.op__stepper {
  display: flex;
  align-items: flex-start;
  gap: 0;
  padding: 8px 0;
}

.op__step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  position: relative;
  flex: 1;
  cursor: pointer;
}

.op__step-dot {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  background: var(--color-background);
  z-index: 1;
  transition: all 0.2s;
}

.op__step--active .op__step-dot {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: #fff;
}

.op__step--done .op__step-dot {
  border-color: var(--color-primary);
  background: #e4f3ed;
  color: var(--color-primary);
}

.op__step-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  text-align: center;
}

.op__step--active .op__step-label {
  color: var(--color-primary);
  font-weight: 700;
}

.op__step-line {
  position: absolute;
  top: 16px;
  left: calc(50% + 16px);
  right: calc(-50% + 16px);
  height: 2px;
  background: var(--color-border);
}

.op__step-line--done {
  background: var(--color-primary);
}

.op__cancel-row {
  display: flex;
  justify-content: flex-end;
}

.op__cancel-btn {
  color: var(--color-error);
  border-color: var(--color-error);
  font-size: 0.8rem;
}

.op__cancelled-badge {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* Fields */
.op__field-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.op__field-label {
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-secondary);
}

.op__input {
  max-width: 400px;
}

.op__textarea {
  resize: vertical;
  min-height: 48px;
}

/* Checklist */
.op__checklist-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-top: 6px;
}

.op__check-item {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  transition: background 0.15s;
}

.op__check-item:hover {
  background: var(--color-background-soft);
}

.op__checkbox {
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-border);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  flex-shrink: 0;
  transition: all 0.15s;
}

.op__checkbox--checked {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}

.op__check-label {
  font-size: 0.9rem;
}

/* Incident */
.op__incident-row {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 6px;
}

.op__select {
  max-width: 200px;
}

.op__level-group {
  display: flex;
  gap: 4px;
}

.op__level-btn {
  padding: 4px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  font-weight: 500;
  background: var(--color-background);
  cursor: pointer;
  transition: all 0.15s;
}

.op__level-btn--active.op__level-btn--bajo {
  background: #e4f3ed;
  border-color: var(--color-success);
  color: var(--color-success);
}

.op__level-btn--active.op__level-btn--medio {
  background: #fff8e1;
  border-color: #f59e0b;
  color: #d97706;
}

.op__level-btn--active.op__level-btn--alto {
  background: #fde8e8;
  border-color: var(--color-error);
  color: var(--color-error);
}

@media (max-width: 768px) {
  .detail__grid {
    grid-template-columns: 1fr;
  }

  .detail__heading {
    font-size: 1.3rem;
  }

  .detail__payment-row {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .detail__raw-item {
    flex-direction: column;
    gap: 4px;
  }

  .detail__raw-key {
    min-width: 0;
  }

  .op__checklist-grid {
    grid-template-columns: 1fr;
  }

  .op__stepper {
    flex-wrap: wrap;
    gap: 8px;
  }

  .op__step-line {
    display: none;
  }

  .op__incident-row {
    flex-direction: column;
    align-items: stretch;
  }

  .op__select {
    max-width: 100%;
  }
}
</style>
