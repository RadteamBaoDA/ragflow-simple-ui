
import { BaseModel } from './base.model.js';
import { db } from '@/db/index.js';

export interface ExternalChatHistory {
    id: string;
    session_id: string;
    user_id?: string;
    prompt: string;
    response: string;
    citations: any;
    created_at: Date;
}

export class ExternalChatHistoryModel extends BaseModel<ExternalChatHistory> {
    protected tableName = 'external_chat_history';
    protected knex = db;
}
