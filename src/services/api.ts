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

  importEntity(sessionId: string, entity: string): Promise<{ message: string }> {
    return request<{ message: string }>(`${IMPORTER_URL}/import/${sessionId}/import/${entity}`, {
      method: 'POST',
    })
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
  raw_data: Record<string, unknown> | null
}

export interface PropertiesResponse {
  data: Property[]
  total: number
}

export interface Booking {
  id: number
  avantio_id: string | null
  avantio_reference: string | null
  check_in: string | null
  check_out: string | null
  nights: number | null
  adults: number | null
  children: number | null
  status: string | null
  channel: string | null
  total_amount: string | null
  currency: string | null
  is_revenue: boolean
  property_id: number | null
  property: { id: number; name: string } | null
  raw_data: Record<string, unknown> | null
}

export interface BookingsResponse {
  data: Booking[]
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

  getProperty(id: number): Promise<Property> {
    return request<Property>(`${API_URL}/properties/${id}`)
  },

  getBookings(search?: string): Promise<BookingsResponse> {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    const query = params.toString()
    return request<BookingsResponse>(`${API_URL}/bookings${query ? `?${query}` : ''}`)
  },

  getBooking(id: number): Promise<Booking> {
    return request<Booking>(`${API_URL}/bookings/${id}`)
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

// Analytics types
export interface AnalyticsKpis {
  total_revenue: number
  total_costs: number
  net_margin: number
  total_properties: number
  total_bookings: number
  avg_occupancy: number
  avg_nightly_rate: number
  top_channel: string
}

export interface RevenueByChannel {
  channel: string
  bookings_count: number
  total_revenue: number
  avg_amount: number
  percentage: number
}

export interface RevenueByMonth {
  month: string
  bookings_count: number
  revenue: number
  costs: number
  net_margin: number
}

export interface RevenueByProperty {
  property_id: number
  property_name: string
  bookings_count: number
  revenue: number
  avg_per_booking: number
}

export interface PropertyRanking {
  property_id: number
  property_name: string
  revenue: number
  costs: number
  net_margin: number
  bookings_count: number
  occupancy_rate: number
}

export interface CostsSummary {
  total_purchases: number
  total_expenses: number
  total_costs: number
  by_category: { category: string; total: number }[]
  by_imputation: { imputation: string; total: number }[]
  by_responsible: { responsible: string; total: number }[]
}

export interface CashFlowItem {
  month: string
  count: number
  total: number
}

export interface CashFlow {
  upcoming_income: CashFlowItem[]
  upcoming_expenses: CashFlowItem[]
}

export interface PropertyProfitability {
  property_id: number
  property_name: string
  gross_revenue: number
  direct_costs: number
  gross_margin: number
  indirect_costs: number
  net_margin: number
  roi_percent: number
  nights_sold: number
  bookings_count: number
  avg_nightly_rate: number
  occupancy_rate: number
  holasur_costs: number
  owner_costs: number
}

function dateParams(from?: string, to?: string): string {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const query = params.toString()
  return query ? `?${query}` : ''
}

export const analyticsApi = {
  getKpis(from?: string, to?: string): Promise<AnalyticsKpis> {
    return request<AnalyticsKpis>(`${API_URL}/analytics/kpis${dateParams(from, to)}`)
  },

  getRevenueByChannel(from?: string, to?: string): Promise<RevenueByChannel[]> {
    return request<RevenueByChannel[]>(`${API_URL}/analytics/revenue/by-channel${dateParams(from, to)}`)
  },

  getRevenueByMonth(year?: number): Promise<RevenueByMonth[]> {
    const params = year ? `?year=${year}` : ''
    return request<RevenueByMonth[]>(`${API_URL}/analytics/revenue/by-month${params}`)
  },

  getRevenueByProperty(from?: string, to?: string): Promise<RevenueByProperty[]> {
    return request<RevenueByProperty[]>(`${API_URL}/analytics/revenue/by-property${dateParams(from, to)}`)
  },

  getPropertiesRanking(from?: string, to?: string): Promise<PropertyRanking[]> {
    return request<PropertyRanking[]>(`${API_URL}/analytics/properties/ranking${dateParams(from, to)}`)
  },

  getCostsSummary(from?: string, to?: string): Promise<CostsSummary> {
    return request<CostsSummary>(`${API_URL}/analytics/costs/summary${dateParams(from, to)}`)
  },

  getCashFlow(months?: number): Promise<CashFlow> {
    const params = months ? `?months=${months}` : ''
    return request<CashFlow>(`${API_URL}/analytics/cashflow${params}`)
  },

  getPropertyProfitability(id: number, from?: string, to?: string): Promise<PropertyProfitability> {
    return request<PropertyProfitability>(`${API_URL}/analytics/property/${id}/profitability${dateParams(from, to)}`)
  },
}
