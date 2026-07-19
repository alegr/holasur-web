const IMPORTER_URL = 'http://localhost:3100'
const API_URL = 'http://localhost:8001/api'

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    },
    ...options,
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '')
    throw new Error(`HTTP ${response.status}: ${errorBody || response.statusText}`)
  }

  return response.json() as Promise<T>
}

// Importer service (Node.js on port 3100)
export interface ImportSession {
  sessionId: string
}

export interface ImportStatus {
  status: 'waiting_for_login' | 'logged_in' | 'importing' | 'done' | 'error'
  importResults?: Record<string, number>
  error?: string
}

export const importerApi = {
  startImport(): Promise<ImportSession> {
    return request<ImportSession>(`${IMPORTER_URL}/import/start`, { method: 'POST' })
  },

  getStatus(sessionId: string): Promise<ImportStatus> {
    return request<ImportStatus>(`${IMPORTER_URL}/import/${sessionId}/status`, { method: 'POST' })
  },

  runImport(sessionId: string): Promise<{ message: string }> {
    return request<{ message: string }>(`${IMPORTER_URL}/import/${sessionId}/run`, { method: 'POST' })
  },

  stopImport(sessionId: string): Promise<{ message: string }> {
    return request<{ message: string }>(`${IMPORTER_URL}/import/${sessionId}/stop`, { method: 'POST' })
  },
}

// Laravel API (port 8001)
export interface Property {
  id: number
  avantio_id: string | null
  name: string
  type: string | null
  location: string | null
  is_active: boolean
}

export interface PropertiesResponse {
  data: Property[]
  total: number
}

export interface ImportLog {
  id: number
  status: string
  results: Record<string, number> | null
  started_at: string
  finished_at: string | null
}

// Cost management types
export interface CostCategory {
  id: number
  name: string
  type: string
  description: string | null
}

export interface Supplier {
  id: number
  name: string
}

export interface PurchaseItem {
  id?: number
  cost_category_id: number | null
  description: string
  quantity: number
  unit_price: number
  total: number
}

export interface Purchase {
  id: number
  purchase_number: string | null
  supplier_name: string | null
  voucher_type: string | null
  voucher_number: string | null
  voucher_date: string | null
  economic_responsible: string | null
  imputation: string | null
  property_id: number | null
  property?: { id: number; name: string } | null
  subtotal: string | null
  iva_percent: string | null
  total: string | null
  currency: string | null
  usd_rate: string | null
  total_usd: string | null
  payment_method: string | null
  payment_status: string | null
  notes: string | null
  items?: PurchaseItem[]
}

export interface PurchaseCreatePayload {
  supplier_name: string
  voucher_type: string
  voucher_number: string
  voucher_date: string
  economic_responsible: string
  imputation: string
  property_id: number | null
  subtotal: number
  iva_percent: number
  total: number
  currency: string
  usd_rate: number | null
  payment_method: string
  payment_status: string
  notes: string
  items: Omit<PurchaseItem, 'id'>[]
}

export interface Expense {
  id: number
  expense_number: string | null
  beneficiary_type: string | null
  beneficiary_name: string | null
  expense_type: string | null
  cost_category_id: number | null
  category?: CostCategory | null
  amount: string | null
  currency: string | null
  usd_rate: string | null
  is_recurring: boolean
  recurrence_frequency: string | null
  scheduled_date: string | null
  due_date: string | null
  payment_date: string | null
  property_id: number | null
  property?: { id: number; name: string } | null
  imputation: string | null
  payment_method: string | null
  account: string | null
  payment_status: string | null
  notes: string | null
}

export interface ExpenseCreatePayload {
  beneficiary_type: string
  beneficiary_name: string
  expense_type: string
  cost_category_id: number | null
  amount: number
  currency: string
  usd_rate: number | null
  is_recurring: boolean
  recurrence_frequency: string | null
  scheduled_date: string | null
  due_date: string | null
  payment_date: string | null
  property_id: number | null
  imputation: string
  payment_method: string
  account: string
  payment_status: string
  notes: string
}

export const laravelApi = {
  getProperties(search?: string): Promise<PropertiesResponse> {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    const query = params.toString()
    return request<PropertiesResponse>(`${API_URL}/properties${query ? `?${query}` : ''}`)
  },

  getImportLogs(): Promise<{ data: ImportLog[] }> {
    return request<{ data: ImportLog[] }>(`${API_URL}/import/logs`)
  },

  // Cost management
  getCostCategories(): Promise<CostCategory[]> {
    return request<CostCategory[]>(`${API_URL}/cost-categories`)
  },

  getSuppliers(): Promise<Supplier[]> {
    return request<Supplier[]>(`${API_URL}/suppliers`)
  },

  getPurchases(filters?: { property_id?: number; payment_status?: string }): Promise<{ data: Purchase[] }> {
    const params = new URLSearchParams()
    if (filters?.property_id) params.set('property_id', String(filters.property_id))
    if (filters?.payment_status) params.set('payment_status', filters.payment_status)
    const query = params.toString()
    return request<{ data: Purchase[] }>(`${API_URL}/purchases${query ? `?${query}` : ''}`)
  },

  getPurchase(id: number): Promise<Purchase> {
    return request<Purchase>(`${API_URL}/purchases/${id}`)
  },

  createPurchase(payload: PurchaseCreatePayload): Promise<Purchase> {
    return request<Purchase>(`${API_URL}/purchases`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  getExpenses(filters?: { property_id?: number; payment_status?: string }): Promise<{ data: Expense[] }> {
    const params = new URLSearchParams()
    if (filters?.property_id) params.set('property_id', String(filters.property_id))
    if (filters?.payment_status) params.set('payment_status', filters.payment_status)
    const query = params.toString()
    return request<{ data: Expense[] }>(`${API_URL}/expenses${query ? `?${query}` : ''}`)
  },

  getExpense(id: number): Promise<Expense> {
    return request<Expense>(`${API_URL}/expenses/${id}`)
  },

  createExpense(payload: ExpenseCreatePayload): Promise<Expense> {
    return request<Expense>(`${API_URL}/expenses`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
}
