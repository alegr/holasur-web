<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useCostsStore } from '@/stores/costs'

const store = useCostsStore()
const activeTab = ref<'purchases' | 'expenses'>('purchases')

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

function formatAmount(amount: string | null, currency: string | null): string {
  if (!amount) return '--'
  const num = parseFloat(amount)
  if (isNaN(num)) return amount
  const curr = currency || 'ARS'
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: curr }).format(num)
}

function switchTab(tab: 'purchases' | 'expenses') {
  activeTab.value = tab
  if (tab === 'purchases') {
    store.fetchPurchases()
  } else {
    store.fetchExpenses()
  }
}

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
          <template v-else>
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
          v-else
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
    </div>

    <!-- Loading -->
    <div v-if="store.loading" class="costs__status card">
      <span class="spinner spinner--large"></span>
      <p>Cargando...</p>
    </div>

    <!-- Error -->
    <div v-else-if="store.error" class="costs__status card">
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
    <div v-else class="card table-wrapper">
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
</style>
