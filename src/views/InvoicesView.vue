<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import ImportWidget from '@/components/ImportWidget.vue'

const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8001/api'
  : '/api'

interface Invoice {
  id: number
  avantio_id: string | null
  invoice_number: string | null
  date: string | null
  due_date: string | null
  type: string | null
  status: string | null
  booking_reference: string | null
  property_code: string | null
  customer_name: string | null
  subtotal: number | null
  tax_amount: number | null
  total: number | null
  currency: string
  description: string | null
}

const invoices = ref<Invoice[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const searchQuery = ref('')

const filteredInvoices = computed(() => {
  if (!searchQuery.value) return invoices.value
  const q = searchQuery.value.toLowerCase()
  return invoices.value.filter(inv =>
    (inv.invoice_number || '').toLowerCase().includes(q) ||
    (inv.customer_name || '').toLowerCase().includes(q) ||
    (inv.booking_reference || '').toLowerCase().includes(q) ||
    (inv.property_code || '').toLowerCase().includes(q)
  )
})

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '-'
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'EUR' }).format(value)
}

function formatDate(value: string | null): string {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('es-AR')
}

async function fetchInvoices() {
  loading.value = true
  error.value = null
  try {
    const res = await fetch(`${API_URL}/invoices`)
    const data = await res.json()
    invoices.value = data.data || data
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error al cargar facturas'
  } finally {
    loading.value = false
  }
}

onMounted(fetchInvoices)
</script>

<template>
  <div class="invoices">
    <div class="invoices__header">
      <div>
        <h2 class="invoices__heading">Facturas</h2>
        <p class="invoices__subtitle">Mostrando {{ filteredInvoices.length }} facturas</p>
      </div>
      <input v-model="searchQuery" type="text" class="invoices__search" placeholder="Buscar por numero, cliente o reserva..." />
    </div>

    <ImportWidget entity="invoices" @imported="fetchInvoices" />

    <div v-if="loading" class="invoices__status card">
      <span class="spinner"></span>
      <span>Cargando facturas...</span>
    </div>

    <div v-else-if="error" class="invoices__status card">
      <p class="invoices__error-text">{{ error }}</p>
      <button class="btn btn--primary" @click="fetchInvoices">Reintentar</button>
    </div>

    <div v-else-if="invoices.length === 0" class="invoices__status card">
      <p>No se encontraron facturas. Importalas desde Avantio.</p>
    </div>

    <div v-else class="card">
      <table class="invoices__table">
        <thead>
          <tr>
            <th>Factura</th>
            <th>Fecha</th>
            <th>Cliente</th>
            <th>Reserva</th>
            <th>Propiedad</th>
            <th>Estado</th>
            <th class="text--right">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="inv in filteredInvoices" :key="inv.id">
            <td class="invoices__number">{{ inv.invoice_number || inv.avantio_id || '-' }}</td>
            <td>{{ formatDate(inv.date) }}</td>
            <td>{{ inv.customer_name || '-' }}</td>
            <td>{{ inv.booking_reference || '-' }}</td>
            <td>{{ inv.property_code || '-' }}</td>
            <td>
              <span class="invoices__status-badge" :class="`invoices__status-badge--${(inv.status || 'draft').toLowerCase()}`">
                {{ inv.status || '-' }}
              </span>
            </td>
            <td class="text--right">{{ formatCurrency(inv.total) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.invoices__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  gap: 16px;
  flex-wrap: wrap;
}
.invoices__heading {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}
.invoices__subtitle {
  color: var(--color-text-secondary);
  font-size: 0.9rem;
  margin: 4px 0 0;
}
.invoices__search {
  padding: 8px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  min-width: 280px;
}
.invoices__search:focus {
  outline: none;
  border-color: var(--color-primary);
}
.invoices__status {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 24px;
  justify-content: center;
}
.invoices__error-text {
  color: var(--color-error);
}
.invoices__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}
.invoices__table th {
  text-align: left;
  padding: 10px 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
  border-bottom: 2px solid var(--color-border);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.invoices__table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border-light, #f0f0f0);
}
.invoices__table tr:hover {
  background: var(--color-surface-hover, #f9f9f9);
}
.invoices__number {
  font-weight: 500;
  color: var(--color-primary);
}
.text--right { text-align: right; }
.invoices__status-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.78rem;
  font-weight: 500;
}
.invoices__status-badge--paid { background: #e8f8f0; color: #22876b; }
.invoices__status-badge--sent { background: #e6f2f5; color: #3a8a9e; }
.invoices__status-badge--draft { background: #f5f5f5; color: #888; }
.invoices__status-badge--cancelled { background: #fdecea; color: #c0392b; }
</style>
