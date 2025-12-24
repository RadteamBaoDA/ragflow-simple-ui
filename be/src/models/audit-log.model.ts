
import { BaseModel } from '@/models/base.model.js';
import { db } from '@/db/knex.js';
import { AuditLog } from '@/models/types.js';

export class AuditLogModel extends BaseModel<AuditLog> {
  protected tableName = 'audit_logs';
  protected knex = db;
}
