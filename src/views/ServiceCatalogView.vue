<script setup lang="ts">
import { ref, onMounted } from 'vue'
import ImportWidget from '@/components/ImportWidget.vue'

const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8001/api' : '/api'

interface CatalogItem {
  id: number
  name: string
  category: string
  default_unit_cost: string | null
  cost_unit: string
  default_unit_price: string | null
  is_active: boolean
  is_from_avantio: boolean
  _dirty?: boolean
}

const items = ref<CatalogItem[]>([])
const loading = ref(true)
const saving = ref(false)
const saveMessage = ref<string | null>(null)
const newName = ref('')

async function fetchCatalog() {
  loading.value = true
  try {
    const res = await fetch(`${API_URL}/service-catalog`)
    if (res.ok) items.value = (await res.json()).map((i: CatalogItem) => ({ ...i, _dirty: false }))
  } catch { /* ignore */ }
  finally { loading.value = false }
}

function markDirty(item: CatalogItem) {
  item._dirty = true
}

function addService() {
  if (!newName.value.trim()) return
  items.value.push({
    id: 0,
    name: newName.value.trim(),
    category: 'service',
    default_unit_cost: null,
    cost_unit: 'per_booking',
    default_unit_price: null,
    is_active: true,
    is_from_avantio: false,
    _dirty: true,
  })
  newName.value = ''
}

async function saveAll() {
  saving.value = true
  saveMessage.value = null
  try {
    const dirty = items.value.filter(i => i._dirty)
    for (const item of dirty) {
      if (item.id) {
        await fetch(`${API_URL}/service-catalog/${item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: item.name,
            category: item.category,
            default_unit_cost: item.default_unit_cost ? Number(item.default_unit_cost) : null,
            cost_unit: item.cost_unit,
            default_unit_price: item.default_unit_price ? Number(item.default_unit_price) : null,
            is_active: item.is_active,
          }),
        })
      } else {
        await fetch(`${API_URL}/service-catalog`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: item.name,
            category: item.category,
            default_unit_cost: item.default_unit_cost ? Number(item.default_unit_cost) : null,
            cost_unit: item.cost_unit,
            default_unit_price: item.default_unit_price ? Number(item.default_unit_price) : null,
            is_active: item.is_active,
          }),
        })
      }
    }
    saveMessage.value = `${dirty.length} servicios guardados`
    await fetchCatalog()
    setTimeout(() => { saveMessage.value = null }, 3000)
  } catch {
    saveMessage.value = 'Error al guardar'
  } finally {
    saving.value = false
  }
}

async function deleteItem(item: CatalogItem, idx: number) {
  if (!item.id) {
    items.value.splice(idx, 1)
    return
  }
  if (!confirm(`¿Eliminar "${item.name}" del catálogo?`)) return
  try {
    await fetch(`${API_URL}/service-catalog/${item.id}`, { method: 'DELETE' })
    items.value.splice(idx, 1)
  } catch { /* ignore */ }
}

const hasDirty = () => items.value.some(i => i._dirty)

onMounted(fetchCatalog)
</script>

<template>
  <div class="catalog">
    <div class="catalog__header">
      <div>
        <h2 class="catalog__heading">Servicios</h2>
        <p class="catalog__subtitle">Catálogo maestro de servicios y extras — precios y costos por defecto</p>
      </div>
      <div class="catalog__actions">
        <span v-if="saveMessage" class="catalog__message">{{ saveMessage }}</span>
        <button class="btn btn--primary" :disabled="saving || !hasDirty()" @click="saveAll">
          {{ saving ? 'Guardando...' : 'Guardar cambios' }}
        </button>
      </div>
    </div>

    <ImportWidget entity="service_catalog" @imported="fetchCatalog" />

    <div v-if="loading" class="catalog__status card">
      <span class="spinner"></span> Cargando...
    </div>

    <div v-else class="card">
      <table class="catalog__table">
        <thead>
          <tr>
            <th>Servicio</th>
            <th>Tipo</th>
            <th class="text--right">Precio unitario</th>
            <th class="text--right">Costo unitario</th>
            <th>Unidad de costo</th>
            <th>Activo</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, idx) in items" :key="item.id || item.name" :class="{ 'catalog__row--dirty': item._dirty, 'catalog__row--inactive': !item.is_active }">
            <td class="catalog__name">{{ item.name }}</td>
            <td>
              <select v-model="item.category" class="catalog__select" @change="markDirty(item)">
                <option value="service">Servicio</option>
                <option value="extra">Extra</option>
              </select>
            </td>
            <td class="text--right">
              <input v-model="item.default_unit_price" type="number" step="0.01" class="catalog__input" placeholder="--" @input="markDirty(item)" />
            </td>
            <td class="text--right">
              <input v-model="item.default_unit_cost" type="number" step="0.01" class="catalog__input catalog__input--cost" placeholder="--" @input="markDirty(item)" />
            </td>
            <td>
              <select v-model="item.cost_unit" class="catalog__select" @change="markDirty(item)">
                <option value="per_booking">Por reserva</option>
                <option value="per_night">Por noche</option>
                <option value="per_guest">Por huésped</option>
                <option value="fixed">Fijo</option>
              </select>
            </td>
            <td>
              <input v-model="item.is_active" type="checkbox" @change="markDirty(item)" />
            </td>
            <td>
              <button v-if="!item.is_from_avantio" class="catalog__delete" @click="deleteItem(item, idx)" title="Eliminar">&times;</button>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="catalog__add">
        <input v-model="newName" type="text" class="catalog__add-input" placeholder="Nuevo servicio..." @keyup.enter="addService" />
        <button class="btn btn--secondary btn--small" @click="addService" :disabled="!newName.trim()">Agregar</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.catalog__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  gap: 16px;
  flex-wrap: wrap;
}
.catalog__heading { font-size: 1.5rem; font-weight: 600; margin: 0; }
.catalog__subtitle { color: var(--color-text-secondary); font-size: 0.9rem; margin: 4px 0 0; }
.catalog__actions { display: flex; gap: 12px; align-items: center; }
.catalog__message { font-size: 0.85rem; color: var(--color-success); }
.catalog__status { display: flex; align-items: center; gap: 12px; padding: 24px; justify-content: center; }
.catalog__table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
.catalog__table th {
  text-align: left; padding: 8px 10px; font-weight: 500;
  color: var(--color-text-secondary); border-bottom: 2px solid var(--color-border);
  font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.5px;
}
.catalog__table td { padding: 6px 10px; border-bottom: 1px solid var(--color-border-light, #f0f0f0); }
.catalog__table tr:hover { background: var(--color-surface-hover, #f9f9f9); }
.catalog__row--dirty { background: #fffde7 !important; }
.catalog__row--inactive { opacity: 0.5; }
.catalog__name { font-weight: 500; }
.catalog__input {
  width: 100px; padding: 4px 8px; border: 1px solid var(--color-border);
  border-radius: 4px; font-size: 0.85rem; text-align: right;
}
.catalog__input--cost { background: #fff8e1; }
.catalog__input:focus { outline: none; border-color: var(--color-primary); }
.catalog__select {
  padding: 4px 6px; border: 1px solid var(--color-border);
  border-radius: 4px; font-size: 0.83rem; background: white;
}
.catalog__delete {
  background: none; border: none; color: var(--color-text-secondary);
  font-size: 1.2rem; cursor: pointer; padding: 0 4px; line-height: 1;
}
.catalog__delete:hover { color: var(--color-error, #e53e3e); }
.text--right { text-align: right; }
.catalog__add {
  display: flex; gap: 8px; align-items: center;
  margin-top: 12px; padding-top: 12px;
  border-top: 1px solid var(--color-border-light, #f0f0f0);
}
.catalog__add-input {
  padding: 8px 12px; border: 1px solid var(--color-border);
  border-radius: 4px; font-size: 0.88rem; min-width: 250px;
}
</style>
