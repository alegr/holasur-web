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
}
