
/**
 * External Chat History model
 */
import { BaseModel } from '@/shared/models/base.model.js'
import { db } from '@/shared/db/knex.js'

/**
 * ExternalChatHistory interface
 * Defines the shape of external chat history records.
 */
export interface ExternalChatHistory {
    /** Unique ID */
    id: string
    /** Session ID from external client */
    session_id: string
    /** Share ID of the source */
    share_id?: string
    /** Optional user email */
    user_email?: string
    /** User's prompt text */
    user_prompt: string
    /** LLM's response text */
    llm_response: string
    /** Array of citations/sources */
    citations: any[]
    /** Creation timestamp */
    created_at: Date
}

/**
 * ExternalChatHistoryModel
 * Represents the 'external_chat_history' table.
 * Stores chat logs from external API clients.
 */
export class ExternalChatHistoryModel extends BaseModel<ExternalChatHistory> {
    /** Table name in the database */
    protected tableName = 'external_chat_history'
    /** Knex connection instance */
    protected knex = db
}
