/**
 * External Chat Session Model
 */
import { BaseModel } from '@/models/base.model.js'
import { db } from '@/db/knex.js'

export interface ExternalChatSession {
    id: string
    session_id: string
    share_id?: string
    user_email?: string
    created_at: Date
    updated_at: Date
}

export class ExternalChatSessionModel extends BaseModel<ExternalChatSession> {
    protected tableName = 'external_chat_sessions'
    protected knex = db
}
