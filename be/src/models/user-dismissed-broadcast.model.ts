
/**
 * Tracks which users dismissed which broadcast messages to avoid re-showing.
 * 
 * Extended with custom method for upsert operation.
 */
import { BaseModel } from '@/models/base.model.js'
import { db } from '@/db/knex.js'
import { UserDismissedBroadcast } from '@/models/types.js'

/**
 * UserDismissedBroadcastModel
 * Tracks message dismissals by users.
 * Prevents broadcast messages from being shown again after dismissal.
 */
export class UserDismissedBroadcastModel extends BaseModel<UserDismissedBroadcast> {
  /** Table name in the database */
  protected tableName = 'user_dismissed_broadcasts'
  /** Knex connection instance */
  protected knex = db

  /**
   * Record a message dismissal (upsert).
   * Uses ON CONFLICT DO NOTHING since we only care about the first dismissal.
   * @param userId - ID of the user dismissing the message
   * @param broadcastId - ID of the message being dismissed
   * @returns Promise<void>
   * @description Inserts a dismissal record, ignoring duplicates if the user already dismissed this message.
   */
  async upsertDismissal(userId: string, broadcastId: string): Promise<void> {
    // Perform insert with on conflict ignore strategy
    await this.knex(this.tableName)
      .insert({
        user_id: userId,
        broadcast_id: broadcastId,
        created_by: userId,
        updated_by: userId
      })
      .onConflict(['user_id', 'broadcast_id'])
      .ignore()
  }
}
