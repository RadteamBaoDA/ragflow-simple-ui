
/**
 * RAGFlow Proxy Service: Singleton wrapping all RAGFlow HTTP API calls.
 * Resolves server credentials dynamically per serverId.
 * @description Implements Singleton Pattern per coding guidelines.
 */
import axios, { AxiosInstance, AxiosResponse } from 'axios'
import { ModelFactory } from '@/shared/models/factory.js'
import { log } from '@/shared/services/logger.service.js'

/**
 * RAGFlow API response envelope shape.
 */
interface RagflowApiResponse<T = any> {
  code: number
  data: T
  message?: string
}

/**
 * RagflowProxyService wraps all RAGFlow HTTP API interactions.
 * Each method first resolves credentials from the ragflow_servers table,
 * then makes the HTTP call using axios.
 */
export class RagflowProxyService {
  private static instance: RagflowProxyService

  /**
   * Get the shared singleton instance.
   * @returns RagflowProxyService singleton
   */
  static getSharedInstance(): RagflowProxyService {
    if (!this.instance) {
      this.instance = new RagflowProxyService()
    }
    return this.instance
  }

  /**
   * Build an axios instance configured for a specific RAGFlow server.
   * @param serverId - UUID of the ragflow_servers record
   * @returns Configured AxiosInstance
   * @throws Error if server not found or inactive
   */
  private async buildClient(serverId: string): Promise<AxiosInstance> {
    // Resolve server credentials from DB
    const server = await ModelFactory.ragflowServer.findById(serverId)
    if (!server) {
      throw new Error(`RAGFlow server not found: ${serverId}`)
    }
    if (!server.is_active) {
      throw new Error(`RAGFlow server is inactive: ${server.name}`)
    }

    // Build axios instance with base URL and auth header
    return axios.create({
      baseURL: server.endpoint_url.replace(/\/$/, ''),
      headers: {
        'Authorization': `Bearer ${server.api_key}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    })
  }

  /**
   * Unwrap RAGFlow API response and throw on error.
   * @param res - Axios response
   * @returns Data payload
   */
  private unwrap<T>(res: AxiosResponse<RagflowApiResponse<T>>): T {
    if (res.data.code !== 0) {
      throw new Error(res.data.message || `RAGFlow API error (code: ${res.data.code})`)
    }
    return res.data.data
  }

  // =========================================================================
  // Dataset Methods
  // =========================================================================

  /**
   * Create a new dataset in RAGFlow.
   * @param serverId - RAGFlow server UUID
   * @param params - Dataset creation parameters
   * @returns Created dataset object from RAGFlow
   */
  async createDataset(serverId: string, params: {
    name: string
    embedding_model?: string
    chunk_method?: string
    parser_config?: Record<string, any>
    permission?: string
  }): Promise<any> {
    const client = await this.buildClient(serverId)
    const res = await client.post('/api/v1/datasets', params)
    log.info('RAGFlow dataset created', { serverId, name: params.name })
    return this.unwrap(res)
  }

  /**
   * Update an existing dataset in RAGFlow.
   * @param serverId - RAGFlow server UUID
   * @param datasetId - RAGFlow dataset ID
   * @param params - Update parameters
   * @returns Updated dataset object
   */
  async updateDataset(serverId: string, datasetId: string, params: Record<string, any>): Promise<any> {
    const client = await this.buildClient(serverId)
    const res = await client.put(`/api/v1/datasets/${datasetId}`, params)
    return this.unwrap(res)
  }

  /**
   * Delete one or more datasets from RAGFlow.
   * @param serverId - RAGFlow server UUID
   * @param ids - Array of RAGFlow dataset IDs to delete
   */
  async deleteDatasets(serverId: string, ids: string[]): Promise<void> {
    const client = await this.buildClient(serverId)
    await client.delete('/api/v1/datasets', { data: { ids } })
    log.info('RAGFlow datasets deleted', { serverId, count: ids.length })
  }

  /**
   * List datasets from RAGFlow with optional search.
   * @param serverId - RAGFlow server UUID
   * @param query - Optional search/filter parameters
   * @returns Array of dataset objects
   */
  async listDatasets(serverId: string, query?: {
    page?: number
    page_size?: number
    orderby?: string
    desc?: boolean
    name?: string
    id?: string
  }): Promise<any[]> {
    const client = await this.buildClient(serverId)
    const res = await client.get('/api/v1/datasets', { params: query })
    return this.unwrap(res)
  }

  // =========================================================================
  // Document Methods
  // =========================================================================

  /**
   * Upload a document to a RAGFlow dataset.
   * @param serverId - RAGFlow server UUID
   * @param datasetId - RAGFlow dataset ID
   * @param file - File buffer or FormData
   * @param fileName - Name of the file
   * @returns Upload result from RAGFlow
   */
  async uploadDocument(serverId: string, datasetId: string, file: Buffer, fileName: string): Promise<any> {
    const client = await this.buildClient(serverId)
    // Build FormData for multipart upload
    const FormData = (await import('form-data')).default
    const formData = new FormData()
    formData.append('file', file, { filename: fileName })

    const res = await client.post(
      `/api/v1/datasets/${datasetId}/documents`,
      formData,
      { headers: formData.getHeaders() }
    )
    log.info('RAGFlow document uploaded', { serverId, datasetId, fileName })
    return this.unwrap(res)
  }

  /**
   * List documents in a RAGFlow dataset.
   * @param serverId - RAGFlow server UUID
   * @param datasetId - RAGFlow dataset ID
   * @param query - Optional pagination/filter params
   * @returns Array of document objects
   */
  async listDocuments(serverId: string, datasetId: string, query?: {
    page?: number
    page_size?: number
    keywords?: string
  }): Promise<any[]> {
    const client = await this.buildClient(serverId)
    const res = await client.get(`/api/v1/datasets/${datasetId}/documents`, { params: query })
    const result = this.unwrap(res)
    // RAGFlow returns { docs: [...], total: N } — extract the docs array
    return Array.isArray(result) ? result : (result as any)?.docs || []
  }

  /**
   * Delete documents from a RAGFlow dataset.
   * @param serverId - RAGFlow server UUID
   * @param datasetId - RAGFlow dataset ID
   * @param documentIds - Array of document IDs to delete
   */
  async deleteDocuments(serverId: string, datasetId: string, documentIds: string[]): Promise<void> {
    const client = await this.buildClient(serverId)
    await client.delete(`/api/v1/datasets/${datasetId}/documents`, {
      data: { ids: documentIds }
    })
  }

  /**
   * Parse (process) documents in a RAGFlow dataset.
   * @param serverId - RAGFlow server UUID
   * @param datasetId - RAGFlow dataset ID
   * @param documentIds - Array of document IDs to parse
   */
  async parseDocuments(serverId: string, datasetId: string, documentIds: string[]): Promise<void> {
    const client = await this.buildClient(serverId)
    await client.post(`/api/v1/datasets/${datasetId}/chunks`, {
      document_ids: documentIds
    })
    log.info('RAGFlow documents parsing started', { serverId, datasetId, count: documentIds.length })
  }

  // =========================================================================
  // Chat Assistant Methods
  // =========================================================================

  /**
   * Create a new chat assistant in RAGFlow.
   * @param serverId - RAGFlow server UUID
   * @param params - Chat assistant creation parameters
   * @returns Created chat assistant object
   */
  async createChatAssistant(serverId: string, params: {
    name: string
    avatar?: string
    dataset_ids?: string[]
    llm?: Record<string, any>
    prompt?: Record<string, any>
  }): Promise<any> {
    const client = await this.buildClient(serverId)
    const res = await client.post('/api/v1/chats', params)
    log.info('RAGFlow chat assistant created', { serverId, name: params.name })
    return this.unwrap(res)
  }

  /**
   * Update an existing chat assistant in RAGFlow.
   * @param serverId - RAGFlow server UUID
   * @param chatId - RAGFlow chat assistant ID
   * @param params - Update parameters
   * @returns Updated chat assistant object
   */
  async updateChatAssistant(serverId: string, chatId: string, params: Record<string, any>): Promise<any> {
    const client = await this.buildClient(serverId)
    const res = await client.put(`/api/v1/chats/${chatId}`, params)
    return this.unwrap(res)
  }

  /**
   * Delete one or more chat assistants from RAGFlow.
   * @param serverId - RAGFlow server UUID
   * @param ids - Array of chat assistant IDs to delete
   */
  async deleteChatAssistants(serverId: string, ids: string[]): Promise<void> {
    const client = await this.buildClient(serverId)
    await client.delete('/api/v1/chats', { data: { ids } })
    log.info('RAGFlow chat assistants deleted', { serverId, count: ids.length })
  }

  /**
   * List chat assistants from RAGFlow.
   * @param serverId - RAGFlow server UUID
   * @param query - Optional search/filter parameters
   * @returns Array of chat assistant objects
   */
  async listChatAssistants(serverId: string, query?: {
    page?: number
    page_size?: number
    orderby?: string
    desc?: boolean
    name?: string
    id?: string
  }): Promise<any[]> {
    const client = await this.buildClient(serverId)
    const res = await client.get('/api/v1/chats', { params: query })
    return this.unwrap(res)
  }

  // =========================================================================
  // Session Methods
  // =========================================================================

  /**
   * Create a new chat session in RAGFlow.
   * @param serverId - RAGFlow server UUID
   * @param chatId - RAGFlow chat assistant ID
   * @param params - Session creation parameters
   * @returns Created session object
   */
  async createSession(serverId: string, chatId: string, params?: { name?: string }): Promise<any> {
    const client = await this.buildClient(serverId)
    const res = await client.post(`/api/v1/chats/${chatId}/sessions`, params || {})
    return this.unwrap(res)
  }

  /**
   * List sessions for a chat assistant in RAGFlow.
   * @param serverId - RAGFlow server UUID
   * @param chatId - RAGFlow chat assistant ID
   * @returns Array of session objects
   */
  async listSessions(serverId: string, chatId: string): Promise<any[]> {
    const client = await this.buildClient(serverId)
    const res = await client.get(`/api/v1/chats/${chatId}/sessions`)
    return this.unwrap(res)
  }

  /**
   * Test connectivity to a RAGFlow server.
   * @param endpointUrl - RAGFlow API endpoint URL
   * @param apiKey - RAGFlow API key
   * @returns True if connection is successful
   */
  async testConnection(endpointUrl: string, apiKey: string): Promise<boolean> {
    try {
      const client = axios.create({
        baseURL: endpointUrl.replace(/\/$/, ''),
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      })
      // Try listing datasets as a connectivity test
      const res = await client.get('/api/v1/datasets', { params: { page: 1, page_size: 1 } })
      return res.data.code === 0
    } catch {
      return false
    }
  }
}

export const ragflowProxyService = RagflowProxyService.getSharedInstance()
