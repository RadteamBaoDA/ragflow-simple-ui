/**
 * External Search Session Model
 */
import { BaseModel } from '@/models/base.model.js'
import { db } from '@/db/knex.js'

export interface ExternalSearchSession {
    id: string
    session_id: string
    share_id?: string
    user_email?: string
    created_at: Date
    updated_at: Date
}

export class ExternalSearchSessionModel extends BaseModel<ExternalSearchSession> {
    protected tableName = 'external_search_sessions'
    protected knex = db
}
