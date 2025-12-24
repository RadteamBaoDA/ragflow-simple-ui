
import { BaseModel } from '@/models/base.model.js';
import { db } from '@/db/knex.js';
import { DocumentPermission } from '@/models/types.js';

export class DocumentPermissionModel extends BaseModel<DocumentPermission> {
  protected tableName = 'document_permissions';
  protected knex = db;

  async findByEntityAndBucket(entityType: string, entityId: string, bucketId: string): Promise<DocumentPermission | undefined> {
    return this.knex(this.tableName).where({
      entity_type: entityType,
      entity_id: entityId,
      bucket_id: bucketId
    }).first();
  }

  async findAccessibleBucketIds(userId: string, teamIds: string[]): Promise<string[]> {
    const query = this.knex(this.tableName)
      .select('bucket_id')
      .where(builder => {
        builder.where({ entity_type: 'user', entity_id: userId });
        if (teamIds.length > 0) {
          builder.orWhere(sub => {
            sub.where('entity_type', 'team').whereIn('entity_id', teamIds);
          });
        }
      });
    const rows = await query;
    // Return unique bucket IDs
    return [...new Set(rows.map(r => r.bucket_id))];
  }
}
