/**
 * RAGFlow Proxy Service: Singleton wrapping all RAGFlow HTTP API calls.
 * Resolves server credentials dynamically per serverId.
 * @description Implements Singleton Pattern per coding guidelines.
 */
import axios, { AxiosError, AxiosInstance, AxiosResponse } from "axios";
import { ModelFactory } from "@/shared/models/factory.js";
import { log } from "@/shared/services/logger.service.js";

/**
 * RAGFlow API response envelope shape.
 */
interface RagflowApiResponse<T = any> {
  code: number;
  data: T;
  message?: string;
}

/**
 * RagflowProxyService wraps all RAGFlow HTTP API interactions.
 * Each method first resolves credentials from the ragflow_servers table,
 * then makes the HTTP call using axios.
 */
export class RagflowProxyService {
  private static instance: RagflowProxyService;

  /**
   * Get the shared singleton instance.
   * @returns RagflowProxyService singleton
   */
  static getSharedInstance(): RagflowProxyService {
    if (!this.instance) {
      this.instance = new RagflowProxyService();
    }
    return this.instance;
  }

  /**
   * Build an axios instance configured for a specific RAGFlow server.
   * @param serverId - UUID of the ragflow_servers record
   * @returns Configured AxiosInstance
   * @throws Error if server not found or inactive
   */
  private async buildClient(serverId: string): Promise<AxiosInstance> {
    // Resolve server credentials from DB
    const server = await ModelFactory.ragflowServer.findById(serverId);
    if (!server) {
      throw new Error(`RAGFlow server not found: ${serverId}`);
    }
    if (!server.is_active) {
      throw new Error(`RAGFlow server is inactive: ${server.name}`);
    }

    // Build axios instance with base URL and auth header
    const client = axios.create({
      baseURL: server.endpoint_url.replace(/\/$/, ""),
      headers: {
        Authorization: `Bearer ${server.api_key}`,
        "Content-Type": "application/json",
      },
      timeout: 60000,
    });

    // Intercept HTTP-level errors (network failures, 4xx/5xx) and log details
    client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        const method = error.config?.method?.toUpperCase() ?? "UNKNOWN";
        const url = error.config?.url ?? "UNKNOWN";
        const status = error.response?.status;
        const responseBody = error.response?.data;
        log.error("[RAGFlow] HTTP error response", {
          serverId,
          method,
          url,
          status,
          responseBody,
          message: error.message,
        });
        // Re-throw so callers can handle it
        return Promise.reject(error);
      },
    );

    return client;
  }

  /**
   * Unwrap RAGFlow API response and throw on error.
   * @param res - Axios response
   * @returns Data payload
   */
  private unwrap<T>(res: AxiosResponse<RagflowApiResponse<T>>): T {
    if (res.data.code !== 0) {
      // Log detailed info before throwing so errors are always visible in logs
      log.error("[RAGFlow] API returned non-zero code", {
        method: res.config?.method?.toUpperCase(),
        url: res.config?.url,
        code: res.data.code,
        message: res.data.message,
        data: res.data.data,
      });
      throw new Error(
        res.data.message || `RAGFlow API error (code: ${res.data.code})`,
      );
    }
    return res.data.data;
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
  async createDataset(
    serverId: string,
    params: {
      name: string;
      language?: string;
      embedding_model?: string;
      chunk_method?: string;
      parser_config?: Record<string, any>;
      permission?: string;
      pipeline_id?: string;
      parse_type?: number;
    },
  ): Promise<any> {
    const client = await this.buildClient(serverId);
    log.info("[RAGFlow] createDataset request", { serverId, params });
    const res = await client.post("/api/v1/datasets", params);
    log.info("[RAGFlow] createDataset response", {
      serverId,
      name: params.name,
      code: res.data.code,
      message: res.data.message,
    });
    return this.unwrap(res);
  }

  /**
   * Update an existing dataset in RAGFlow.
   * @param serverId - RAGFlow server UUID
   * @param datasetId - RAGFlow dataset ID
   * @param params - Update parameters
   * @returns Updated dataset object
   */
  async updateDataset(
    serverId: string,
    datasetId: string,
    params: Record<string, any>,
  ): Promise<any> {
    const client = await this.buildClient(serverId);
    log.info("[RAGFlow] updateDataset request", {
      serverId,
      datasetId,
      params,
    });
    const res = await client.put(`/api/v1/datasets/${datasetId}`, params);
    log.info("[RAGFlow] updateDataset response", {
      serverId,
      datasetId,
      code: res.data.code,
      message: res.data.message,
    });
    return this.unwrap(res);
  }

  /**
   * Delete one or more datasets from RAGFlow.
   * @param serverId - RAGFlow server UUID
   * @param ids - Array of RAGFlow dataset IDs to delete
   */
  async deleteDatasets(serverId: string, ids: string[]): Promise<void> {
    const client = await this.buildClient(serverId);
    await client.delete("/api/v1/datasets", { data: { ids } });
    log.info("RAGFlow datasets deleted", { serverId, count: ids.length });
  }

  /**
   * List datasets from RAGFlow with optional search.
   * @param serverId - RAGFlow server UUID
   * @param query - Optional search/filter parameters
   * @returns Array of dataset objects
   */
  async listDatasets(
    serverId: string,
    query?: {
      page?: number;
      page_size?: number;
      orderby?: string;
      desc?: boolean;
      name?: string;
      id?: string;
    },
  ): Promise<any[]> {
    const client = await this.buildClient(serverId);
    const res = await client.get("/api/v1/datasets", { params: query });
    return this.unwrap(res);
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
  async uploadDocument(
    serverId: string,
    datasetId: string,
    file: Buffer,
    fileName: string,
  ): Promise<any> {
    const client = await this.buildClient(serverId);
    // Build FormData for multipart upload
    const FormData = (await import("form-data")).default;
    const formData = new FormData();
    formData.append("file", file, { filename: fileName });

    const res = await client.post(
      `/api/v1/datasets/${datasetId}/documents`,
      formData,
      { headers: formData.getHeaders() },
    );
    log.info("RAGFlow document uploaded", { serverId, datasetId, fileName });
    return this.unwrap(res);
  }

  /**
   * List documents in a RAGFlow dataset.
   * @param serverId - RAGFlow server UUID
   * @param datasetId - RAGFlow dataset ID
   * @param query - Optional pagination/filter params
   * @returns Array of document objects
   */
  async listDocuments(
    serverId: string,
    datasetId: string,
    query?: {
      page?: number;
      page_size?: number;
      keywords?: string;
    },
  ): Promise<any[]> {
    const client = await this.buildClient(serverId);
    const res = await client.get(`/api/v1/datasets/${datasetId}/documents`, {
      params: query,
    });
    const result = this.unwrap(res);
    // RAGFlow returns { docs: [...], total: N } — extract the docs array
    return Array.isArray(result) ? result : (result as any)?.docs || [];
  }

  /**
   * Delete documents from a RAGFlow dataset.
   * @param serverId - RAGFlow server UUID
   * @param datasetId - RAGFlow dataset ID
   * @param documentIds - Array of document IDs to delete
   */
  async deleteDocuments(
    serverId: string,
    datasetId: string,
    documentIds: string[],
  ): Promise<void> {
    const client = await this.buildClient(serverId);
    await client.delete(`/api/v1/datasets/${datasetId}/documents`, {
      data: { ids: documentIds },
    });
  }

  /**
   * Parse (process) documents in a RAGFlow dataset.
   * @param serverId - RAGFlow server UUID
   * @param datasetId - RAGFlow dataset ID
   * @param documentIds - Array of document IDs to parse
   */
  async parseDocuments(
    serverId: string,
    datasetId: string,
    documentIds: string[],
  ): Promise<void> {
    const client = await this.buildClient(serverId);
    await client.post(`/api/v1/datasets/${datasetId}/chunks`, {
      document_ids: documentIds,
    });
    log.info("RAGFlow documents parsing started", {
      serverId,
      datasetId,
      count: documentIds.length,
    });
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
  async createChatAssistant(
    serverId: string,
    params: {
      name: string;
      avatar?: string;
      dataset_ids?: string[];
      llm?: Record<string, any>;
      prompt?: Record<string, any>;
    },
  ): Promise<any> {
    const client = await this.buildClient(serverId);
    const res = await client.post("/api/v1/chats", params);
    log.info("RAGFlow chat assistant created", { serverId, name: params.name });
    return this.unwrap(res);
  }

  /**
   * Update an existing chat assistant in RAGFlow.
   * @param serverId - RAGFlow server UUID
   * @param chatId - RAGFlow chat assistant ID
   * @param params - Update parameters
   * @returns Updated chat assistant object
   */
  async updateChatAssistant(
    serverId: string,
    chatId: string,
    params: Record<string, any>,
  ): Promise<any> {
    const client = await this.buildClient(serverId);
    const res = await client.put(`/api/v1/chats/${chatId}`, params);
    return this.unwrap(res);
  }

  /**
   * Delete one or more chat assistants from RAGFlow.
   * @param serverId - RAGFlow server UUID
   * @param ids - Array of chat assistant IDs to delete
   */
  async deleteChatAssistants(serverId: string, ids: string[]): Promise<void> {
    const client = await this.buildClient(serverId);
    await client.delete("/api/v1/chats", { data: { ids } });
    log.info("RAGFlow chat assistants deleted", {
      serverId,
      count: ids.length,
    });
  }

  /**
   * List chat assistants from RAGFlow.
   * @param serverId - RAGFlow server UUID
   * @param query - Optional search/filter parameters
   * @returns Array of chat assistant objects
   */
  async listChatAssistants(
    serverId: string,
    query?: {
      page?: number;
      page_size?: number;
      orderby?: string;
      desc?: boolean;
      name?: string;
      id?: string;
    },
  ): Promise<any[]> {
    const client = await this.buildClient(serverId);
    const res = await client.get("/api/v1/chats", { params: query });
    return this.unwrap(res);
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
  async createSession(
    serverId: string,
    chatId: string,
    params?: { name?: string },
  ): Promise<any> {
    const client = await this.buildClient(serverId);
    const res = await client.post(
      `/api/v1/chats/${chatId}/sessions`,
      params || {},
    );
    return this.unwrap(res);
  }

  /**
   * List sessions for a chat assistant in RAGFlow.
   * @param serverId - RAGFlow server UUID
   * @param chatId - RAGFlow chat assistant ID
   * @returns Array of session objects
   */
  async listSessions(serverId: string, chatId: string): Promise<any[]> {
    const client = await this.buildClient(serverId);
    const res = await client.get(`/api/v1/chats/${chatId}/sessions`);
    return this.unwrap(res);
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
        baseURL: endpointUrl.replace(/\/$/, ""),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      });
      // Try listing datasets as a connectivity test
      const res = await client.get("/api/v1/datasets", {
        params: { page: 1, page_size: 1 },
      });
      return res.data.code === 0;
    } catch {
      return false;
    }
  }

  /**
   * Run a detailed pre-flight diagnostic against a RAGFlow server.
   * Returns a structured result explaining what was checked and what failed.
   * @param serverId - UUID of the ragflow_servers record
   * @returns Diagnostic result with reachable, authenticated, code, and summary fields
   */
  async verifyConnection(serverId: string): Promise<{
    reachable: boolean;
    authenticated: boolean;
    endpoint: string;
    httpStatus?: number;
    ragflowCode?: number;
    ragflowMessage?: string;
    summary: string;
  }> {
    // Step 1: Resolve server record
    const server = await ModelFactory.ragflowServer.findById(serverId);
    if (!server) {
      return {
        reachable: false,
        authenticated: false,
        endpoint: "unknown",
        summary: `RAGFlow server record not found for id=${serverId}`,
      };
    }
    if (!server.is_active) {
      return {
        reachable: false,
        authenticated: false,
        endpoint: server.endpoint_url,
        summary: `RAGFlow server "${server.name}" is marked inactive in the database`,
      };
    }

    const endpoint = server.endpoint_url.replace(/\/$/, "");
    const client = axios.create({
      baseURL: endpoint,
      headers: {
        Authorization: `Bearer ${server.api_key}`,
        "Content-Type": "application/json",
      },
      timeout: 10000,
    });

    try {
      // Step 2: Attempt a lightweight authenticated call
      const res = await client.get<RagflowApiResponse<any>>(
        "/api/v1/datasets",
        {
          params: { page: 1, page_size: 1 },
        },
      );
      const ragflowCode = res.data?.code;
      const ragflowMessage = res.data?.message;

      if (ragflowCode === 0) {
        return {
          reachable: true,
          authenticated: true,
          endpoint,
          httpStatus: res.status,
          ragflowCode,
          summary: `Connection OK — endpoint reachable and API key is valid`,
        };
      }

      // Reachable but business-logic failure (e.g. bad API key, wrong tenant)
      log.error("[RAGFlow] verifyConnection: API returned non-zero code", {
        serverId,
        endpoint,
        ragflowCode,
        ragflowMessage,
      });
      return {
        reachable: true,
        authenticated: false,
        endpoint,
        httpStatus: res.status,
        ragflowCode,
        ragflowMessage: ragflowMessage ?? "",
        summary: `Endpoint reachable but RAGFlow rejected request (code=${ragflowCode}): ${ragflowMessage || "no message"}`,
      };
    } catch (err: any) {
      const axiosErr = err as AxiosError;
      const httpStatus = axiosErr.response?.status;
      const responseBody = axiosErr.response?.data;

      log.error("[RAGFlow] verifyConnection: HTTP error", {
        serverId,
        endpoint,
        httpStatus,
        responseBody,
        message: axiosErr.message,
      });

      if (httpStatus) {
        // Server responded with HTTP error (401, 403, 404, 5xx, etc.)
        return {
          reachable: true,
          authenticated: false,
          endpoint,
          httpStatus,
          summary: `Endpoint reachable but returned HTTP ${httpStatus} — check API key and RAGFlow server version`,
        };
      }

      // Network-level failure: ECONNREFUSED, ETIMEDOUT, DNS failure, etc.
      return {
        reachable: false,
        authenticated: false,
        endpoint,
        summary: `Cannot reach RAGFlow endpoint "${endpoint}": ${axiosErr.message}`,
      };
    }
  }

  // =========================================================================
  // AI Search App Methods
  // =========================================================================

  /**
   * Create a new AI Search app in RAGFlow.
   * @param serverId - RAGFlow server UUID
   * @param params - Search app creation parameters
   * @returns Created search app data (contains search_id)
   */
  async createSearchApp(
    serverId: string,
    params: {
      name: string;
      description?: string | undefined;
    },
  ): Promise<any> {
    const client = await this.buildClient(serverId);
    // SDK endpoint: POST /api/v1/searchs (uses @token_required / API key auth)
    const res = await client.post("/api/v1/searchs", params);
    log.info("RAGFlow search app created", { serverId, name: params.name });
    return this.unwrap(res);
  }

  /**
   * Update an existing AI Search app in RAGFlow.
   * @param serverId - RAGFlow server UUID
   * @param params - Update parameters including search_id, name, search_config, tenant_id
   * @returns Updated search app object
   */
  async updateSearchApp(
    serverId: string,
    searchId: string,
    params: {
      name?: string | undefined;
      description?: string | undefined;
      search_config?: Record<string, any> | undefined;
    },
  ): Promise<any> {
    const client = await this.buildClient(serverId);
    // SDK endpoint: PUT /api/v1/searchs/<search_id> (uses @token_required / API key auth)
    const res = await client.put(`/api/v1/searchs/${searchId}`, params);
    log.info("RAGFlow search app updated", { serverId, searchId });
    return this.unwrap(res);
  }

  /**
   * Get detail of an AI Search app in RAGFlow.
   * @param serverId - RAGFlow server UUID
   * @param searchId - RAGFlow search app ID
   * @returns Search app detail object
   */
  async getSearchAppDetail(serverId: string, searchId: string): Promise<any> {
    const client = await this.buildClient(serverId);
    // SDK endpoint: GET /api/v1/searchs/<search_id> (uses @token_required / API key auth)
    const res = await client.get(`/api/v1/searchs/${searchId}`);
    return this.unwrap(res);
  }

  /**
   * List AI Search apps in RAGFlow.
   * @param serverId - RAGFlow server UUID
   * @param query - Optional pagination/filter parameters
   * @returns Object with search_apps array and total count
   */
  async listSearchApps(
    serverId: string,
    query?: {
      keywords?: string | undefined;
      page?: number | undefined;
      page_size?: number | undefined;
      orderby?: string | undefined;
      desc?: boolean | undefined;
    },
  ): Promise<any> {
    const client = await this.buildClient(serverId);
    // SDK endpoint: GET /api/v1/searchs (uses @token_required / API key auth)
    const res = await client.get("/api/v1/searchs", { params: query });
    return this.unwrap(res);
  }

  /**
   * Delete an AI Search app in RAGFlow.
   * @param serverId - RAGFlow server UUID
   * @param searchId - RAGFlow search app ID to delete
   * @returns Deletion result
   */
  async deleteSearchApp(serverId: string, searchId: string): Promise<any> {
    const client = await this.buildClient(serverId);
    // SDK endpoint: DELETE /api/v1/searchs/<search_id> (uses @token_required / API key auth)
    const res = await client.delete(`/api/v1/searchs/${searchId}`);
    log.info("RAGFlow search app deleted", { serverId, searchId });
    return this.unwrap(res);
  }
}

export const ragflowProxyService = RagflowProxyService.getSharedInstance();
