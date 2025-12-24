
import { BaseModel } from './base.model.js';
import { db } from '../db/knex.js';
import { DocumentPermission } from './types.js';

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
}
