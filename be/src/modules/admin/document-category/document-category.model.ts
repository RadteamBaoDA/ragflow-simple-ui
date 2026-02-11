
/**
 * DocumentCategory model: manages document categories within projects.
 */
import { BaseModel } from '@/shared/models/base.model.js'
import { db } from '@/shared/db/knex.js'
import { DocumentCategory } from '@/shared/models/types.js'

/**
 * DocumentCategoryModel
 * CRUD operations for document category records.
 * @extends BaseModel<DocumentCategory>
 */
export class DocumentCategoryModel extends BaseModel<DocumentCategory> {
  /** Database table name */
  protected tableName = 'document_categories'
  /** Shared Knex database instance */
  protected knex = db

  /**
   * Find all categories for a specific project, ordered by sort_order.
   * @param projectId - UUID of the project
   * @returns Array of categories sorted by sort_order ascending
   */
  async findByProject(projectId: string): Promise<DocumentCategory[]> {
    return this.knex(this.tableName)
      .where({ project_id: projectId })
      .orderBy('sort_order', 'asc')
  }
}
