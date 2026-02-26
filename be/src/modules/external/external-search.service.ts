/**
 * External Search Service
 * Business logic for external AI Search CRUD operations.
 * Resolves RAGFlow server and delegates to RagflowProxyService.
 * @description Implements Singleton Pattern per coding guidelines.
 */
import { ragflowProxyService } from "@/shared/services/ragflow-proxy.service.js";
import { ModelFactory } from "@/shared/models/factory.js";
import { log } from "@/shared/services/logger.service.js";

/**
 * Input for creating an AI Search app.
 */
interface CreateSearchInput {
  /** RAGFlow server UUID (optional — falls back to first active server) */
  server_id?: string | undefined;
  /** Name of the search app */
  name: string;
  /** Optional description */
  description?: string | undefined;
}

/**
 * Input for updating an AI Search app.
 */
interface UpdateSearchInput {
  /** RAGFlow server UUID (optional — falls back to first active server) */
  server_id?: string | undefined;
  /** ID of the search app to update */
  search_id: string;
  /** Updated name */
  name?: string | undefined;
  /** Optional search configuration object */
  search_config?: Record<string, any> | undefined;
  /** Optional description */
  description?: string | undefined;
}

/**
 * Input for listing AI Search apps.
 */
interface ListSearchInput {
  /** RAGFlow server UUID (optional — falls back to first active server) */
  server_id?: string | undefined;
  /** Search keyword filter */
  keywords?: string | undefined;
  /** Page number */
  page?: number | undefined;
  /** Items per page */
  page_size?: number | undefined;
  /** Order by field */
  orderby?: string | undefined;
  /** Descending order flag */
  desc?: boolean | undefined;
}

/**
 * ExternalSearchService handles external AI Search CRUD.
 * Uses Singleton pattern and delegates to RagflowProxyService.
 */
export class ExternalSearchService {
  /**
   * Resolve the RAGFlow server ID.
   * If server_id is provided, validate and return it.
   * Otherwise, return the first active server.
   * @param serverId - Optional server ID from request
   * @returns Resolved server ID
   * @throws Error if no server found or server is inactive
   */
  private async resolveServerId(serverId?: string): Promise<string> {
    // If server_id explicitly provided, validate existence
    if (serverId) {
      const server = await ModelFactory.ragflowServer.findById(serverId);
      if (!server) throw new Error(`RAGFlow server not found: ${serverId}`);
      if (!server.is_active)
        throw new Error(`RAGFlow server is inactive: ${serverId}`);
      return serverId;
    }

    // Fallback: find the first active server
    const servers = await ModelFactory.ragflowServer.findAll();
    const activeServer = (servers as any[]).find((s: any) => s.is_active);
    if (!activeServer) throw new Error("No active RAGFlow server available");
    return activeServer.id;
  }

  /**
   * Create an AI Search app.
   * @param data - Create input containing name, description, optional server_id
   * @returns Created search app data from RAGFlow
   */
  async createSearchApp(data: CreateSearchInput): Promise<any> {
    // Resolve server and delegate to proxy
    const serverId = await this.resolveServerId(data.server_id);
    log.debug("Creating search app via external API", {
      serverId,
      name: data.name,
    });

    return ragflowProxyService.createSearchApp(serverId, {
      name: data.name,
      description: data.description,
    });
  }

  /**
   * Update an AI Search app.
   * @param data - Update input containing search_id, name, tenant_id, etc.
   * @returns Updated search app object from RAGFlow
   */
  async updateSearchApp(data: UpdateSearchInput): Promise<any> {
    // Resolve server and delegate to proxy
    const serverId = await this.resolveServerId(data.server_id);
    log.debug("Updating search app via external API", {
      serverId,
      searchId: data.search_id,
    });

    return ragflowProxyService.updateSearchApp(serverId, data.search_id, {
      name: data.name,
      search_config: data.search_config,
      description: data.description,
    });
  }

  /**
   * Get AI Search app detail.
   * @param serverId - Optional RAGFlow server UUID
   * @param searchId - Search app ID
   * @returns Search app detail object from RAGFlow
   */
  async getSearchAppDetail(
    serverId: string | undefined,
    searchId: string,
  ): Promise<any> {
    // Resolve server and delegate to proxy
    const resolvedServerId = await this.resolveServerId(serverId);
    log.debug("Fetching search app detail via external API", {
      serverId: resolvedServerId,
      searchId,
    });

    return ragflowProxyService.getSearchAppDetail(resolvedServerId, searchId);
  }

  /**
   * List AI Search apps.
   * @param data - List input with optional pagination, filters, server_id
   * @returns Object with search_apps array and total count
   */
  async listSearchApps(data: ListSearchInput): Promise<any> {
    // Resolve server and delegate to proxy
    const serverId = await this.resolveServerId(data.server_id);
    log.debug("Listing search apps via external API", { serverId });

    return ragflowProxyService.listSearchApps(serverId, {
      keywords: data.keywords,
      page: data.page,
      page_size: data.page_size,
      orderby: data.orderby,
      desc: data.desc,
    });
  }

  /**
   * Delete an AI Search app.
   * @param serverId - Optional RAGFlow server UUID
   * @param searchId - Search app ID to delete
   * @returns Deletion result from RAGFlow
   */
  async deleteSearchApp(
    serverId: string | undefined,
    searchId: string,
  ): Promise<any> {
    // Resolve server and delegate to proxy
    const resolvedServerId = await this.resolveServerId(serverId);
    log.debug("Deleting search app via external API", {
      serverId: resolvedServerId,
      searchId,
    });

    return ragflowProxyService.deleteSearchApp(resolvedServerId, searchId);
  }
}

/** Singleton instance for external search operations */
export const externalSearchService = new ExternalSearchService();
