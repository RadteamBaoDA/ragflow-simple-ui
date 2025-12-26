/**
 * Audit log model: append-only store for security events.
 */
import { BaseModel } from '@/models/base.model.js'
import { db } from '@/db/knex.js'
import { AuditLog } from '@/models/types.js'

/**
 * AuditLogModel
 * Represents the 'audit_logs' table for storing system audit trails.
 * Tracks user actions, resource changes, and security events.
 */
export class AuditLogModel extends BaseModel<AuditLog> {
  /** Table name in the database */
  protected tableName = 'audit_logs'
  /** Knex connection instance */
  protected knex = db
}
