<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCostsStore } from '@/stores/costs'
import type { PurchaseCreatePayload, PurchaseItem } from '@/services/api'

const router = useRouter()
const store = useCostsStore()

const saving = ref(false)
const saveError = ref<string | null>(null)

const form = ref({
  supplier_name: '',
  voucher_type: '',
  voucher_number: '',
  voucher_date: '',
  economic_responsible: 'hola_sur',
  imputation: 'operacion',
  property_id: null as number | null,
  currency: 'ARS',
  usd_rate: null as number | null,
  payment_method: '',
  payment_status: 'pending',
  notes: '',
  iva_percent: 21,
})

interface FormItem {
  cost_category_id: number | null
  description: string
  quantity: number
  unit_price: number
}

const items = ref<FormItem[]>([
  { cost_category_id: null, description: '', quantity: 1, unit_price: 0 },
])

function addItem() {
  items.value.push({ cost_category_id: null, description: '', quantity: 1, unit_price: 0 })
}

function removeItem(index: number) {
  if (items.value.length > 1) {
    items.value.splice(index, 1)
  }
}

function itemTotal(item: FormItem): number {
  return item.quantity * item.unit_price
}

const subtotal = computed(() => {
  return items.value.reduce((sum, item) => sum + itemTotal(item), 0)
})

const ivaAmount = computed(() => {
  return subtotal.value * (form.value.iva_percent / 100)
})

const total = computed(() => {
  return subtotal.value + ivaAmount.value
})

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

async function handleSubmit() {
  saving.value = true
  saveError.value = null
  try {
    const payload: PurchaseCreatePayload = {
      supplier_name: form.value.supplier_name,
      voucher_type: form.value.voucher_type,
      voucher_number: form.value.voucher_number,
      voucher_date: form.value.voucher_date,
      economic_responsible: form.value.economic_responsible,
      imputation: form.value.imputation,
      property_id: form.value.property_id,
      subtotal: subtotal.value,
      iva_percent: form.value.iva_percent,
      total: total.value,
      currency: form.value.currency,
      usd_rate: form.value.usd_rate,
      payment_method: form.value.payment_method,
      payment_status: form.value.payment_status,
      notes: form.value.notes,
      items: items.value.map((item): Omit<PurchaseItem, 'id'> => ({
        cost_category_id: item.cost_category_id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: itemTotal(item),
      })),
    }
    await store.createPurchase(payload)
    router.push('/costes')
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : 'Error al guardar la compra'
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  store.fetchCategories()
  store.fetchProperties()
})
</script>

<template>
  <div class="purchase-form">
    <div class="purchase-form__header">
      <div>
        <h2 class="purchase-form__heading">Nueva compra</h2>
        <p class="purchase-form__sub">Complete los datos de la compra</p>
      </div>
      <RouterLink to="/costes" class="btn btn--secondary">Volver</RouterLink>
    </div>

    <form @submit.prevent="handleSubmit" class="card">
      <!-- Error message -->
      <div v-if="saveError" class="form-error">
        <p>{{ saveError }}</p>
      </div>

      <!-- Basic info -->
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Proveedor</label>
          <input v-model="form.supplier_name" type="text" class="input form-input" placeholder="Nombre del proveedor" required />
        </div>
        <div class="form-group">
          <label class="form-label">Tipo comprobante</label>
          <select v-model="form.voucher_type" class="input form-input">
            <option value="">Seleccionar...</option>
            <option value="factura_a">Factura A</option>
            <option value="factura_b">Factura B</option>
            <option value="factura_c">Factura C</option>
            <option value="recibo">Recibo</option>
            <option value="ticket">Ticket</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">N&ordm; comprobante</label>
          <input v-model="form.voucher_number" type="text" class="input form-input" placeholder="Ej: 0001-00001234" />
        </div>
        <div class="form-group">
          <label class="form-label">Fecha comprobante</label>
          <input v-model="form.voucher_date" type="date" class="input form-input" required />
        </div>
      </div>

      <!-- Economic responsible & imputation -->
      <div class="form-section">
        <h3 class="form-section__title">Responsable e imputaci&oacute;n</h3>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Responsable econ&oacute;mico</label>
            <div class="form-radio-group">
              <label class="form-radio">
                <input type="radio" v-model="form.economic_responsible" value="hola_sur" />
                <span>Hola Sur</span>
              </label>
              <label class="form-radio">
                <input type="radio" v-model="form.economic_responsible" value="propietario" />
                <span>Propietario</span>
              </label>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Imputaci&oacute;n</label>
            <select v-model="form.imputation" class="input form-input">
              <option value="operacion">Operaci&oacute;n</option>
              <option value="propiedad">Propiedad</option>
              <option value="propietario">Propietario</option>
              <option value="estructura">Estructura</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Propiedad</label>
            <select v-model="form.property_id" class="input form-input">
              <option :value="null">Sin asignar</option>
              <option v-for="prop in store.properties" :key="prop.id" :value="prop.id">
                {{ prop.name }}
              </option>
            </select>
          </div>
        </div>
      </div>

      <!-- Items -->
      <div class="form-section">
        <h3 class="form-section__title">&Iacute;tems</h3>
        <div class="items-table-wrapper">
          <table class="items-table">
            <thead>
              <tr>
                <th>Categor&iacute;a</th>
                <th>Descripci&oacute;n</th>
                <th>Cantidad</th>
                <th>Precio unitario</th>
                <th>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in items" :key="index">
                <td>
                  <select v-model="item.cost_category_id" class="input form-input">
                    <option :value="null">Seleccionar...</option>
                    <option v-for="cat in store.categories" :key="cat.id" :value="cat.id">
                      {{ cat.name }}
                    </option>
                  </select>
                </td>
                <td>
                  <input v-model="item.description" type="text" class="input form-input" placeholder="Descripci&oacute;n" />
                </td>
                <td>
                  <input v-model.number="item.quantity" type="number" class="input form-input" min="1" step="1" />
                </td>
                <td>
                  <input v-model.number="item.unit_price" type="number" class="input form-input" min="0" step="0.01" />
                </td>
                <td class="items-table__total">
                  {{ formatCurrency(itemTotal(item)) }}
                </td>
                <td>
                  <button
                    type="button"
                    class="btn btn--danger btn--small"
                    @click="removeItem(index)"
                    :disabled="items.length <= 1"
                    title="Eliminar l&iacute;nea"
                  >
                    &times;
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <button type="button" class="btn btn--secondary btn--small" @click="addItem">
          + Agregar l&iacute;nea
        </button>
      </div>

      <!-- Totals -->
      <div class="form-section">
        <h3 class="form-section__title">Totales y pago</h3>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Subtotal</label>
            <input :value="formatCurrency(subtotal)" type="text" class="input form-input" disabled />
          </div>
          <div class="form-group">
            <label class="form-label">IVA (%)</label>
            <input v-model.number="form.iva_percent" type="number" class="input form-input" min="0" step="0.5" />
          </div>
          <div class="form-group">
            <label class="form-label">Total</label>
            <input :value="formatCurrency(total)" type="text" class="input form-input form-input--highlight" disabled />
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Moneda</label>
            <select v-model="form.currency" class="input form-input">
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <div class="form-group" v-if="form.currency === 'ARS'">
            <label class="form-label">Cotizaci&oacute;n USD (opcional)</label>
            <input v-model.number="form.usd_rate" type="number" class="input form-input" min="0" step="0.01" placeholder="Ej: 950.00" />
          </div>
          <div class="form-group">
            <label class="form-label">Medio de pago</label>
            <select v-model="form.payment_method" class="input form-input">
              <option value="">Seleccionar...</option>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="tarjeta_credito">Tarjeta de cr&eacute;dito</option>
              <option value="tarjeta_debito">Tarjeta de d&eacute;bito</option>
              <option value="cheque">Cheque</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Estado de pago</label>
            <select v-model="form.payment_status" class="input form-input">
              <option value="pending">Pendiente</option>
              <option value="paid">Pagado</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Notes -->
      <div class="form-section">
        <div class="form-group">
          <label class="form-label">Notas</label>
          <textarea v-model="form.notes" class="input form-input form-textarea" rows="3" placeholder="Observaciones..."></textarea>
        </div>
      </div>

      <!-- Submit -->
      <div class="form-actions">
        <RouterLink to="/costes" class="btn btn--secondary">Cancelar</RouterLink>
        <button type="submit" class="btn btn--primary" :disabled="saving">
          <span v-if="saving" class="spinner"></span>
          {{ saving ? 'Guardando...' : 'Guardar' }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.purchase-form__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  margin-bottom: 24px;
}

.purchase-form__heading {
  font-size: 1.6rem;
  font-weight: 700;
  margin-bottom: 4px;
}

.purchase-form__sub {
  color: var(--color-text-secondary);
  font-size: 0.9rem;
}

.form-error {
  background: #fbeaea;
  color: var(--color-error);
  padding: 12px 16px;
  border-radius: var(--radius-md);
  margin-bottom: 20px;
  font-weight: 500;
}

.form-section {
  margin-top: 28px;
  padding-top: 24px;
  border-top: 1px solid var(--color-border);
}

.form-section__title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--color-heading);
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px 24px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.form-input {
  width: 100%;
}

.form-input--highlight {
  font-weight: 700;
  font-size: 1.1rem;
}

.form-textarea {
  resize: vertical;
}

.form-radio-group {
  display: flex;
  gap: 20px;
  padding-top: 4px;
}

.form-radio {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 0.95rem;
}

.items-table-wrapper {
  overflow-x: auto;
  margin-bottom: 12px;
}

.items-table {
  width: 100%;
}

.items-table th {
  font-size: 0.8rem;
}

.items-table td {
  padding: 8px 8px;
}

.items-table td .input {
  min-width: 80px;
}

.items-table__total {
  font-weight: 600;
  white-space: nowrap;
  text-align: right;
  min-width: 100px;
}

.btn--small {
  padding: 6px 12px;
  font-size: 0.85rem;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 28px;
  padding-top: 24px;
  border-top: 1px solid var(--color-border);
}
</style>
