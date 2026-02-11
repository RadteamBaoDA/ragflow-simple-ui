
/**
 * ProjectPermission model: manages granular per-tab access control.
 */
import { BaseModel } from '@/models/base.model.js'
import { db } from '@/db/knex.js'
import { ProjectPermission } from '@/models/types.js'

/**
 * ProjectPermissionModel
 * CRUD operations for project permission records.
 * Supports composite unique constraint on (project_id, grantee_type, grantee_id).
 * @extends BaseModel<ProjectPermission>
 */
export class ProjectPermissionModel extends BaseModel<ProjectPermission> {
  /** Database table name */
  protected tableName = 'project_permissions'
  /** Shared Knex database instance */
  protected knex = db

  /**
   * Find all permissions for a specific project.
   * @param projectId - UUID of the project
   * @returns Array of permission records for the project
   */
  async findByProject(projectId: string): Promise<ProjectPermission[]> {
    return this.knex(this.tableName).where({ project_id: projectId })
  }

  /**
   * Find permissions for a specific grantee across all projects.
   * @param granteeType - 'user' or 'team'
   * @param granteeId - UUID of the user or team
   * @returns Array of permission records for the grantee
   */
  async findByGrantee(granteeType: string, granteeId: string): Promise<ProjectPermission[]> {
    return this.knex(this.tableName).where({ grantee_type: granteeType, grantee_id: granteeId })
  }

  /**
   * Upsert a permission record (insert or update on conflict).
   * @param data - Permission data to upsert
   * @returns The upserted permission record
   */
  async upsert(data: Partial<ProjectPermission>): Promise<ProjectPermission> {
    // Try to find existing permission
    const existing = await this.knex(this.tableName)
      .where({
        project_id: data.project_id,
        grantee_type: data.grantee_type,
        grantee_id: data.grantee_id
      })
      .first()

    if (existing) {
      // Update existing permission
      const [result] = await this.knex(this.tableName)
        .where({ id: existing.id })
        .update({
          tab_documents: data.tab_documents,
          tab_chat: data.tab_chat,
          tab_settings: data.tab_settings,
          updated_by: data.updated_by
        })
        .returning('*')
      return result
    }

    // Create new permission
    const [result] = await this.knex(this.tableName).insert(data).returning('*')
    return result
  }
}
