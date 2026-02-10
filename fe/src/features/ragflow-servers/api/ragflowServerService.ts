/**
 * @fileoverview API service for RAGFlow server management.
 * Admin-only endpoints for CRUD operations on RAGFlow servers.
 */
import { api } from '@/lib/api'

/**
 * Represents a RAGFlow server connection configuration.
 */
export interface RagflowServer {
  id: string
  name: string
  endpoint_url: string
  api_key: string
  description: string | null
  is_active: boolean
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

/**
 * Fetch all RAGFlow servers.
 * @returns Array of servers (API keys are masked)
 */
export const getRagflowServers = (): Promise<RagflowServer[]> =>
  api.get('/api/ragflow-servers')

/**
 * Get a single RAGFlow server by ID.
 * @param id - Server UUID
 * @returns Server record (API key masked)
 */
export const getRagflowServerById = (id: string): Promise<RagflowServer> =>
  api.get(`/api/ragflow-servers/${id}`)

/**
 * Create a new RAGFlow server.
 * @param data - Server creation data
 * @returns Created server
 */
export const createRagflowServer = (data: {
  name: string
  endpoint_url: string
  api_key: string
  description?: string
}): Promise<RagflowServer> =>
  api.post('/api/ragflow-servers', data)

/**
 * Update a RAGFlow server.
 * @param id - Server UUID
 * @param data - Fields to update
 * @returns Updated server
 */
export const updateRagflowServer = (id: string, data: Partial<RagflowServer>): Promise<RagflowServer> =>
  api.put(`/api/ragflow-servers/${id}`, data)

/**
 * Delete a RAGFlow server.
 * @param id - Server UUID
 */
export const deleteRagflowServer = (id: string): Promise<void> =>
  api.delete(`/api/ragflow-servers/${id}`)

/**
 * Test connectivity to a RAGFlow server.
 * @param params - Either { id } for existing server or { endpoint_url, api_key } for ad-hoc
 * @returns Connection test result
 */
export const testRagflowConnection = (params: {
  id?: string
  endpoint_url?: string
  api_key?: string
}): Promise<{ connected: boolean; error?: string }> =>
  api.post('/api/ragflow-servers/test-connection', params)
