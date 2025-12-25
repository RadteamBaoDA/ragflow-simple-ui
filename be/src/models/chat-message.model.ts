
/**
 * Chat messages model: stores message-level records linked to sessions.
 */
import { BaseModel } from '@/models/base.model.js'
import { db } from '@/db/knex.js'
import { ChatMessage } from '@/models/types.js'

export class ChatMessageModel extends BaseModel<ChatMessage> {
  protected tableName = 'chat_messages'
  protected knex = db
}
