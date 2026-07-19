<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCostsStore } from '@/stores/costs'
import type { ExpenseCreatePayload } from '@/services/api'

const router = useRouter()
const store = useCostsStore()

const saving = ref(false)
const saveError = ref<string | null>(null)

const form = ref({
  beneficiary_type: '',
  beneficiary_name: '',
  expense_type: '',
  cost_category_id: null as number | null,
  amount: 0,
  currency: 'ARS',
  usd_rate: null as number | null,
  is_recurring: false,
  recurrence_frequency: null as string | null,
  scheduled_date: null as string | null,
  due_date: null as string | null,
  payment_date: null as string | null,
  property_id: null as number | null,
  imputation: 'operacion',
  payment_method: '',
  account: '',
  payment_status: 'pending',
  notes: '',
})

async function handleSubmit() {
  saving.value = true
  saveError.value = null
  try {
    const payload: ExpenseCreatePayload = {
      beneficiary_type: form.value.beneficiary_type,
      beneficiary_name: form.value.beneficiary_name,
      expense_type: form.value.expense_type,
      cost_category_id: form.value.cost_category_id,
      amount: form.value.amount,
      currency: form.value.currency,
      usd_rate: form.value.usd_rate,
      is_recurring: form.value.is_recurring,
      recurrence_frequency: form.value.is_recurring ? form.value.recurrence_frequency : null,
      scheduled_date: form.value.is_recurring ? form.value.scheduled_date : null,
      due_date: form.value.due_date || null,
      payment_date: form.value.payment_date || null,
      property_id: form.value.property_id,
      imputation: form.value.imputation,
      payment_method: form.value.payment_method,
      account: form.value.account,
      payment_status: form.value.payment_status,
      notes: form.value.notes,
    }
    await store.createExpense(payload)
    router.push('/costes')
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : 'Error al guardar el egreso'
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
  <div class="expense-form">
    <div class="expense-form__header">
      <div>
        <h2 class="expense-form__heading">Nuevo egreso</h2>
        <p class="expense-form__sub">Complete los datos del egreso</p>
      </div>
      <RouterLink to="/costes" class="btn btn--secondary">Volver</RouterLink>
    </div>

    <form @submit.prevent="handleSubmit" class="card">
      <!-- Error message -->
      <div v-if="saveError" class="form-error">
        <p>{{ saveError }}</p>
      </div>

      <!-- Beneficiary -->
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Tipo beneficiario</label>
          <select v-model="form.beneficiary_type" class="input form-input" required>
            <option value="">Seleccionar...</option>
            <option value="propietario">Propietario</option>
            <option value="huesped">Hu&eacute;sped</option>
            <option value="proveedor">Proveedor</option>
            <option value="empleado">Empleado</option>
            <option value="gobierno">Gobierno</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Nombre beneficiario</label>
          <input v-model="form.beneficiary_name" type="text" class="input form-input" placeholder="Nombre completo" required />
        </div>
        <div class="form-group">
          <label class="form-label">Tipo de egreso</label>
          <input v-model="form.expense_type" type="text" class="input form-input" placeholder="Ej: Servicio, Impuesto, Sueldo..." />
        </div>
        <div class="form-group">
          <label class="form-label">Categor&iacute;a</label>
          <select v-model="form.cost_category_id" class="input form-input">
            <option :value="null">Seleccionar...</option>
            <option v-for="cat in store.categories" :key="cat.id" :value="cat.id">
              {{ cat.name }}
            </option>
          </select>
        </div>
      </div>

      <!-- Amount & currency -->
      <div class="form-section">
        <h3 class="form-section__title">Monto</h3>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Monto</label>
            <input v-model.number="form.amount" type="number" class="input form-input" min="0" step="0.01" required />
          </div>
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
        </div>
      </div>

      <!-- Recurrence -->
      <div class="form-section">
        <h3 class="form-section__title">Recurrencia</h3>
        <div class="form-group">
          <label class="form-checkbox">
            <input type="checkbox" v-model="form.is_recurring" />
            <span>Es recurrente</span>
          </label>
        </div>
        <div v-if="form.is_recurring" class="form-grid" style="margin-top: 12px;">
          <div class="form-group">
            <label class="form-label">Frecuencia</label>
            <select v-model="form.recurrence_frequency" class="input form-input">
              <option :value="null">Seleccionar...</option>
              <option value="mensual">Mensual</option>
              <option value="trimestral">Trimestral</option>
              <option value="anual">Anual</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Fecha programada</label>
            <input v-model="form.scheduled_date" type="date" class="input form-input" />
          </div>
        </div>
      </div>

      <!-- Dates & property -->
      <div class="form-section">
        <h3 class="form-section__title">Fechas y propiedad</h3>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Fecha vencimiento</label>
            <input v-model="form.due_date" type="date" class="input form-input" />
          </div>
          <div class="form-group">
            <label class="form-label">Fecha pago</label>
            <input v-model="form.payment_date" type="date" class="input form-input" />
          </div>
          <div class="form-group">
            <label class="form-label">Propiedad (opcional)</label>
            <select v-model="form.property_id" class="input form-input">
              <option :value="null">Sin asignar</option>
              <option v-for="prop in store.properties" :key="prop.id" :value="prop.id">
                {{ prop.name }}
              </option>
            </select>
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
        </div>
      </div>

      <!-- Payment -->
      <div class="form-section">
        <h3 class="form-section__title">Pago</h3>
        <div class="form-grid">
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
            <label class="form-label">Cuenta</label>
            <input v-model="form.account" type="text" class="input form-input" placeholder="Ej: Banco Naci&oacute;n, Caja chica..." />
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
.expense-form__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  margin-bottom: 24px;
}

.expense-form__heading {
  font-size: 1.6rem;
  font-weight: 700;
  margin-bottom: 4px;
}

.expense-form__sub {
  color: var(--color-text-secondary);
  font-size: 0.9rem;
}

.form-error {
  background: #fdecea;
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

.form-textarea {
  resize: vertical;
}

.form-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 0.95rem;
}

.form-checkbox input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
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
