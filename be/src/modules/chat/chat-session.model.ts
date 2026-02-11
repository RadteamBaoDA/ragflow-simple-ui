
/**
 * Chat sessions model: stores per-user chat threads.
 */
import { BaseModel } from '@/shared/models/base.model.js'
import { db } from '@/shared/db/knex.js'
import { ChatSession } from '@/shared/models/types.js'

/**
 * ChatSessionModel
 * Represents the 'chat_sessions' table.
 * Manages chat conversation metadata and ownership.
 */
export class ChatSessionModel extends BaseModel<ChatSession> {
  /** Table name in the database */
  protected tableName = 'chat_sessions'
  /** Knex connection instance */
  protected knex = db
}
