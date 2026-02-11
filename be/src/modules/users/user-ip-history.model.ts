
/**
 * User IP history model: records last access IP per user for auditing/anomaly detection.
 */
import { BaseModel } from '@/shared/models/base.model.js'
import { db } from '@/shared/db/knex.js'
import { UserIpHistory } from '@/shared/models/types.js'

/**
 * UserIpHistoryModel
 * Represents the 'user_ip_history' table.
 * Logs IP addresses accessed by users for security auditing.
 */
export class UserIpHistoryModel extends BaseModel<UserIpHistory> {
  /** Table name in the database */
  protected tableName = 'user_ip_history'
  /** Knex connection instance */
  protected knex = db

  /**
   * Find the most recent history record for a specific user and IP address.
   * @param userId - User ID to search for
   * @param ipAddress - IP address string
   * @returns Promise<UserIpHistory | undefined> - Matching record if found
   * @description Specific lookup to check if an IP has already been recorded for this user.
   */
  async findByUserAndIp(userId: string, ipAddress: string): Promise<UserIpHistory | undefined> {
    // Find first record matching both user_id and ip_address
    return this.knex(this.tableName).where({ user_id: userId, ip_address: ipAddress }).first()
  }
}
