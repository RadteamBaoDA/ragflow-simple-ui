
import { BaseModel } from './base.model.js';
import { db } from '@/db/index.js';

export interface ExternalSearchHistory {
    id: string;
    session_id: string;
    user_id?: string;
    query: string;
    summary: string;
    results: any;
    created_at: Date;
}

export class ExternalSearchHistoryModel extends BaseModel<ExternalSearchHistory> {
    protected tableName = 'external_search_history';
    protected knex = db;
}
