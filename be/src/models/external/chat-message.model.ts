/**
 * External Chat Message Model
 */
import { BaseModel } from '@/models/base.model.js'
import { db } from '@/db/knex.js'

export interface ExternalChatMessage {
    id: string
    session_id: string
    user_prompt: string
    llm_response: string
    citations: any[]
    created_at: Date
}

export class ExternalChatMessageModel extends BaseModel<ExternalChatMessage> {
    protected tableName = 'external_chat_messages'
    protected knex = db
}
