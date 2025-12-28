/**
 * External Search Record Model
 */
import { BaseModel } from '@/models/base.model.js'
import { db } from '@/db/knex.js'
import { Knex } from 'knex'

export interface ExternalSearchRecord {
    id: string
    session_id: string
    search_input: string
    ai_summary: string
    file_results: any[]
    created_at: Date
}

export class ExternalSearchRecordModel extends BaseModel<ExternalSearchRecord> {
    protected tableName = 'external_search_records'
    protected knex: Knex = db

    /**
     * Find records by session ID and verify user ownership.
     */
    async findBySessionIdAndUserEmail(sessionId: string, userEmail: string) {
        return await this.knex
            .select('external_search_records.*')
            .from(this.tableName)
            .join('external_search_sessions', 'external_search_records.session_id', 'external_search_sessions.session_id')
            .where('external_search_records.session_id', sessionId)
            .andWhere('external_search_sessions.user_email', userEmail)
            .orderBy('external_search_records.created_at', 'asc');
    }
}
