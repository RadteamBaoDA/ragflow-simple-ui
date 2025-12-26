
/**
 * Chat messages model: stores message-level records linked to sessions.
 */
import { BaseModel } from '@/models/base.model.js'
import { db } from '@/db/knex.js'
import { ChatMessage } from '@/models/types.js'

/**
 * ChatMessageModel
 * Represents the 'chat_messages' table.
 * Stores individual messages (user prompts and AI responses) associated with chat sessions.
 */
export class ChatMessageModel extends BaseModel<ChatMessage> {
  /** Table name in the database */
  protected tableName = 'chat_messages'
  /** Knex connection instance */
  protected knex = db
}
