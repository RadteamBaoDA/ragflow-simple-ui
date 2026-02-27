/**
 * ProjectEntityPermissionService: Business logic for per-entity permissions.
 * Handles CRUD, upsert, and effective permission resolution.
 * Implements Singleton pattern.
 *
 * @description Permission hierarchy: delete > edit > create > view > none
 */
import { ModelFactory } from "@/shared/models/factory.js";
import { ProjectEntityPermission } from "@/shared/models/types.js";
import {
  auditService,
  AuditAction,
  AuditResourceType,
} from "@/modules/audit/audit.service.js";

/** Actor context for audit logging. */
export interface EntityPermActor {
  id: string;
  email: string;
  ip?: string | undefined;
}

/** Permission level hierarchy (higher index = more permissions). */
const PERMISSION_ORDER: Record<string, number> = {
  none: 0,
  view: 1,
  create: 2,
  edit: 3,
  delete: 4,
};

/**
 * Service managing per-entity permission lifecycle.
 */
export class ProjectEntityPermissionService {
  private static instance: ProjectEntityPermissionService;

  /**
   * Get the shared singleton instance.
   * @returns ProjectEntityPermissionService singleton
   */
  static getSharedInstance(): ProjectEntityPermissionService {
    if (!this.instance) {
      this.instance = new ProjectEntityPermissionService();
    }
    return this.instance;
  }

  /**
   * List all entity permissions for a project.
   * @param projectId - Project UUID
   * @returns Array of entity permissions
   */
  async listByProject(projectId: string): Promise<ProjectEntityPermission[]> {
    return ModelFactory.projectEntityPermission.findByProject(projectId);
  }

  /**
   * List permissions for a specific entity.
   * @param entityType - 'category' | 'chat' | 'search'
   * @param entityId - Entity UUID
   * @returns Array of permissions for the entity
   */
  async listByEntity(
    entityType: string,
    entityId: string,
  ): Promise<ProjectEntityPermission[]> {
    return ModelFactory.projectEntityPermission.findByEntity(
      entityType,
      entityId,
    );
  }

  /**
   * Set (upsert) a permission for a grantee on an entity.
   * @param data - Permission data
   * @param actor - User performing the action
   * @returns Upserted permission record
   */
  async setPermission(
    data: {
      project_id: string;
      entity_type: string;
      entity_id: string;
      grantee_type: string;
      grantee_id: string;
      permission_level: string;
    },
    actor?: EntityPermActor,
  ): Promise<ProjectEntityPermission> {
    // Validate permission level
    if (!(data.permission_level in PERMISSION_ORDER)) {
      throw new Error(
        `Invalid permission level: ${data.permission_level}. Must be one of: none, view, create, edit, delete`,
      );
    }

    const permission = await ModelFactory.projectEntityPermission.upsert({
      ...data,
      created_by: actor?.id,
      updated_by: actor?.id,
    } as Partial<ProjectEntityPermission>);

    // Log audit event
    if (actor) {
      await auditService.log({
        userId: actor.id,
        userEmail: actor.email,
        action: AuditAction.SET_PROJECT_PERMISSION,
        resourceType: AuditResourceType.PROJECT_PERMISSION,
        resourceId: permission.id,
        details: {
          entity_type: data.entity_type,
          entity_id: data.entity_id,
          grantee_type: data.grantee_type,
          grantee_id: data.grantee_id,
          permission_level: data.permission_level,
        },
        ipAddress: actor.ip,
      });
    }

    return permission;
  }

  /**
   * Remove a permission.
   * @param permissionId - Permission UUID
   * @param actor - User performing the action
   */
  async removePermission(
    permissionId: string,
    actor?: EntityPermActor,
  ): Promise<void> {
    await ModelFactory.projectEntityPermission.delete(permissionId);

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
   * Check a user's effective permission level for a specific entity.
   * Resolves user + team grants and returns the highest level.
   * Admins always get 'delete' (full access).
   *
   * @param projectId - Project UUID
   * @param entityType - 'category' | 'chat' | 'search'
   * @param entityId - Entity UUID
   * @param userId - User UUID
   * @param userRole - User's system role
   * @param userTeamIds - User's team IDs
   * @returns Effective permission level string
   */
  async checkEntityPermission(
    projectId: string,
    entityType: string,
    entityId: string,
    userId: string,
    userRole: string,
    userTeamIds: string[],
  ): Promise<string> {
    // Admins always have full access
    if (userRole === "admin") return "delete";

    // Gather all relevant permissions for this entity
    const userPerms = await ModelFactory.projectEntityPermission.findByGrantee(
      "user",
      userId,
      projectId,
    );

    // Filter to this entity
    let effectiveLevel = "none";
    for (const p of userPerms) {
      if (p.entity_type === entityType && p.entity_id === entityId) {
        effectiveLevel = this.higherPermission(
          effectiveLevel,
          p.permission_level,
        );
      }
    }

    // Check team permissions — take highest level
    for (const teamId of userTeamIds) {
      const teamPerms =
        await ModelFactory.projectEntityPermission.findByGrantee(
          "team",
          teamId,
          projectId,
        );
      for (const p of teamPerms) {
        if (p.entity_type === entityType && p.entity_id === entityId) {
          effectiveLevel = this.higherPermission(
            effectiveLevel,
            p.permission_level,
          );
        }
      }
    }

    return effectiveLevel;
  }

  /**
   * Batch-check effective permissions for all entities of a type in a project.
   * Returns a map of entityId → effective permission level.
   *
   * @param projectId - Project UUID
   * @param entityType - 'category' | 'chat' | 'search'
   * @param userId - User UUID
   * @param userRole - User's system role
   * @param userTeamIds - User's team IDs
   * @returns Map of entity ID to effective permission level
   */
  async checkBulkEntityPermissions(
    projectId: string,
    entityType: string,
    userId: string,
    userRole: string,
    userTeamIds: string[],
  ): Promise<Record<string, string>> {
    // Admins get full access to everything
    if (userRole === "admin") return {};

    const result: Record<string, string> = {};

    // Gather user permissions
    const userPerms = await ModelFactory.projectEntityPermission.findByGrantee(
      "user",
      userId,
      projectId,
    );
    for (const p of userPerms) {
      if (p.entity_type === entityType) {
        result[p.entity_id] = this.higherPermission(
          result[p.entity_id] || "none",
          p.permission_level,
        );
      }
    }

    // Gather team permissions
    for (const teamId of userTeamIds) {
      const teamPerms =
        await ModelFactory.projectEntityPermission.findByGrantee(
          "team",
          teamId,
          projectId,
        );
      for (const p of teamPerms) {
        if (p.entity_type === entityType) {
          result[p.entity_id] = this.higherPermission(
            result[p.entity_id] || "none",
            p.permission_level,
          );
        }
      }
    }

    return result;
  }

  /**
   * Return the higher of two permission levels.
   * @param a - First permission level
   * @param b - Second permission level
   * @returns Higher permission level
   */
  private higherPermission(a: string, b: string): string {
    const aVal = PERMISSION_ORDER[a] ?? 0;
    const bVal = PERMISSION_ORDER[b] ?? 0;
    return aVal >= bVal ? a : b;
  }
}

export const projectEntityPermissionService =
  ProjectEntityPermissionService.getSharedInstance();
