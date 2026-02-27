/**
 * ProjectEntityPermissionModel: manages per-entity permission records.
 * Supports granular access control for categories, chats, and searches.
 *
 * @description CRUD operations for project_entity_permissions table.
 * Composite unique constraint on (project_id, entity_type, entity_id, grantee_type, grantee_id).
 * @extends BaseModel<ProjectEntityPermission>
 */
import { BaseModel } from "@/shared/models/base.model.js";
import { db } from "@/shared/db/knex.js";
import { ProjectEntityPermission } from "@/shared/models/types.js";

export class ProjectEntityPermissionModel extends BaseModel<ProjectEntityPermission> {
  /** Database table name */
  protected tableName = "project_entity_permissions";
  /** Shared Knex database instance */
  protected knex = db;

  /**
   * Find all entity permissions for a specific project.
   * @param projectId - UUID of the project
   * @returns Array of entity permission records
   */
  async findByProject(projectId: string): Promise<ProjectEntityPermission[]> {
    return this.knex(this.tableName).where({ project_id: projectId });
  }

  /**
   * Find all permissions for a specific entity.
   * @param entityType - 'category' | 'chat' | 'search'
   * @param entityId - UUID of the entity
   * @returns Array of permission records for the entity
   */
  async findByEntity(
    entityType: string,
    entityId: string,
  ): Promise<ProjectEntityPermission[]> {
    return this.knex(this.tableName).where({
      entity_type: entityType,
      entity_id: entityId,
    });
  }

  /**
   * Find permissions for a specific grantee within a project.
   * @param granteeType - 'user' or 'team'
   * @param granteeId - UUID of the user or team
   * @param projectId - Optional project filter
   * @returns Array of permission records for the grantee
   */
  async findByGrantee(
    granteeType: string,
    granteeId: string,
    projectId?: string,
  ): Promise<ProjectEntityPermission[]> {
    const query = this.knex(this.tableName).where({
      grantee_type: granteeType,
      grantee_id: granteeId,
    });
    // Apply optional project filter
    if (projectId) {
      query.andWhere({ project_id: projectId });
    }
    return query;
  }

  /**
   * Upsert a permission record (insert or update on conflict).
   * @param data - Permission data to upsert
   * @returns The upserted permission record
   */
  async upsert(
    data: Partial<ProjectEntityPermission>,
  ): Promise<ProjectEntityPermission> {
    // Try to find existing permission by composite key
    const existing = await this.knex(this.tableName)
      .where({
        project_id: data.project_id,
        entity_type: data.entity_type,
        entity_id: data.entity_id,
        grantee_type: data.grantee_type,
        grantee_id: data.grantee_id,
      })
      .first();

    if (existing) {
      // Update existing permission
      const [result] = await this.knex(this.tableName)
        .where({ id: existing.id })
        .update({
          permission_level: data.permission_level,
          updated_by: data.updated_by,
          updated_at: this.knex.fn.now(),
        })
        .returning("*");
      return result;
    }

    // Create new permission
    const [result] = await this.knex(this.tableName)
      .insert(data)
      .returning("*");
    return result;
  }
}
