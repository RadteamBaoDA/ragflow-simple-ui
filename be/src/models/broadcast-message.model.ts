
/**
 * Broadcast message model: stores system-wide announcements with scheduling metadata.
 */
import { BaseModel } from '@/models/base.model.js'
import { db } from '@/db/knex.js'
import { BroadcastMessage } from '@/models/types.js'

export class BroadcastMessageModel extends BaseModel<BroadcastMessage> {
  protected tableName = 'broadcast_messages'
  protected knex = db
}
