
/**
 * Document permissions model: resolves per-user or per-team access to MinIO buckets.
 */
import { BaseModel } from '@/models/base.model.js'
import { db } from '@/db/knex.js'
import { DocumentPermission } from '@/models/types.js'

/**
 * DocumentPermissionModel
 * Resolves per-user or per-team access to MinIO buckets.
 * Extends BaseModel with custom queries for permission lookups.
 */
export class DocumentPermissionModel extends BaseModel<DocumentPermission> {
  /** Database table name */
  protected tableName = 'document_permissions'
  /** Shared Knex database instance */
  protected knex = db

  /**
   * Find a permission record for a specific entity and bucket combination.
   * @param entityType - Type of entity ('user' or 'team')
   * @param entityId - ID of the user or team
   * @param bucketId - ID of the MinIO bucket
   * @returns Permission record if found, undefined otherwise
   */
  async findByEntityAndBucket(entityType: string, entityId: string, bucketId: string): Promise<DocumentPermission | undefined> {
    // Query for exact match on entity type, entity ID, and bucket ID
    return this.knex(this.tableName).where({
      entity_type: entityType,
      entity_id: entityId,
      bucket_id: bucketId
    }).first()
  }

  /**
   * Find all bucket IDs that a user can access.
   * Combines direct user grants plus grants via team membership.
   * @param userId - User ID to check access for
   * @param teamIds - Array of team IDs the user belongs to
   * @returns Array of unique bucket IDs the user can access
   */
  async findAccessibleBucketIds(userId: string, teamIds: string[]): Promise<string[]> {
    // Build query to find all buckets user can access
    const query = this.knex(this.tableName)
      .select('bucket_id')
      .where(builder => {
        // Check for direct user permission grants
        builder.where({ entity_type: 'user', entity_id: userId })

        // Also check for team-based permission grants
        if (teamIds.length > 0) {
          builder.orWhere(sub => {
            // Match team entity type and any of user's team IDs
            sub.where('entity_type', 'team').whereIn('entity_id', teamIds)
          })
        }
      })

    // Execute query
    const rows = await query

    // Return unique bucket IDs using Set to deduplicate
    return [...new Set(rows.map(r => r.bucket_id))]
  }
}
