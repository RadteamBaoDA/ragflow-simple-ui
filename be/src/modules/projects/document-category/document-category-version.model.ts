
/**
 * DocumentCategoryVersion model: manages versions within document categories.
 * Each version maps to exactly one RAGFlow dataset.
 */
import { BaseModel } from '@/shared/models/base.model.js'
import { db } from '@/shared/db/knex.js'
import { DocumentCategoryVersion } from '@/shared/models/types.js'

/**
 * DocumentCategoryVersionModel
 * CRUD operations for document category version records.
 * @extends BaseModel<DocumentCategoryVersion>
 */
export class DocumentCategoryVersionModel extends BaseModel<DocumentCategoryVersion> {
  /** Database table name */
  protected tableName = 'document_category_versions'
  /** Shared Knex database instance */
  protected knex = db

  /**
   * Find all versions for a specific category, ordered by created_at desc.
   * @param categoryId - UUID of the category
   * @returns Array of versions sorted by creation date descending
   */
  async findByCategory(categoryId: string): Promise<DocumentCategoryVersion[]> {
    return this.knex(this.tableName)
      .where({ category_id: categoryId })
      .orderBy('created_at', 'desc')
  }

  /**
   * Find all active versions for a specific category.
   * @param categoryId - UUID of the category
   * @returns Array of active versions
   */
  async findActiveByCategory(categoryId: string): Promise<DocumentCategoryVersion[]> {
    return this.knex(this.tableName)
      .where({ category_id: categoryId, status: 'active' })
      .orderBy('created_at', 'desc')
  }

  /**
   * Find a version by its RAGFlow dataset ID.
   * @param ragflowDatasetId - RAGFlow dataset ID
   * @returns Version record if found
   */
  async findByRagflowDatasetId(ragflowDatasetId: string): Promise<DocumentCategoryVersion | undefined> {
    return this.knex(this.tableName)
      .where({ ragflow_dataset_id: ragflowDatasetId })
      .first()
  }
}
