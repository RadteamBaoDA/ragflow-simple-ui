/**
 * Audit log model: append-only store for security events.
 */
import { BaseModel } from '@/shared/models/base.model.js'
import { db } from '@/shared/db/knex.js'
import { AuditLog } from '@/shared/models/types.js'

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

  /**
   * Count records matching the given filter.
   * @param filter - Optional WHERE clause conditions
   * @returns Total count of matching records
   */
  async count(filter?: Partial<AuditLog>): Promise<number> {
    const query = this.knex(this.tableName).count('* as count')
    if (filter) {
      query.where(filter)
    }
    const [result] = await query
    return result ? Number(result.count) : 0
  }
}
