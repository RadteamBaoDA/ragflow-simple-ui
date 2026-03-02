/**
 * ProjectService: Business logic for project management.
 * Handles CRUD, permission resolution, and RAGFlow server binding.
 * Implements Singleton pattern.
 */
import { ModelFactory } from "@/shared/models/factory.js";
import { Project, ProjectPermission } from "@/shared/models/types.js";
import { isAdminRole } from "@/shared/config/rbac.js";
import {
  auditService,
  AuditAction,
  AuditResourceType,
} from "@/modules/audit/audit.service.js";

/** Actor context for audit logging. */
export interface ProjectActor {
  id: string;
  email: string;
  ip?: string | undefined;
}

/**
 * Service managing project lifecycle and permissions.
 */
export class ProjectService {
  private static instance: ProjectService;

  /**
   * Get the shared singleton instance.
   * @returns ProjectService singleton
   */
  static getSharedInstance(): ProjectService {
    if (!this.instance) {
      this.instance = new ProjectService();
    }
    return this.instance;
  }

  /**
   * List projects accessible by a user.
   * Admins see all projects; others see:
   *   - All public projects (is_private = false)
   *   - Private projects where user's team has a permission entry
   * @param userId - Current user ID
   * @param userRole - User's system role
   * @param userTeamIds - Array of team IDs the user belongs to
   * @returns Array of projects the user can access
   */
  async listForUser(
    userId: string,
    userRole: string,
    userTeamIds: string[] = [],
  ): Promise<Project[]> {
    // Admins/leaders can see all projects
    if (isAdminRole(userRole)) {
      return ModelFactory.project.findAll();
    }

    // Step 1: Get all public projects
    const publicProjects = await (ModelFactory.project as any)
      .query()
      .where({ is_private: false });

    // Step 2: Find private project IDs where user's team has any permission
    const projectIds = new Set<string>();

    for (const teamId of userTeamIds) {
      const teamPerms = await ModelFactory.projectPermission.findByGrantee(
        "team",
        teamId,
      );
      teamPerms.forEach((p) => projectIds.add(p.project_id));
    }

    // Step 3: Fetch private projects the user has access to
    let privateProjects: Project[] = [];
    if (projectIds.size > 0) {
      privateProjects = await (ModelFactory.project as any)
        .query()
        .where({ is_private: true })
        .whereIn("id", Array.from(projectIds));
    }

    // Merge and deduplicate
    const allMap = new Map<string, Project>();
    for (const p of publicProjects) allMap.set(p.id, p);
    for (const p of privateProjects) allMap.set(p.id, p);
    return Array.from(allMap.values());
  }

  /**
   * Get a project by ID.
   * @param id - Project UUID
   * @returns Project or undefined
   */
  async getById(id: string): Promise<Project | undefined> {
    return ModelFactory.project.findById(id);
  }

  /**
   * Create a new project. Admin only.
   * @param data - Project creation data
   * @param userId - User performing the action
   * @returns Created project
   */
  async create(
    data: {
      name: string;
      description?: string;
      avatar?: string;
      ragflow_server_id?: string;
      default_embedding_model?: string;
      default_chunk_method?: string;
      default_parser_config?: Record<string, any>;
    },
    actor?: ProjectActor,
  ): Promise<Project> {
    // Validate ragflow_server_id if provided
    if (data.ragflow_server_id) {
      const server = await ModelFactory.ragflowServer.findById(
        data.ragflow_server_id,
      );
      if (!server) throw new Error("RAGFlow server not found");
    }

    const project = await ModelFactory.project.create({
      ...data,
      status: "active",
      created_by: actor?.id,
      updated_by: actor?.id,
    } as Partial<Project>);

    // Log audit event
    if (actor) {
      await auditService.log({
        userId: actor.id,
        userEmail: actor.email,
        action: AuditAction.CREATE_PROJECT,
        resourceType: AuditResourceType.PROJECT,
        resourceId: project.id,
        details: { name: data.name },
        ipAddress: actor.ip,
      });
    }

    return project;
  }

  /**
   * Update an existing project.
   * @param id - Project UUID
   * @param data - Fields to update
   * @param userId - User performing the action
   * @returns Updated project
   */
  async update(
    id: string,
    data: Partial<Project>,
    actor?: ProjectActor,
  ): Promise<Project> {
    const existing = await ModelFactory.project.findById(id);
    if (!existing) throw new Error("Project not found");

    // Validate ragflow_server_id if being changed
    if (
      data.ragflow_server_id &&
      data.ragflow_server_id !== existing.ragflow_server_id
    ) {
      const server = await ModelFactory.ragflowServer.findById(
        data.ragflow_server_id,
      );
      if (!server) throw new Error("RAGFlow server not found");
    }

    const project = (await ModelFactory.project.update(id, {
      ...data,
      updated_by: actor?.id,
    } as Partial<Project>)) as Project;

    // Log audit event
    if (actor) {
      await auditService.log({
        userId: actor.id,
        userEmail: actor.email,
        action: AuditAction.UPDATE_PROJECT,
        resourceType: AuditResourceType.PROJECT,
        resourceId: id,
        details: { changes: data },
        ipAddress: actor.ip,
      });
    }

    return project;
  }

  /**
   * Delete a project and all cascading data.
   * @param id - Project UUID
   */
  async remove(id: string, actor?: ProjectActor): Promise<void> {
    const existing = await ModelFactory.project.findById(id);
    if (!existing) throw new Error("Project not found");
    await ModelFactory.project.delete(id);

    // Log audit event
    if (actor) {
      await auditService.log({
        userId: actor.id,
        userEmail: actor.email,
        action: AuditAction.DELETE_PROJECT,
        resourceType: AuditResourceType.PROJECT,
        resourceId: id,
        details: { name: existing.name },
        ipAddress: actor.ip,
      });
    }
  }

  // =========================================================================
  // Permission Management
  // =========================================================================

  /**
   * Get all permissions for a project.
   * @param projectId - Project UUID
   * @returns Array of permissions
   */
  async getPermissions(projectId: string): Promise<ProjectPermission[]> {
    return ModelFactory.projectPermission.findByProject(projectId);
  }

  /**
   * Set permissions for a grantee on a project (upsert).
   * @param data - Permission data
   * @param userId - User performing the action
   * @returns Upserted permission
   */
  async setPermission(
    data: {
      project_id: string;
      grantee_type: string;
      grantee_id: string;
      tab_documents: string;
      tab_chat: string;
      tab_settings: string;
    },
    actor?: ProjectActor,
  ): Promise<ProjectPermission> {
    const permission = await ModelFactory.projectPermission.upsert({
      ...data,
      created_by: actor?.id,
      updated_by: actor?.id,
    } as Partial<ProjectPermission>);

    // Log audit event
    if (actor) {
      await auditService.log({
        userId: actor.id,
        userEmail: actor.email,
        action: AuditAction.SET_PROJECT_PERMISSION,
        resourceType: AuditResourceType.PROJECT_PERMISSION,
        resourceId: permission.id,
        details: {
          project_id: data.project_id,
          grantee_type: data.grantee_type,
          grantee_id: data.grantee_id,
        },
        ipAddress: actor.ip,
      });
    }

    return permission;
  }

  /**
   * Remove a permission.
   * @param permissionId - Permission UUID
   */
  async removePermission(
    permissionId: string,
    actor?: ProjectActor,
  ): Promise<void> {
    await ModelFactory.projectPermission.delete(permissionId);

    // Log audit event
    if (actor) {
      await auditService.log({
        userId: actor.id,
        userEmail: actor.email,
        action: AuditAction.DELETE_PROJECT_PERMISSION,
        resourceType: AuditResourceType.PROJECT_PERMISSION,
        resourceId: permissionId,
        ipAddress: actor.ip,
      });
    }
  }

  /**
   * Check user's effective permission for a project tab.
   * @param projectId - Project UUID
   * @param userId - User UUID
   * @param userRole - User's system role
   * @param userTeamIds - User's team IDs
   * @param tab - Tab name: 'documents' | 'chat' | 'settings'
   * @returns Effective permission level: 'none' | 'view' | 'manage'
   */
  async checkTabPermission(
    projectId: string,
    userId: string,
    userRole: string,
    userTeamIds: string[],
    tab: "documents" | "chat" | "settings",
  ): Promise<string> {
    // Admins/leaders always have manage access
    if (isAdminRole(userRole)) return "manage";

    const tabField = `tab_${tab}` as keyof ProjectPermission;

    // Check direct user permission
    const userPerms = await ModelFactory.projectPermission.findByGrantee(
      "user",
      userId,
    );
    const directPerm = userPerms.find((p) => p.project_id === projectId);
    let effectiveLevel = (directPerm?.[tabField] as string) || "none";

    // Check team permissions — take highest level
    for (const teamId of userTeamIds) {
      const teamPerms = await ModelFactory.projectPermission.findByGrantee(
        "team",
        teamId,
      );
      const teamPerm = teamPerms.find((p) => p.project_id === projectId);
      const teamLevel = (teamPerm?.[tabField] as string) || "none";
      effectiveLevel = this.higherPermission(effectiveLevel, teamLevel);
    }

    return effectiveLevel;
  }

  /**
   * Return the higher of two permission levels.
   * @param a - First permission level
   * @param b - Second permission level
   * @returns Higher permission level
   */
  private higherPermission(a: string, b: string): string {
    const order = { none: 0, view: 1, manage: 2 };
    const aVal = order[a as keyof typeof order] ?? 0;
    const bVal = order[b as keyof typeof order] ?? 0;
    return aVal >= bVal ? a : b;
  }
}

export const projectService = ProjectService.getSharedInstance();
