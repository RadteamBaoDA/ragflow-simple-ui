
/**
 * External Search History model
 */
import { BaseModel } from '@/models/base.model.js'
import { db } from '@/db/knex.js'

/**
 * ExternalSearchHistory interface
 * Defines the shape of external search history records.
 */
export interface ExternalSearchHistory {
    /** Unique ID */
    id: string
    /** Optional Session ID */
    session_id?: string
    /** Share ID of the source */
    share_id?: string
    /** Optional user email */
    user_email?: string
    /** The search query text */
    search_input: string
    /** AI generated summary of the search results */
    ai_summary: string
    /** Array of files found */
    file_results: any[]
    /** Creation timestamp */
    created_at: Date
}

/**
 * ExternalSearchHistoryModel
 * Represents the 'external_search_history' table.
 * Stores search logs from external API clients.
 */
export class ExternalSearchHistoryModel extends BaseModel<ExternalSearchHistory> {
    /** Table name in the database */
    protected tableName = 'external_search_history'
    /** Knex connection instance */
    protected knex = db
}
