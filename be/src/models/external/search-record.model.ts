/**
 * External Search Record Model
 */
import { BaseModel } from '@/models/base.model.js'
import { db } from '@/db/knex.js'

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
    protected knex = db
}
