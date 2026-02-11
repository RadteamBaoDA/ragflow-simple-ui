
/**
 * RagflowServerService: Business logic for RAGFlow server management.
 * Implements Singleton pattern.
 */
import { ModelFactory } from '@/shared/models/factory.js'
import { RagflowServer } from '@/shared/models/types.js'
import { ragflowProxyService } from '@/shared/services/ragflow-proxy.service.js'

/**
 * Service managing RAGFlow server CRUD and connection testing.
 */
export class RagflowServerService {
  private static instance: RagflowServerService

  /**
   * Get the shared singleton instance.
   * @returns RagflowServerService singleton
   */
  static getSharedInstance(): RagflowServerService {
    if (!this.instance) {
      this.instance = new RagflowServerService()
    }
    return this.instance
  }

  /**
   * List all RAGFlow servers.
   * @returns Array of server records
   */
  async list(): Promise<RagflowServer[]> {
    return ModelFactory.ragflowServer.findAll()
  }

  /**
   * Get a single server by ID.
   * @param id - Server UUID
   * @returns Server record or undefined
   */
  async getById(id: string): Promise<RagflowServer | undefined> {
    return ModelFactory.ragflowServer.findById(id)
  }

  /**
   * Create a new RAGFlow server entry.
   * @param data - Server creation data
   * @param userId - ID of the user performing the action
   * @returns Created server record
   */
  async create(data: {
    name: string
    endpoint_url: string
    api_key: string
    description?: string
  }, userId?: string): Promise<RagflowServer> {
    return ModelFactory.ragflowServer.create({
      ...data,
      is_active: true,
      created_by: userId,
      updated_by: userId
    } as Partial<RagflowServer>)
  }

  /**
   * Update an existing RAGFlow server.
   * @param id - Server UUID
   * @param data - Fields to update
   * @param userId - ID of the user performing the action
   * @returns Updated server record
   */
  async update(id: string, data: Partial<RagflowServer>, userId?: string): Promise<RagflowServer> {
    const existing = await ModelFactory.ragflowServer.findById(id)
    if (!existing) throw new Error('Server not found')

    return ModelFactory.ragflowServer.update(id, {
      ...data,
      updated_by: userId
    } as Partial<RagflowServer>) as Promise<RagflowServer>
  }

  /**
   * Delete a RAGFlow server.
   * @param id - Server UUID
   */
  async remove(id: string): Promise<void> {
    const existing = await ModelFactory.ragflowServer.findById(id)
    if (!existing) throw new Error('Server not found')

    // Check if any projects reference this server
    const projects = await (ModelFactory.project as any).query().where({ ragflow_server_id: id })
    if (projects.length > 0) {
      throw new Error(`Cannot delete: ${projects.length} project(s) still reference this server`)
    }

    await ModelFactory.ragflowServer.delete(id)
  }

  /**
   * Test connectivity to a RAGFlow server.
   * @param id - Server UUID (for existing servers) OR null for ad-hoc test
   * @param endpointUrl - Direct endpoint URL (for ad-hoc test)
   * @param apiKey - Direct API key (for ad-hoc test)
   * @returns True if connection is successful
   */
  async testConnection(id?: string, endpointUrl?: string, apiKey?: string): Promise<boolean> {
    if (id) {
      const server = await ModelFactory.ragflowServer.findById(id)
      if (!server) throw new Error('Server not found')
      return ragflowProxyService.testConnection(server.endpoint_url, server.api_key)
    }
    if (endpointUrl && apiKey) {
      return ragflowProxyService.testConnection(endpointUrl, apiKey)
    }
    throw new Error('Either server ID or endpoint/apiKey pair is required')
  }
}

export const ragflowServerService = RagflowServerService.getSharedInstance()
