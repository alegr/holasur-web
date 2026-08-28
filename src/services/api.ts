const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
export const IMPORTER_URL = isLocalhost ? 'http://localhost:3100' : `${window.location.origin}/importer`
const API_URL = isLocalhost ? 'http://localhost:8001/api' : '/api'

// Import always available — server runs importer with virtual display
export const importerAvailable = true

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('holasur_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeaders(),
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

// Auth types and API
export interface AuthUser {
  id: number
  name: string
  email: string
  role: string
}

export interface LoginResponse {
  token: string
  user: AuthUser
}

export const authApi = {
  login(email: string, password: string): Promise<LoginResponse> {
    return request<LoginResponse>(`${API_URL}/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  },

  logout(): Promise<{ message: string }> {
    return request<{ message: string }>(`${API_URL}/logout`, {
      method: 'POST',
    })
  },

  getUser(): Promise<AuthUser> {
    return request<AuthUser>(`${API_URL}/user`)
  },
}

// Owner types
export interface Owner {
  id: number
  avantio_id: string
  name: string
  email: string | null
  phone: string | null
  country: string | null
  intranet_access: boolean
  properties?: Property[]
}

export const ownerApi = {
  getOwners(search?: string): Promise<{ data: Owner[]; total: number }> {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    const query = params.toString()
    return request<{ data: Owner[]; total: number }>(`${API_URL}/owners${query ? `?${query}` : ''}`)
  },

  getOwner(id: number): Promise<{ data: Owner }> {
    return request<{ data: Owner }>(`${API_URL}/owners/${id}`)
  },

  createOwner(data: {
    name: string
    email?: string
    phone?: string
    country?: string
  }): Promise<{ data: Owner }> {
    return request<{ data: Owner }>(`${API_URL}/owners`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  updateOwner(
    id: number,
    data: Partial<{ name: string; email: string; phone: string; country: string }>,
  ): Promise<{ data: Owner }> {
    return request<{ data: Owner }>(`${API_URL}/owners/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },
}

// Property Inventory types
export interface PropertyInventoryItem {
  id: number
  property_id: number
  item_name: string
  description: string | null
  quantity: number
  condition: 'good' | 'fair' | 'poor' | 'replaced'
  notes: string | null
  created_at: string
  updated_at: string
}

export const inventoryApi = {
  getItems(propertyId: number): Promise<{ data: PropertyInventoryItem[] }> {
    return request<{ data: PropertyInventoryItem[] }>(
      `${API_URL}/properties/${propertyId}/inventory`,
    )
  },

  createItem(
    propertyId: number,
    data: {
      item_name: string
      description?: string
      quantity: number
      condition: string
      notes?: string
    },
  ): Promise<{ data: PropertyInventoryItem }> {
    return request<{ data: PropertyInventoryItem }>(
      `${API_URL}/properties/${propertyId}/inventory`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    )
  },

  updateItem(
    propertyId: number,
    id: number,
    data: Partial<{
      item_name: string
      description: string
      quantity: number
      condition: string
      notes: string
    }>,
  ): Promise<{ data: PropertyInventoryItem }> {
    return request<{ data: PropertyInventoryItem }>(
      `${API_URL}/properties/${propertyId}/inventory/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
    )
  },

  deleteItem(propertyId: number, id: number): Promise<{ message: string }> {
    return request<{ message: string }>(
      `${API_URL}/properties/${propertyId}/inventory/${id}`,
      {
        method: 'DELETE',
      },
    )
  },
}

// Importer service (Node.js on port 3100)
export interface ImportSession {
  sessionId: string
}

export interface ImportStatus {
  status: 'waiting_for_login' | 'needs_login' | 'needs_2fa' | 'logged_in' | 'importing' | 'done' | 'error'
  importResults?: Record<string, number>
  error?: string
}

export interface ImportJob {
  id: string
  type: 'bulk' | 'detail'
  entity: string
  avantioId: string | null
  status: 'queued' | 'importing' | 'done' | 'error'
  records: number
  error: string | null
  createdAt: number
  startedAt: number | null
  finishedAt: number | null
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

  async getActiveSession(): Promise<{ active: boolean; sessionId?: string }> {
    return request<{ active: boolean; sessionId?: string }>(`${IMPORTER_URL}/import/active`)
  },

  importDetail(
    sessionId: string,
    entity: string,
    avantioId?: string,
  ): Promise<{ entity: string; detail: Record<string, unknown> | null; status: string; jobId?: string }> {
    return request(`${IMPORTER_URL}/import/${sessionId}/detail/${entity}`, {
      method: 'POST',
      body: avantioId ? JSON.stringify({ avantio_id: avantioId }) : undefined,
    })
  },

  getJobs(): Promise<ImportJob[]> {
    return request<ImportJob[]>(`${IMPORTER_URL}/import/jobs`)
  },

  createJob(type: 'bulk' | 'detail', entity: string, avantioId?: string): Promise<ImportJob> {
    return request<ImportJob>(`${IMPORTER_URL}/import/jobs`, {
      method: 'POST',
      body: JSON.stringify({ type, entity, avantioId }),
    })
  },

  dismissJob(jobId: string): Promise<{ dismissed: boolean; jobId: string }> {
    return request<{ dismissed: boolean; jobId: string }>(`${IMPORTER_URL}/import/jobs/${jobId}`, {
      method: 'DELETE',
    })
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
  hs_commission_percent: number | null
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

// Batch cost types
export interface BatchCostItem {
  property_id: number
  category_id: number
  amount: number
  note?: string
}

export interface BatchCostPropertyGroup {
  property_id: number
  property_name: string
  costs: { category_id: number; amount: number; note: string | null }[]
}

export interface BatchCostsResponse {
  data: BatchCostPropertyGroup[]
  month: string
}

export interface StructuralCostItem {
  category_id: number
  amount: number
  description?: string
}

export interface StructuralCostEntry {
  category_id: number
  category_name: string
  amount: number
  description: string
}

export interface StructuralCostsResponse {
  data: StructuralCostEntry[]
  month: string
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

  // Quick cost
  addQuickCost(data: {
    category_id: number
    amount: number
    note?: string
    property_id?: number
    booking_id?: number
    currency?: string
  }): Promise<{ data: Purchase }> {
    return request<{ data: Purchase }>(`${API_URL}/quick-cost`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  getRecentCosts(params: {
    property_id?: number
    booking_id?: number
  }): Promise<{
    data: {
      id: number
      date: string
      category: string
      category_id: number | null
      amount: string
      currency: string
      note: string | null
      purchase_number: string
    }[]
  }> {
    const urlParams = new URLSearchParams()
    if (params.property_id) urlParams.set('property_id', String(params.property_id))
    if (params.booking_id) urlParams.set('booking_id', String(params.booking_id))
    const query = urlParams.toString()
    return request(`${API_URL}/quick-cost/recent${query ? `?${query}` : ''}`)
  },

  // Batch costs (monthly cost entry)
  getBatchCosts(month: string): Promise<BatchCostsResponse> {
    return request<BatchCostsResponse>(`${API_URL}/batch-costs?month=${encodeURIComponent(month)}`)
  },

  saveBatchCosts(month: string, costs: BatchCostItem[]): Promise<{ message: string; created: number }> {
    return request<{ message: string; created: number }>(`${API_URL}/batch-costs`, {
      method: 'POST',
      body: JSON.stringify({ month, costs }),
    })
  },

  // Structural costs
  getStructuralCosts(month: string): Promise<StructuralCostsResponse> {
    return request<StructuralCostsResponse>(
      `${API_URL}/structural-costs?month=${encodeURIComponent(month)}`,
    )
  },

  saveStructuralCosts(
    month: string,
    costs: StructuralCostItem[],
  ): Promise<{ message: string; created: number }> {
    return request<{ message: string; created: number }>(`${API_URL}/structural-costs`, {
      method: 'POST',
      body: JSON.stringify({ month, costs }),
    })
  },

  getPayments(params?: {
    payment_type?: string
    from?: string
    to?: string
    property_code?: string
    search?: string
  }): Promise<PaymentsResponse> {
    const urlParams = new URLSearchParams()
    if (params?.payment_type) urlParams.set('payment_type', params.payment_type)
    if (params?.from) urlParams.set('from', params.from)
    if (params?.to) urlParams.set('to', params.to)
    if (params?.property_code) urlParams.set('property_code', params.property_code)
    if (params?.search) urlParams.set('search', params.search)
    const query = urlParams.toString()
    return request<PaymentsResponse>(`${API_URL}/avantio-payments${query ? `?${query}` : ''}`)
  },

  getPaymentsSummary(from?: string, to?: string): Promise<PaymentSummary[]> {
    const urlParams = new URLSearchParams()
    if (from) urlParams.set('from', from)
    if (to) urlParams.set('to', to)
    const query = urlParams.toString()
    return request<PaymentSummary[]>(`${API_URL}/avantio-payments/summary${query ? `?${query}` : ''}`)
  },
}

// Operational types
export interface BookingOperation {
  id: number
  booking_id: number
  operation_id: string
  status: string
  responsible: string | null
  commercial_notes: string | null
  operational_notes: string | null
  checklist: Record<string, boolean>
  incident_type: string | null
  incident_level: string | null
  cleaning_coordinated: boolean
  requires_maintenance: boolean
  pending_followup: boolean
  documentation: Record<string, boolean>
  closed_at: string | null
  created_at: string
  updated_at: string
}

export interface PropertyIncident {
  id: number
  property_id: number
  type: string
  title: string
  description: string
  reported_by: string | null
  status: string
  priority: string
  resolved_at: string | null
  resolution_notes: string | null
  created_at: string
  updated_at: string
}

export const operationalApi = {
  getBookingOperation(bookingId: number): Promise<{ data: BookingOperation | null }> {
    return request<{ data: BookingOperation | null }>(`${API_URL}/booking-operations/${bookingId}`)
  },

  createBookingOperation(
    bookingId: number,
    data: Partial<BookingOperation> = {},
  ): Promise<{ data: BookingOperation }> {
    return request<{ data: BookingOperation }>(`${API_URL}/booking-operations/${bookingId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  updateBookingOperation(
    bookingId: number,
    data: Partial<BookingOperation>,
  ): Promise<{ data: BookingOperation }> {
    return request<{ data: BookingOperation }>(`${API_URL}/booking-operations/${bookingId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  getPropertyIncidents(params: {
    property_id?: number
    status?: string
    type?: string
  }): Promise<{ data: PropertyIncident[] }> {
    const urlParams = new URLSearchParams()
    if (params.property_id) urlParams.set('property_id', String(params.property_id))
    if (params.status) urlParams.set('status', params.status)
    if (params.type) urlParams.set('type', params.type)
    const query = urlParams.toString()
    return request<{ data: PropertyIncident[] }>(
      `${API_URL}/property-incidents${query ? `?${query}` : ''}`,
    )
  },

  createPropertyIncident(data: {
    property_id: number
    type: string
    title: string
    description: string
    reported_by?: string
    priority?: string
  }): Promise<{ data: PropertyIncident }> {
    return request<{ data: PropertyIncident }>(`${API_URL}/property-incidents`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  updatePropertyIncident(
    id: number,
    data: Partial<PropertyIncident>,
  ): Promise<{ data: PropertyIncident }> {
    return request<{ data: PropertyIncident }>(`${API_URL}/property-incidents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },
}

// Payment types
export interface AvantioPayment {
  id: number
  payment_type: string
  date: string
  booking_reference: string | null
  property_code: string | null
  description: string | null
  counterpart: string | null
  payment_method: string | null
  amount: string
  currency: string
  state: string | null
  portal: string | null
  observations: string | null
}

export interface PaymentSummary {
  payment_type: string
  count: number
  total: number
}

export interface PaymentsResponse {
  data: AvantioPayment[]
  total: number
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
  // Enhanced KPIs (HS-45)
  avg_stay: number
  revenue_per_property: number
  gross_margin: number
  gross_margin_percent: number
  net_margin_percent: number
  avg_commission_rate: number
  total_commission: number
  top_property: { id: number; name: string; revenue: number } | null
  collection_efficiency: number
  avg_days_to_collect: number
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

// Enhanced cashflow (HS-44)
export interface CashFlowMonthly {
  month: string
  is_future: boolean
  income_received: number
  payments_made: number
  net_flow: number
  running_balance: number
  projected_income: number
}

export interface EnhancedCashFlow {
  months: number
  monthly: CashFlowMonthly[]
}

// Enhanced channel analysis (HS-42)
export interface ChannelAnalysis {
  channel: string
  bookings_count: number
  total_revenue: number
  total_commission: number
  total_costs: number
  net_revenue: number
  avg_booking_value: number
  avg_nights: number
  market_share_percent: number
}

// Payment methods analysis (HS-43)
export interface PaymentMethodItem {
  payment_method: string
  count: number
  total_amount: number
  avg_amount: number
  percentage_of_total: number
  percentage_of_type?: number
}

export interface PaymentMethodsAnalysis {
  total_amount: number
  overall: PaymentMethodItem[]
  by_type: {
    received: PaymentMethodItem[]
    made: PaymentMethodItem[]
  }
}

// Owner P&L (HS-40)
export interface OwnerPnlProperty {
  id: number
  name: string
  type: string | null
  location: string | null
  bookings_count: number
  nights_sold: number
  gross_revenue: number
  commission: number
  costs: number
  gross_margin: number
  net_margin: number
}

export interface OwnerPnl {
  owner: {
    id: number
    name: string
    email: string | null
    phone: string | null
  }
  period: { from: string | null; to: string | null }
  totals: {
    properties_count: number
    bookings_count: number
    nights_sold: number
    gross_revenue: number
    total_commissions: number
    total_costs: number
    gross_margin: number
    net_margin: number
    margin_percent: number
  }
  properties: OwnerPnlProperty[]
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

// P&L Report types
export interface BookingPnl {
  booking: {
    id: number
    reference: string | null
    check_in: string
    check_out: string
    property_name: string | null
    channel: string | null
  }
  revenue: {
    rent: number
    extras: number
    gross_total: number
    hs_commission_percent: number | null
    hs_rent_commission: number
    hs_extras_revenue: number
    owner_returns: { service: string; total: number; owner_percent: number; owner_amount: number }[]
    hs_total_revenue: number
    platform_commission: number
  }
  costs: {
    service_costs: number
    service_costs_breakdown: { category: string; amount: number }[]
    direct_costs: number
    direct_costs_breakdown: { category: string; amount: number }[]
    total_costs: number
  }
  margin: {
    hs_revenue: number
    net_margin: number
    margin_percent: number
  }
}

export interface PropertyPnl {
  property: {
    id: number
    name: string
    type: string | null
    location: string | null
  }
  period: { from: string | null; to: string | null }
  revenue: {
    total_bookings: number
    gross_revenue: number
    total_rent: number
    total_extras: number
  }
  costs: {
    platform_commissions: number
    direct_costs: number
    costs_by_category: { category: string; total: number }[]
    monthly_costs: number
  }
  payments: {
    total_received: number
    total_pending: number
    total_paid_out: number
  }
  margin: {
    gross_margin: number
    operating_margin: number
    margin_percent: number
  }
  bookings: {
    id: number
    reference: string | null
    check_in: string
    check_out: string
    channel: string | null
    total: number
    commission: number
    costs: number
    margin: number
  }[]
}

export interface GlobalPnl {
  period: { from: string | null; to: string | null }
  revenue: {
    total_bookings: number
    gross_revenue: number
    by_channel: { channel: string; total: number; count: number }[]
  }
  costs: {
    platform_commissions: number
    direct_costs: number
    structural_costs: number
    by_category: { category: string; total: number }[]
  }
  margin: {
    gross_margin: number
    operating_margin: number
    net_margin: number
    margin_percent: number
  }
  properties: {
    id: number
    name: string
    revenue: number
    costs: number
    margin: number
    bookings_count: number
  }[]
}

// Owner list types
export interface OwnerSummary {
  id: number
  name: string
  email: string | null
  phone: string | null
  property_count: number
  total_revenue: number
  total_margin: number
}

// Proration types
export interface ProrationItem {
  property_id: number
  property_name: string
  share_percent: number
  allocated_amount: number
}

export interface ProrationResponse {
  data: ProrationItem[]
  total_structural: number
  method: string
  month: string
}

// Standard cost types
export interface StandardCostItem {
  id?: number
  property_id: number
  cost_category_id: number
  category_name?: string
  standard_amount: number
}

// Deviation types
export interface DeviationItem {
  cost_category_id: number
  category: string
  standard: number
  actual: number
  deviation: number
  deviation_percent: number
}

export const reportsApi = {
  getBookingPnl(id: number): Promise<BookingPnl> {
    return request<{ data: BookingPnl }>(`${API_URL}/reports/pnl/booking/${id}`).then((r) => r.data)
  },

  getPropertyPnl(id: number, from?: string, to?: string): Promise<PropertyPnl> {
    return request<{ data: PropertyPnl }>(
      `${API_URL}/reports/pnl/property/${id}${dateParams(from, to)}`,
    ).then((r) => r.data)
  },

  getGlobalPnl(from?: string, to?: string): Promise<GlobalPnl> {
    return request<{ data: GlobalPnl }>(
      `${API_URL}/reports/pnl/global${dateParams(from, to)}`,
    ).then((r) => r.data)
  },

  getOwnerPnl(ownerId: number, from?: string, to?: string): Promise<OwnerPnl> {
    return request<{ data: OwnerPnl }>(
      `${API_URL}/reports/pnl/owner/${ownerId}${dateParams(from, to)}`,
    ).then((r) => r.data)
  },

  getOwners(from?: string, to?: string): Promise<OwnerSummary[]> {
    return request<{ data: OwnerSummary[] }>(
      `${API_URL}/reports/owners${dateParams(from, to)}`,
    ).then((r) => r.data)
  },

  getProration(month: string, method: string): Promise<ProrationResponse> {
    const params = new URLSearchParams({ month, method })
    return request<ProrationResponse>(`${API_URL}/reports/proration?${params}`)
  },

  getStandardCosts(propertyId: number): Promise<StandardCostItem[]> {
    return request<{ data: StandardCostItem[] }>(
      `${API_URL}/standard-costs?property_id=${propertyId}`,
    ).then((r) => r.data)
  },

  saveStandardCosts(
    items: { property_id: number; cost_category_id: number; standard_amount: number }[],
  ): Promise<{ message: string; saved: number }> {
    return request<{ message: string; saved: number }>(`${API_URL}/standard-costs`, {
      method: 'POST',
      body: JSON.stringify({ items }),
    })
  },

  getDeviations(propertyId: number, from?: string, to?: string): Promise<DeviationItem[]> {
    const params = new URLSearchParams({ property_id: String(propertyId) })
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    return request<{ data: DeviationItem[] }>(
      `${API_URL}/reports/deviations?${params}`,
    ).then((r) => r.data)
  },
}

export const analyticsApi = {
  getKpis(from?: string, to?: string): Promise<AnalyticsKpis> {
    return request<{ data: AnalyticsKpis }>(
      `${API_URL}/analytics/kpis${dateParams(from, to)}`,
    ).then((r) => r.data)
  },

  getRevenueByChannel(from?: string, to?: string): Promise<RevenueByChannel[]> {
    return request<{ data: RevenueByChannel[] }>(
      `${API_URL}/analytics/revenue/by-channel${dateParams(from, to)}`,
    ).then((r) => r.data)
  },

  getRevenueByMonth(year?: number): Promise<RevenueByMonth[]> {
    const params = year ? `?year=${year}` : ''
    return request<{ data: RevenueByMonth[] }>(
      `${API_URL}/analytics/revenue/by-month${params}`,
    ).then((r) => r.data)
  },

  getRevenueByProperty(from?: string, to?: string): Promise<RevenueByProperty[]> {
    return request<{ data: RevenueByProperty[] }>(
      `${API_URL}/analytics/revenue/by-property${dateParams(from, to)}`,
    ).then((r) => r.data)
  },

  getPropertiesRanking(from?: string, to?: string): Promise<PropertyRanking[]> {
    return request<{ data: PropertyRanking[] }>(
      `${API_URL}/analytics/properties/ranking${dateParams(from, to)}`,
    ).then((r) => r.data)
  },

  getCostsSummary(from?: string, to?: string): Promise<CostsSummary> {
    return request<{ data: CostsSummary }>(
      `${API_URL}/analytics/costs/summary${dateParams(from, to)}`,
    ).then((r) => r.data)
  },

  getCashFlow(months?: number, from?: string, to?: string): Promise<EnhancedCashFlow> {
    const params = new URLSearchParams()
    if (months) params.set('months', String(months))
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    const query = params.toString()
    return request<{ data: EnhancedCashFlow }>(
      `${API_URL}/analytics/cashflow${query ? `?${query}` : ''}`,
    ).then((r) => r.data)
  },

  getPropertyProfitability(
    id: number,
    from?: string,
    to?: string,
  ): Promise<PropertyProfitability> {
    return request<PropertyProfitability>(
      `${API_URL}/analytics/property/${id}/profitability${dateParams(from, to)}`,
    )
  },

  getChannels(from?: string, to?: string): Promise<ChannelAnalysis[]> {
    return request<{ data: ChannelAnalysis[] }>(
      `${API_URL}/analytics/channels${dateParams(from, to)}`,
    ).then((r) => r.data)
  },

  getPaymentMethods(from?: string, to?: string): Promise<PaymentMethodsAnalysis> {
    return request<{ data: PaymentMethodsAnalysis }>(
      `${API_URL}/analytics/payment-methods${dateParams(from, to)}`,
    ).then((r) => r.data)
  },
}
