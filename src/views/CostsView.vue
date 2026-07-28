<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useCostsStore } from '@/stores/costs'
import {
  laravelApi,
  type Property,
  type CostCategory,
  type BatchCostPropertyGroup,
  type StructuralCostEntry,
} from '@/services/api'

const store = useCostsStore()
type TabType = 'purchases' | 'expenses' | 'monthly' | 'structural'
const activeTab = ref<TabType>('purchases')

// ── Month selector ──────────────────────────────────────────
function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const selectedMonth = ref(currentMonth())

function monthLabel(month: string): string {
  const [y, m] = month.split('-')
  const date = new Date(Number(y), Number(m) - 1)
  return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
}

const monthOptions = computed(() => {
  const options: string[] = []
  const now = new Date()
  for (let i = -6; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    options.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return options
})

// ── Monthly batch costs (property grid) ─────────────────────
const properties = ref<Property[]>([])
const directCategories = ref<CostCategory[]>([])
const batchGrid = ref<Record<string, Record<string, number>>>({}) // propertyId -> categoryId -> amount
const batchNotes = ref<Record<string, Record<string, string>>>({}) // propertyId -> categoryId -> note
const batchLoading = ref(false)
const batchSaving = ref(false)
const batchMessage = ref<string | null>(null)

function batchCellValue(propertyId: number, categoryId: number): number | undefined {
  return batchGrid.value[String(propertyId)]?.[String(categoryId)]
}

function setBatchCell(propertyId: number, categoryId: number, value: string) {
  const pid = String(propertyId)
  const cid = String(categoryId)
  if (!batchGrid.value[pid]) batchGrid.value[pid] = {}
  const num = parseFloat(value)
  if (isNaN(num) || num <= 0) {
    delete batchGrid.value[pid][cid]
  } else {
    batchGrid.value[pid][cid] = num
  }
}

function propertyTotal(propertyId: number): number {
  const row = batchGrid.value[String(propertyId)]
  if (!row) return 0
  return Object.values(row).reduce((s, v) => s + v, 0)
}

function categoryTotal(categoryId: number): number {
  let total = 0
  for (const row of Object.values(batchGrid.value)) {
    total += row[String(categoryId)] ?? 0
  }
  return total
}

const grandTotal = computed(() => {
  let total = 0
  for (const row of Object.values(batchGrid.value)) {
    total += Object.values(row).reduce((s, v) => s + v, 0)
  }
  return total
})

async function loadBatchData() {
  batchLoading.value = true
  batchMessage.value = null
  try {
    const [propsRes, catsRaw] = await Promise.all([
      laravelApi.getProperties(),
      laravelApi.getCostCategories(),
    ])
    properties.value = propsRes.data
    const catsRes = (catsRaw as any).data || catsRaw || []
    directCategories.value = catsRes.filter((c: CostCategory) => c.type === 'direct')

    // Load existing data for the selected month
    const batchRes = await laravelApi.getBatchCosts(selectedMonth.value)
    const grid: Record<string, Record<string, number>> = {}
    const notes: Record<string, Record<string, string>> = {}

    for (const group of batchRes.data as BatchCostPropertyGroup[]) {
      const pid = String(group.property_id)
      grid[pid] = {}
      notes[pid] = {}
      for (const cost of group.costs) {
        grid[pid][String(cost.category_id)] = cost.amount
        if (cost.note) notes[pid][String(cost.category_id)] = cost.note
      }
    }

    batchGrid.value = grid
    batchNotes.value = notes
  } catch (e) {
    batchMessage.value = e instanceof Error ? e.message : 'Error al cargar datos'
  } finally {
    batchLoading.value = false
  }
}

async function saveBatchCosts() {
  batchSaving.value = true
  batchMessage.value = null
  try {
    const costs: { property_id: number; category_id: number; amount: number; note: string }[] = []
    for (const [pid, row] of Object.entries(batchGrid.value)) {
      for (const [cid, amount] of Object.entries(row)) {
        if (amount > 0) {
          costs.push({
            property_id: Number(pid),
            category_id: Number(cid),
            amount,
            note: batchNotes.value[pid]?.[cid] ?? '',
          })
        }
      }
    }

    if (costs.length === 0) {
      batchMessage.value = 'No hay costos para guardar.'
      return
    }

    const result = await laravelApi.saveBatchCosts(selectedMonth.value, costs)
    batchMessage.value = result.message
  } catch (e) {
    batchMessage.value = e instanceof Error ? e.message : 'Error al guardar'
  } finally {
    batchSaving.value = false
  }
}

// ── Structural costs ────────────────────────────────────────
const structuralCategories = ref<CostCategory[]>([])
const structuralRows = ref<{ category_id: number; amount: number | undefined; description: string }[]>([])
const structuralLoading = ref(false)
const structuralSaving = ref(false)
const structuralMessage = ref<string | null>(null)

const structuralTotal = computed(() => {
  return structuralRows.value.reduce((s, r) => s + (r.amount ?? 0), 0)
})

async function loadStructuralData() {
  structuralLoading.value = true
  structuralMessage.value = null
  try {
    const catsRaw = await laravelApi.getCostCategories()
    const cats = (catsRaw as any).data || catsRaw || []
    structuralCategories.value = cats.filter((c: CostCategory) => c.type === 'structural')

    // Load existing data
    const res = await laravelApi.getStructuralCosts(selectedMonth.value)
    const existingMap = new Map<number, StructuralCostEntry>()
    for (const entry of res.data) {
      existingMap.set(entry.category_id, entry)
    }

    structuralRows.value = structuralCategories.value.map((cat) => {
      const existing = existingMap.get(cat.id)
      return {
        category_id: cat.id,
        amount: existing ? existing.amount : undefined,
        description: existing ? existing.description : '',
      }
    })
  } catch (e) {
    structuralMessage.value = e instanceof Error ? e.message : 'Error al cargar datos'
  } finally {
    structuralLoading.value = false
  }
}

async function saveStructuralCosts() {
  structuralSaving.value = true
  structuralMessage.value = null
  try {
    const costs = structuralRows.value
      .filter((r) => r.amount && r.amount > 0)
      .map((r) => ({
        category_id: r.category_id,
        amount: r.amount!,
        description: r.description,
      }))

    if (costs.length === 0) {
      structuralMessage.value = 'No hay gastos para guardar.'
      return
    }

    const result = await laravelApi.saveStructuralCosts(selectedMonth.value, costs)
    structuralMessage.value = result.message
  } catch (e) {
    structuralMessage.value = e instanceof Error ? e.message : 'Error al guardar'
  } finally {
    structuralSaving.value = false
  }
}

// ── Tab switching / format helpers ──────────────────────────
function paymentStatusClass(status: string | null): string {
  switch (status) {
    case 'paid':
      return 'badge--success'
    case 'pending':
      return 'badge--warning'
    case 'cancelled':
      return 'badge--error'
    default:
      return ''
  }
}

function paymentStatusLabel(status: string | null): string {
  switch (status) {
    case 'paid':
      return 'Pagado'
    case 'pending':
      return 'Pendiente'
    case 'cancelled':
      return 'Cancelado'
    default:
      return status || '--'
  }
}

function formatDate(d: string | null): string {
  if (!d) return '--'
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatAmount(amount: string | number | null, currency: string | null): string {
  if (amount === null || amount === undefined) return '--'
  const num = typeof amount === 'number' ? amount : parseFloat(amount)
  if (isNaN(num)) return String(amount)
  const curr = currency || 'ARS'
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: curr }).format(num)
}

function switchTab(tab: TabType) {
  activeTab.value = tab
  if (tab === 'purchases') {
    store.fetchPurchases()
  } else if (tab === 'expenses') {
    store.fetchExpenses()
  } else if (tab === 'monthly') {
    loadBatchData()
  } else if (tab === 'structural') {
    loadStructuralData()
  }
}

// Reload when month changes
watch(selectedMonth, () => {
  if (activeTab.value === 'monthly') loadBatchData()
  else if (activeTab.value === 'structural') loadStructuralData()
})

onMounted(() => {
  store.fetchPurchases()
})
</script>

<template>
  <div class="costs">
    <div class="costs__header">
      <div>
        <h2 class="costs__heading">Costes</h2>
        <p class="costs__count" v-if="!store.loading && !store.error">
          <template v-if="activeTab === 'purchases'">
            {{ store.purchases.length }} compras
          </template>
          <template v-else-if="activeTab === 'expenses'">
            {{ store.expenses.length }} egresos
          </template>
        </p>
      </div>
      <div class="costs__actions">
        <RouterLink
          v-if="activeTab === 'purchases'"
          to="/costes/compra/nueva"
          class="btn btn--primary"
        >
          + Nueva compra
        </RouterLink>
        <RouterLink
          v-else-if="activeTab === 'expenses'"
          to="/costes/egreso/nuevo"
          class="btn btn--primary"
        >
          + Nuevo egreso
        </RouterLink>
      </div>
    </div>

    <!-- Tabs -->
    <div class="costs__tabs">
      <button
        class="costs__tab"
        :class="{ 'costs__tab--active': activeTab === 'purchases' }"
        @click="switchTab('purchases')"
      >
        Compras
      </button>
      <button
        class="costs__tab"
        :class="{ 'costs__tab--active': activeTab === 'expenses' }"
        @click="switchTab('expenses')"
      >
        Egresos
      </button>
      <button
        class="costs__tab"
        :class="{ 'costs__tab--active': activeTab === 'monthly' }"
        @click="switchTab('monthly')"
      >
        Costos mensuales
      </button>
      <button
        class="costs__tab"
        :class="{ 'costs__tab--active': activeTab === 'structural' }"
        @click="switchTab('structural')"
      >
        Gastos estructura
      </button>
    </div>

    <!-- Loading (purchases/expenses) -->
    <div v-if="(activeTab === 'purchases' || activeTab === 'expenses') && store.loading" class="costs__status card">
      <span class="spinner spinner--large"></span>
      <p>Cargando...</p>
    </div>

    <!-- Error (purchases/expenses) -->
    <div v-else-if="(activeTab === 'purchases' || activeTab === 'expenses') && store.error" class="costs__status card">
      <p class="costs__error-text">{{ store.error }}</p>
      <button class="btn btn--primary" @click="switchTab(activeTab)">Reintentar</button>
    </div>

    <!-- Purchases table -->
    <div v-else-if="activeTab === 'purchases'" class="card table-wrapper">
      <div v-if="store.purchases.length === 0" class="costs__empty">
        <p>No hay compras registradas.</p>
      </div>
      <table v-else>
        <thead>
          <tr>
            <th>N&ordm; Compra</th>
            <th>Proveedor</th>
            <th>Fecha</th>
            <th>Propiedad</th>
            <th>Total</th>
            <th>USD</th>
            <th>Estado pago</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="purchase in store.purchases" :key="purchase.id">
            <td><strong>{{ purchase.purchase_number || purchase.id }}</strong></td>
            <td>{{ purchase.supplier_name || '--' }}</td>
            <td>{{ formatDate(purchase.voucher_date) }}</td>
            <td>{{ purchase.property?.name || '--' }}</td>
            <td>{{ formatAmount(purchase.total, purchase.currency) }}</td>
            <td>{{ purchase.total_usd ? formatAmount(purchase.total_usd, 'USD') : '--' }}</td>
            <td>
              <span class="badge" :class="paymentStatusClass(purchase.payment_status)">
                {{ paymentStatusLabel(purchase.payment_status) }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Expenses table -->
    <div v-else-if="activeTab === 'expenses'" class="card table-wrapper">
      <div v-if="store.expenses.length === 0" class="costs__empty">
        <p>No hay egresos registrados.</p>
      </div>
      <table v-else>
        <thead>
          <tr>
            <th>N&ordm; Egreso</th>
            <th>Beneficiario</th>
            <th>Tipo</th>
            <th>Fecha</th>
            <th>Monto</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="expense in store.expenses" :key="expense.id">
            <td><strong>{{ expense.expense_number || expense.id }}</strong></td>
            <td>{{ expense.beneficiary_name || '--' }}</td>
            <td>{{ expense.expense_type || '--' }}</td>
            <td>{{ formatDate(expense.due_date || expense.payment_date) }}</td>
            <td>{{ formatAmount(expense.amount, expense.currency) }}</td>
            <td>
              <span class="badge" :class="paymentStatusClass(expense.payment_status)">
                {{ paymentStatusLabel(expense.payment_status) }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Monthly batch costs (spreadsheet grid) -->
    <div v-else-if="activeTab === 'monthly'">
      <div class="batch__toolbar">
        <label class="batch__month-label">
          Mes:
          <select v-model="selectedMonth" class="batch__month-select">
            <option v-for="m in monthOptions" :key="m" :value="m">{{ monthLabel(m) }}</option>
          </select>
        </label>
      </div>

      <div v-if="batchLoading" class="costs__status card">
        <span class="spinner spinner--large"></span>
        <p>Cargando grilla...</p>
      </div>

      <div v-else class="card batch__card">
        <div class="batch__scroll">
          <table class="batch__table">
            <thead>
              <tr>
                <th class="batch__th batch__th--property">Propiedad</th>
                <th
                  v-for="cat in directCategories"
                  :key="cat.id"
                  class="batch__th batch__th--category"
                  :title="cat.description || cat.name"
                >
                  {{ cat.name }}
                </th>
                <th class="batch__th batch__th--total">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="prop in properties" :key="prop.id">
                <td class="batch__td batch__td--property">{{ prop.name }}</td>
                <td v-for="cat in directCategories" :key="cat.id" class="batch__td batch__td--cell">
                  <input
                    type="number"
                    class="batch__input"
                    :value="batchCellValue(prop.id, cat.id)"
                    step="0.01"
                    min="0"
                    placeholder="0"
                    @input="setBatchCell(prop.id, cat.id, ($event.target as HTMLInputElement).value)"
                  />
                </td>
                <td class="batch__td batch__td--total">
                  {{ propertyTotal(prop.id) > 0 ? formatAmount(propertyTotal(prop.id), 'USD') : '--' }}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="batch__totals-row">
                <td class="batch__td batch__td--total-label">Totales</td>
                <td v-for="cat in directCategories" :key="cat.id" class="batch__td batch__td--total">
                  {{ categoryTotal(cat.id) > 0 ? formatAmount(categoryTotal(cat.id), 'USD') : '--' }}
                </td>
                <td class="batch__td batch__td--grand-total">
                  {{ grandTotal > 0 ? formatAmount(grandTotal, 'USD') : '--' }}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div class="batch__footer">
          <p v-if="batchMessage" class="batch__message">{{ batchMessage }}</p>
          <button
            class="btn btn--primary"
            :disabled="batchSaving"
            @click="saveBatchCosts"
          >
            {{ batchSaving ? 'Guardando...' : 'Guardar todo' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Structural costs -->
    <div v-else-if="activeTab === 'structural'">
      <div class="batch__toolbar">
        <label class="batch__month-label">
          Mes:
          <select v-model="selectedMonth" class="batch__month-select">
            <option v-for="m in monthOptions" :key="m" :value="m">{{ monthLabel(m) }}</option>
          </select>
        </label>
      </div>

      <div v-if="structuralLoading" class="costs__status card">
        <span class="spinner spinner--large"></span>
        <p>Cargando gastos de estructura...</p>
      </div>

      <div v-else class="card structural__card">
        <table class="structural__table">
          <thead>
            <tr>
              <th class="structural__th">Categoria</th>
              <th class="structural__th structural__th--amount">Monto (USD)</th>
              <th class="structural__th structural__th--desc">Descripcion</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in structuralRows" :key="row.category_id">
              <td class="structural__td structural__td--name">
                {{ structuralCategories.find(c => c.id === row.category_id)?.name ?? '--' }}
              </td>
              <td class="structural__td structural__td--amount">
                <input
                  type="number"
                  class="structural__input"
                  v-model.number="row.amount"
                  step="0.01"
                  min="0"
                  placeholder="0"
                />
              </td>
              <td class="structural__td structural__td--desc">
                <input
                  type="text"
                  class="structural__input structural__input--text"
                  v-model="row.description"
                  placeholder="Descripcion (opcional)"
                />
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="structural__totals-row">
              <td class="structural__td structural__td--total-label">Total</td>
              <td class="structural__td structural__td--total-amount">
                {{ formatAmount(structuralTotal, 'USD') }}
              </td>
              <td class="structural__td"></td>
            </tr>
          </tfoot>
        </table>

        <div class="batch__footer">
          <p v-if="structuralMessage" class="batch__message">{{ structuralMessage }}</p>
          <button
            class="btn btn--primary"
            :disabled="structuralSaving"
            @click="saveStructuralCosts"
          >
            {{ structuralSaving ? 'Guardando...' : 'Guardar' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.costs__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.costs__heading {
  font-size: 1.6rem;
  font-weight: 700;
  margin-bottom: 4px;
}

.costs__count {
  color: var(--color-text-secondary);
  font-size: 0.9rem;
}

.costs__tabs {
  display: flex;
  gap: 0;
  margin-bottom: 24px;
  border-bottom: 2px solid var(--color-border);
}

.costs__tab {
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
}

.costs__tab:hover {
  color: var(--color-text);
}

.costs__tab--active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.costs__status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 48px;
  color: var(--color-text-secondary);
}

.costs__error-text {
  color: var(--color-error);
  font-weight: 500;
}

.costs__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 48px;
  text-align: center;
  color: var(--color-text-secondary);
}

/* ── Month toolbar ──────────────────────────────────────── */
.batch__toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.batch__month-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--color-text);
}

.batch__month-select {
  padding: 8px 12px;
  border: 1.5px solid var(--color-border);
  border-radius: 6px;
  background: #fff;
  font-size: 0.9rem;
  font-family: inherit;
  text-transform: capitalize;
  cursor: pointer;
}

.batch__month-select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-lighter);
}

/* ── Batch grid (spreadsheet) ───────────────────────────── */
.batch__card {
  padding: 0;
  overflow: hidden;
}

.batch__scroll {
  overflow-x: auto;
}

.batch__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.batch__th {
  padding: 10px 8px;
  text-align: left;
  font-weight: 600;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--color-text-secondary);
  background: var(--color-cream, #f4f2e2);
  border-bottom: 2px solid var(--color-border);
  white-space: nowrap;
}

.batch__th--property {
  min-width: 160px;
  position: sticky;
  left: 0;
  z-index: 2;
  background: var(--color-cream, #f4f2e2);
}

.batch__th--category {
  min-width: 100px;
  text-align: right;
}

.batch__th--total {
  min-width: 110px;
  text-align: right;
}

.batch__td {
  padding: 4px 6px;
  border-bottom: 1px solid var(--color-border);
  vertical-align: middle;
}

.batch__td--property {
  font-weight: 500;
  white-space: nowrap;
  padding-left: 10px;
  position: sticky;
  left: 0;
  background: #fff;
  z-index: 1;
}

.batch__td--cell {
  padding: 2px 4px;
}

.batch__td--total {
  text-align: right;
  font-weight: 600;
  padding-right: 10px;
  color: var(--color-text);
}

.batch__td--total-label {
  font-weight: 700;
  padding-left: 10px;
  background: var(--color-cream, #f4f2e2);
  position: sticky;
  left: 0;
  z-index: 1;
}

.batch__td--grand-total {
  text-align: right;
  font-weight: 700;
  padding-right: 10px;
  color: var(--color-primary);
}

.batch__totals-row td {
  background: var(--color-cream, #f4f2e2);
  border-top: 2px solid var(--color-border);
}

.batch__input {
  width: 100%;
  max-width: 100px;
  padding: 6px 8px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 0.85rem;
  font-family: inherit;
  text-align: right;
  background: #fff;
  transition: border-color 0.15s;
  -moz-appearance: textfield;
  appearance: textfield;
}

.batch__input::-webkit-outer-spin-button,
.batch__input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.batch__input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-lighter);
}

.batch__input::placeholder {
  color: var(--color-text-secondary);
  opacity: 0.4;
}

.batch__footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  border-top: 1px solid var(--color-border);
}

.batch__message {
  font-size: 0.9rem;
  color: var(--color-text-secondary);
}

/* ── Structural costs ───────────────────────────────────── */
.structural__card {
  padding: 0;
  overflow: hidden;
}

.structural__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.structural__th {
  padding: 12px 16px;
  text-align: left;
  font-weight: 600;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--color-text-secondary);
  background: var(--color-cream, #f4f2e2);
  border-bottom: 2px solid var(--color-border);
}

.structural__th--amount {
  width: 180px;
  text-align: right;
}

.structural__th--desc {
  width: 40%;
}

.structural__td {
  padding: 8px 16px;
  border-bottom: 1px solid var(--color-border);
  vertical-align: middle;
}

.structural__td--name {
  font-weight: 500;
}

.structural__td--amount {
  text-align: right;
}

.structural__td--desc {
  /* no special styles */
}

.structural__td--total-label {
  font-weight: 700;
}

.structural__td--total-amount {
  text-align: right;
  font-weight: 700;
  color: var(--color-primary);
}

.structural__totals-row td {
  background: var(--color-cream, #f4f2e2);
  border-top: 2px solid var(--color-border);
}

.structural__input {
  width: 100%;
  max-width: 160px;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 0.85rem;
  font-family: inherit;
  text-align: right;
  background: #fff;
  transition: border-color 0.15s;
  -moz-appearance: textfield;
  appearance: textfield;
}

.structural__input::-webkit-outer-spin-button,
.structural__input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.structural__input--text {
  max-width: 100%;
  text-align: left;
}

.structural__input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-lighter);
}

.structural__input::placeholder {
  color: var(--color-text-secondary);
  opacity: 0.5;
}

@media (max-width: 768px) {
  .costs__header {
    flex-direction: column;
    gap: 12px;
  }

  .costs__heading {
    font-size: 1.3rem;
  }

  .costs__tabs {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .costs__tab {
    padding: 10px 16px;
    font-size: 0.85rem;
    white-space: nowrap;
  }

  .structural__th--amount {
    width: 120px;
  }

  .structural__th--desc {
    width: auto;
  }

  .structural__td {
    padding: 6px 10px;
  }

  .structural__input {
    max-width: 120px;
  }
}
</style>
