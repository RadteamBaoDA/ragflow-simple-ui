/**
 * ProjectSearchService: Business logic for project AI Search app management.
 * Handles CRUD with RAGFlow search app sync.
 * Implements Singleton pattern.
 */
import { ModelFactory } from "@/shared/models/factory.js";
import { ProjectSearch } from "@/shared/models/types.js";
import { ragflowProxyService } from "@/shared/services/ragflow-proxy.service.js";
import {
  auditService,
  AuditAction,
  AuditResourceType,
} from "@/modules/audit/audit.service.js";
import { ProjectActor } from "@/modules/projects/project.service.js";

/**
 * Service managing project AI Search apps.
 */
export class ProjectSearchService {
  private static instance: ProjectSearchService;

  /**
   * Get the shared singleton instance.
   * @returns ProjectSearchService singleton
   */
  static getSharedInstance(): ProjectSearchService {
    if (!this.instance) {
      this.instance = new ProjectSearchService();
    }
    return this.instance;
  }

  /**
   * List search apps for a project.
   * @param projectId - Project UUID
   * @returns Array of project searches
   */
  async listByProject(projectId: string): Promise<ProjectSearch[]> {
    return ModelFactory.projectSearch.findByProject(projectId);
  }

  /**
   * Get a single search app by ID.
   * @param id - Search UUID
   * @returns Search record or undefined
   */
  async getById(id: string): Promise<ProjectSearch | undefined> {
    return ModelFactory.projectSearch.findById(id);
  }

  /**
   * Create a new search app.
   * Creates both locally and in RAGFlow.
   * @param data - Search creation data
   * @param serverId - RAGFlow server ID
   * @param userId - User performing the action
   * @param actor - Actor info for audit logging
   * @returns Created search record
   */
  async create(
    data: {
      project_id: string;
      name: string;
      description?: string;
      dataset_ids?: string[];
      ragflow_dataset_ids?: string[];
      search_config?: Record<string, any>;
    },
    serverId: string,
    userId?: string,
    actor?: ProjectActor,
  ): Promise<ProjectSearch> {
    // Create in RAGFlow first
    let ragflowSearch: any = null;
    try {
      ragflowSearch = await ragflowProxyService.createSearchApp(serverId, {
        name: data.name,
        description: data.description,
      });
    } catch (err) {
      console.error("Failed to create RAGFlow search app:", err);
      throw new Error(
        "Failed to create RAGFlow search app. Please verify server connection.",
      );
    }

    // Build the search_config to send to RAGFlow if provided
    if (ragflowSearch?.search_id && data.search_config) {
      try {
        await ragflowProxyService.updateSearchApp(
          serverId,
          ragflowSearch.search_id,
          {
            search_config: data.search_config,
          },
        );
      } catch (err) {
        console.error("Failed to update RAGFlow search config:", err);
      }
    }

    // Create local record
    const search = await ModelFactory.projectSearch.create({
      project_id: data.project_id,
      name: data.name,
      description: data.description || null,
      ragflow_search_id: ragflowSearch?.search_id || null,
      dataset_ids: data.dataset_ids || [],
      ragflow_dataset_ids: data.ragflow_dataset_ids || [],
      search_config: data.search_config || {},
      status: "active",
      last_synced_at: new Date(),
      created_by: actor?.id ?? userId,
      updated_by: actor?.id ?? userId,
    } as Partial<ProjectSearch>);

    // Log audit event
    if (actor) {
      await auditService.log({
        userId: actor.id,
        userEmail: actor.email,
        action: AuditAction.CREATE_CHAT, // Reuse existing action enum
        resourceType: AuditResourceType.PROJECT_CHAT,
        resourceId: search.id,
        details: {
          project_id: data.project_id,
          name: data.name,
          type: "search",
        },
        ipAddress: actor.ip,
      });
    }

    return search;
  }

  /**
   * Update a search app.
   * Updates both locally and in RAGFlow.
   * @param id - Search UUID
   * @param data - Fields to update
   * @param serverId - RAGFlow server ID
   * @param userId - User performing the action
   * @param actor - Actor info for audit logging
   * @returns Updated search record
   */
  async update(
    id: string,
    data: Partial<ProjectSearch>,
    serverId: string,
    userId?: string,
    actor?: ProjectActor,
  ): Promise<ProjectSearch> {
    const existing = await ModelFactory.projectSearch.findById(id);
    if (!existing) throw new Error("Search app not found");

    // Update in RAGFlow if it has a ragflow_search_id
    if (existing.ragflow_search_id) {
      try {
        const ragflowUpdate: Record<string, any> = {};
        if (data.name) ragflowUpdate.name = data.name;
        if (data.description !== undefined)
          ragflowUpdate.description = data.description;
        if (data.search_config)
          ragflowUpdate.search_config = data.search_config;

        if (Object.keys(ragflowUpdate).length > 0) {
          await ragflowProxyService.updateSearchApp(
            serverId,
            existing.ragflow_search_id,
            ragflowUpdate,
          );
        }
      } catch (err) {
        console.error("Failed to update RAGFlow search app:", err);
      }
    }

    // Update local record
    const search = (await ModelFactory.projectSearch.update(id, {
      ...data,
      last_synced_at: new Date(),
      updated_by: actor?.id ?? userId,
    } as Partial<ProjectSearch>)) as ProjectSearch;

    // Log audit event
    if (actor) {
      await auditService.log({
        userId: actor.id,
        userEmail: actor.email,
        action: AuditAction.UPDATE_CHAT,
        resourceType: AuditResourceType.PROJECT_CHAT,
        resourceId: id,
        details: { changes: data, type: "search" },
        ipAddress: actor.ip,
      });
    }

    return search;
  }

  /**
   * Delete a search app.
   * Deletes from both local DB and RAGFlow.
   * @param id - Search UUID
   * @param serverId - RAGFlow server ID
   * @param actor - Actor info for audit logging
   */
  async remove(
    id: string,
    serverId?: string,
    actor?: ProjectActor,
  ): Promise<void> {
    const existing = await ModelFactory.projectSearch.findById(id);
    if (!existing) throw new Error("Search app not found");

    // Delete from RAGFlow
    if (serverId && existing.ragflow_search_id) {
      try {
        await ragflowProxyService.deleteSearchApp(
          serverId,
          existing.ragflow_search_id,
        );
      } catch (err) {
        console.error("Failed to delete RAGFlow search app:", err);
      }
    }

    await ModelFactory.projectSearch.delete(id);

    // Log audit event
    if (actor) {
      await auditService.log({
        userId: actor.id,
        userEmail: actor.email,
        action: AuditAction.DELETE_CHAT,
        resourceType: AuditResourceType.PROJECT_CHAT,
        resourceId: id,
        details: { name: existing.name, type: "search" },
        ipAddress: actor.ip,
      });
    }
  }

  /**
   * Sync a search app's data from RAGFlow.
   * @param id - Search UUID
   * @param serverId - RAGFlow server ID
   * @returns Updated search record
   */
  async sync(id: string, serverId: string): Promise<ProjectSearch> {
    const existing = await ModelFactory.projectSearch.findById(id);
    if (!existing) throw new Error("Search app not found");
    if (!existing.ragflow_search_id)
      throw new Error("Search app has no RAGFlow ID linked");

    // Fetch latest detail from RAGFlow
    const detail = await ragflowProxyService.getSearchAppDetail(
      serverId,
      existing.ragflow_search_id,
    );

    if (!detail) throw new Error("RAGFlow search app not found on server");

    return ModelFactory.projectSearch.update(id, {
      name: detail.name || existing.name,
      description: detail.description ?? existing.description,
      search_config: detail.search_config || existing.search_config,
      last_synced_at: new Date(),
    }) as Promise<ProjectSearch>;
  }
}

export const projectSearchService = ProjectSearchService.getSharedInstance();
