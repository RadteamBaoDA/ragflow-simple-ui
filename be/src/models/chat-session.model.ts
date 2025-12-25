
/**
 * Chat sessions model: stores per-user chat threads.
 */
import { BaseModel } from '@/models/base.model.js'
import { db } from '@/db/knex.js'
import { ChatSession } from '@/models/types.js'

export class ChatSessionModel extends BaseModel<ChatSession> {
  protected tableName = 'chat_sessions'
  protected knex = db
}
