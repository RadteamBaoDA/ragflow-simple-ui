/**
 * External Chat History model
 */
import { BaseModel } from '@/models/base.model.js'
import { db } from '@/db/knex.js'

export interface ExternalChatHistory {
    id: string
    session_id: string
    user_email?: string
    user_prompt: string
    llm_response: string
    citations: any[]
    created_at: Date
}

export class ExternalChatHistoryModel extends BaseModel<ExternalChatHistory> {
    protected tableName = 'external_chat_history'
    protected knex = db
}
