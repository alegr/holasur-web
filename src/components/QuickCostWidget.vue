<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { laravelApi, type CostCategory } from '@/services/api'

const props = defineProps<{
  propertyId?: number
  bookingId?: number
}>()

const emit = defineEmits<{
  added: []
}>()

// State
const expanded = ref(false)
const saving = ref(false)
const successMessage = ref<string | null>(null)
const errorMessage = ref<string | null>(null)

// Form
const categoryId = ref<number | null>(null)
const amount = ref<number | null>(null)
const note = ref('')
const currency = ref('USD')

// Categories
const categories = ref<CostCategory[]>([])
const loadingCategories = ref(false)

// Recent costs
interface RecentCost {
  id: number
  date: string
  category: string
  amount: string
  currency: string
  note: string | null
  purchase_number: string
}
const recentCosts = ref<RecentCost[]>([])
const loadingRecent = ref(false)

const directCategories = computed(() =>
  categories.value.filter((c) => c.type === 'direct'),
)

function formatDate(d: string | null): string {
  if (!d) return '--'
  return new Date(d + 'T00:00:00').toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatAmount(amount: string | number | null, curr?: string | null): string {
  if (amount === null || amount === undefined) return '--'
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(num)) return String(amount)
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: curr || 'USD',
  }).format(num)
}

async function fetchCategories() {
  loadingCategories.value = true
  try {
    const res = (await laravelApi.getCostCategories()) as any
    categories.value = res.data || res || []
  } catch {
    categories.value = []
  } finally {
    loadingCategories.value = false
  }
}

async function fetchRecent() {
  loadingRecent.value = true
  try {
    const params: { property_id?: number; booking_id?: number } = {}
    if (props.bookingId) params.booking_id = props.bookingId
    else if (props.propertyId) params.property_id = props.propertyId
    const res = await laravelApi.getRecentCosts(params)
    recentCosts.value = res.data || []
  } catch {
    recentCosts.value = []
  } finally {
    loadingRecent.value = false
  }
}

function openForm() {
  expanded.value = true
  errorMessage.value = null
  successMessage.value = null
}

function cancel() {
  expanded.value = false
  resetForm()
}

function resetForm() {
  categoryId.value = null
  amount.value = null
  note.value = ''
  currency.value = 'USD'
  errorMessage.value = null
}

async function save() {
  if (!categoryId.value || !amount.value) {
    errorMessage.value = 'Completa la categoria y el monto.'
    return
  }
  saving.value = true
  errorMessage.value = null
  try {
    const payload: {
      category_id: number
      amount: number
      note?: string
      property_id?: number
      booking_id?: number
      currency?: string
    } = {
      category_id: categoryId.value,
      amount: amount.value,
      currency: currency.value,
    }
    if (note.value.trim()) payload.note = note.value.trim()
    if (props.propertyId) payload.property_id = props.propertyId
    if (props.bookingId) payload.booking_id = props.bookingId

    await laravelApi.addQuickCost(payload)

    successMessage.value = 'Costo agregado \u2713'
    expanded.value = false
    resetForm()
    emit('added')
    await fetchRecent()
    setTimeout(() => {
      successMessage.value = null
    }, 3000)
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Error al guardar el costo'
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  fetchCategories()
  fetchRecent()
})
</script>

<template>
  <div class="qc">
    <div class="qc__header">
      <h4 class="qc__title">Costos rapidos</h4>
    </div>

    <!-- Success flash -->
    <div v-if="successMessage" class="qc__flash qc__flash--success">
      {{ successMessage }}
    </div>

    <!-- Collapsed: add button -->
    <button v-if="!expanded" class="qc__add-btn" @click="openForm">
      + Agregar costo
    </button>

    <!-- Expanded: inline form -->
    <div v-if="expanded" class="qc__form">
      <div class="qc__form-row">
        <div class="qc__field qc__field--category">
          <select v-model="categoryId" class="qc__select" :disabled="loadingCategories">
            <option :value="null" disabled>Categoria...</option>
            <option v-for="cat in directCategories" :key="cat.id" :value="cat.id">
              {{ cat.name }}
            </option>
          </select>
        </div>
        <div class="qc__field qc__field--amount">
          <div class="qc__amount-wrap">
            <span class="qc__amount-prefix">$</span>
            <input
              v-model.number="amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              class="qc__amount-input"
            />
          </div>
        </div>
      </div>
      <div class="qc__form-row">
        <div class="qc__field qc__field--note">
          <input
            v-model="note"
            type="text"
            placeholder="Nota opcional..."
            class="qc__note-input"
          />
        </div>
      </div>
      <div v-if="errorMessage" class="qc__flash qc__flash--error">
        {{ errorMessage }}
      </div>
      <div class="qc__actions">
        <button class="qc__save-btn" :disabled="saving" @click="save">
          <span v-if="saving" class="spinner spinner--small"></span>
          {{ saving ? 'Guardando...' : 'Guardar' }}
        </button>
        <button class="qc__cancel-btn" @click="cancel">Cancelar</button>
      </div>
    </div>

    <!-- Recent costs list -->
    <div class="qc__recent">
      <div v-if="loadingRecent" class="qc__recent-loading">
        <span class="spinner spinner--small"></span>
      </div>
      <div v-else-if="recentCosts.length === 0" class="qc__recent-empty">
        Sin costos registrados
      </div>
      <table v-else class="qc__table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Categoria</th>
            <th>Monto</th>
            <th>Nota</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="cost in recentCosts" :key="cost.id">
            <td>{{ formatDate(cost.date) }}</td>
            <td>{{ cost.category }}</td>
            <td>{{ formatAmount(cost.amount, cost.currency) }}</td>
            <td class="qc__note-cell">{{ cost.note || '--' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.qc {
  background: var(--color-cream, #f4f2e2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 16px 20px;
}

.qc__header {
  margin-bottom: 12px;
}

.qc__title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin: 0;
}

/* Add button */
.qc__add-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-primary);
  background: transparent;
  border: 1px dashed var(--color-primary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.15s;
}

.qc__add-btn:hover {
  background: var(--color-primary-lighter, #e8f0ef);
  border-style: solid;
}

/* Form */
.qc__form {
  margin-bottom: 16px;
}

.qc__form-row {
  display: flex;
  gap: 10px;
  margin-bottom: 8px;
}

.qc__field--category {
  flex: 1.4;
}

.qc__field--amount {
  flex: 1;
}

.qc__field--note {
  flex: 1;
}

.qc__select {
  width: 100%;
  padding: 7px 10px;
  font-size: 0.85rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface, #fff);
  color: var(--color-text);
  appearance: auto;
}

.qc__select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(22, 70, 63, 0.12);
}

/* Amount with $ prefix */
.qc__amount-wrap {
  display: flex;
  align-items: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface, #fff);
  overflow: hidden;
}

.qc__amount-wrap:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(22, 70, 63, 0.12);
}

.qc__amount-prefix {
  padding: 7px 0 7px 10px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  user-select: none;
}

.qc__amount-input {
  flex: 1;
  padding: 7px 10px 7px 4px;
  font-size: 0.85rem;
  border: none;
  background: transparent;
  color: var(--color-text);
  min-width: 0;
}

.qc__amount-input:focus {
  outline: none;
}

/* Remove number input spinners */
.qc__amount-input::-webkit-inner-spin-button,
.qc__amount-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.qc__amount-input[type='number'] {
  -moz-appearance: textfield;
}

.qc__note-input {
  width: 100%;
  padding: 7px 10px;
  font-size: 0.85rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface, #fff);
  color: var(--color-text);
}

.qc__note-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(22, 70, 63, 0.12);
}

/* Actions */
.qc__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 4px;
}

.qc__save-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #fff;
  background: var(--color-primary);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.15s;
}

.qc__save-btn:hover:not(:disabled) {
  background: var(--color-primary-light);
}

.qc__save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.qc__cancel-btn {
  padding: 6px 12px;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  background: transparent;
  border: none;
  cursor: pointer;
  text-decoration: underline;
}

.qc__cancel-btn:hover {
  color: var(--color-text);
}

/* Flash messages */
.qc__flash {
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  font-weight: 500;
  margin-bottom: 10px;
}

.qc__flash--success {
  background: #e4f3ed;
  color: var(--color-success);
}

.qc__flash--error {
  background: #fce8e8;
  color: var(--color-error);
}

/* Recent costs */
.qc__recent {
  margin-top: 14px;
}

.qc__recent-loading {
  padding: 12px 0;
  text-align: center;
}

.qc__recent-empty {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  font-style: italic;
  padding: 8px 0;
}

.qc__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
}

.qc__table th {
  text-align: left;
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--color-text-secondary);
  padding: 6px 8px;
  border-bottom: 1px solid var(--color-border);
}

.qc__table td {
  padding: 5px 8px;
  color: var(--color-text);
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
}

.qc__table tr:last-child td {
  border-bottom: none;
}

.qc__note-cell {
  color: var(--color-text-secondary);
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
