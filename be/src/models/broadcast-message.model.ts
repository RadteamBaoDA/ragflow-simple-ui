
/**
 * Broadcast message model: stores system-wide announcements with scheduling metadata.
 * 
 * Extended with custom methods for complex queries:
 * - findActive: Get currently active messages
 * - findActiveExcludingDismissed: Get active messages not dismissed by user
 */
import { BaseModel } from '@/models/base.model.js'
import { db } from '@/db/knex.js'
import { BroadcastMessage } from '@/models/types.js'

export class BroadcastMessageModel extends BaseModel<BroadcastMessage> {
  protected tableName = 'broadcast_messages'
  protected knex = db

  /**
   * Find all currently active broadcast messages.
   * Active means: is_active=true AND starts_at <= now AND ends_at >= now
   */
  async findActive(now: string | Date = new Date()): Promise<BroadcastMessage[]> {
    const timestamp = typeof now === 'string' ? now : now.toISOString()
    return this.knex(this.tableName)
      .where('is_active', true)
      .where('starts_at', '<=', timestamp)
      .where('ends_at', '>=', timestamp)
      .orderBy('created_at', 'desc')
  }

  /**
   * Find active messages excluding those dismissed by a specific user within 24 hours.
   * Uses LEFT JOIN to filter out dismissed messages.
   */
  async findActiveExcludingDismissed(userId: string, now: string | Date = new Date()): Promise<BroadcastMessage[]> {
    const timestamp = typeof now === 'string' ? now : now.toISOString()

    return this.knex(this.tableName)
      .select('broadcast_messages.*')
      .leftJoin('user_dismissed_broadcasts as d', function () {
        this.on('broadcast_messages.id', '=', 'd.broadcast_id')
          .andOn('d.user_id', '=', db.raw('?', [userId]))
      })
      .where('broadcast_messages.is_active', true)
      .where('broadcast_messages.starts_at', '<=', timestamp)
      .where('broadcast_messages.ends_at', '>=', timestamp)
      .where(function () {
        this.whereNull('d.broadcast_id')
          .orWhereRaw("d.dismissed_at < NOW() - INTERVAL '24 hours'")
      })
      .orderBy('broadcast_messages.created_at', 'desc')
  }
}
