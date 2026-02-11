/**
 * External Chat Message Model
 */
import { BaseModel } from '@/shared/models/base.model.js'
import { db } from '@/shared/db/knex.js'
import { Knex } from 'knex'

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
    protected knex: Knex = db

    /**
     * Find messages by session ID and verify user ownership.
     */
    async findBySessionIdAndUserEmail(sessionId: string, userEmail: string) {
        return await this.knex
            .select('external_chat_messages.*')
            .from(this.tableName)
            .join('external_chat_sessions', 'external_chat_messages.session_id', 'external_chat_sessions.session_id')
            .where('external_chat_messages.session_id', sessionId)
            .andWhere('external_chat_sessions.user_email', userEmail)
            .orderBy('external_chat_messages.created_at', 'asc');
    }
}
