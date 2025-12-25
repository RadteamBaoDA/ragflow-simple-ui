
/**
 * Tracks which users dismissed which broadcast messages to avoid re-showing.
 */
import { BaseModel } from '@/models/base.model.js'
import { db } from '@/db/knex.js'
import { UserDismissedBroadcast } from '@/models/types.js'

export class UserDismissedBroadcastModel extends BaseModel<UserDismissedBroadcast> {
  protected tableName = 'user_dismissed_broadcasts'
  protected knex = db
}
