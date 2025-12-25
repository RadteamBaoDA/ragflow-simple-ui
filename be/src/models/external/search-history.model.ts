/**
 * External Search History model
 */
import { BaseModel } from '@/models/base.model.js'
import { db } from '@/db/knex.js'

export interface ExternalSearchHistory {
    id: string
    search_input: string
    ai_summary: string
    file_results: any[]
    created_at: Date
}

export class ExternalSearchHistoryModel extends BaseModel<ExternalSearchHistory> {
    protected tableName = 'external_search_history'
    protected knex = db
}
