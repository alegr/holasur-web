import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  laravelApi,
  type CostCategory,
  type Purchase,
  type Expense,
  type Property,
  type Supplier,
  type PurchaseCreatePayload,
  type ExpenseCreatePayload,
} from '@/services/api'

export const useCostsStore = defineStore('costs', () => {
  const categories = ref<CostCategory[]>([])
  const suppliers = ref<Supplier[]>([])
  const properties = ref<Property[]>([])
  const purchases = ref<Purchase[]>([])
  const expenses = ref<Expense[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchCategories() {
    try {
      categories.value = await laravelApi.getCostCategories()
    } catch (e) {
      console.error('Error fetching categories:', e)
    }
  }

  async function fetchSuppliers() {
    try {
      suppliers.value = await laravelApi.getSuppliers()
    } catch (e) {
      console.error('Error fetching suppliers:', e)
    }
  }

  async function fetchProperties() {
    try {
      const result = await laravelApi.getProperties()
      properties.value = result.data
    } catch (e) {
      console.error('Error fetching properties:', e)
    }
  }

  async function fetchPurchases(filters?: { property_id?: number; payment_status?: string }) {
    loading.value = true
    error.value = null
    try {
      const result = await laravelApi.getPurchases(filters)
      purchases.value = result.data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error al cargar compras'
    } finally {
      loading.value = false
    }
  }

  async function fetchExpenses(filters?: { property_id?: number; payment_status?: string }) {
    loading.value = true
    error.value = null
    try {
      const result = await laravelApi.getExpenses(filters)
      expenses.value = result.data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error al cargar egresos'
    } finally {
      loading.value = false
    }
  }

  async function createPurchase(payload: PurchaseCreatePayload): Promise<Purchase> {
    return laravelApi.createPurchase(payload)
  }

  async function createExpense(payload: ExpenseCreatePayload): Promise<Expense> {
    return laravelApi.createExpense(payload)
  }

  return {
    categories,
    suppliers,
    properties,
    purchases,
    expenses,
    loading,
    error,
    fetchCategories,
    fetchSuppliers,
    fetchProperties,
    fetchPurchases,
    fetchExpenses,
    createPurchase,
    createExpense,
  }
})
