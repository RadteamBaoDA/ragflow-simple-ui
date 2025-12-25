
/**
 * Tracks which users dismissed which broadcast messages to avoid re-showing.
 * 
 * Extended with custom method for upsert operation.
 */
import { BaseModel } from '@/models/base.model.js'
import { db } from '@/db/knex.js'
import { UserDismissedBroadcast } from '@/models/types.js'

export class UserDismissedBroadcastModel extends BaseModel<UserDismissedBroadcast> {
  protected tableName = 'user_dismissed_broadcasts'
  protected knex = db

  /**
   * Record a message dismissal (upsert).
   * Uses ON CONFLICT DO NOTHING since we only care about the first dismissal.
   */
  async upsertDismissal(userId: string, broadcastId: string): Promise<void> {
    await this.knex(this.tableName)
      .insert({ user_id: userId, broadcast_id: broadcastId })
      .onConflict(['user_id', 'broadcast_id'])
      .ignore()
  }
}
