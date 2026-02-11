/**
 * External Chat Session Model
 */
import { BaseModel } from '@/shared/models/base.model.js'
import { db } from '@/shared/db/knex.js'
import { Knex } from 'knex'

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
    protected knex: Knex = db

    /**
     * Find chat history for a specific user with pagination and filters.
     */
    async findHistoryByUser(
        userEmail: string,
        limit: number,
        offset: number,
        search?: string,
        startDate?: string,
        endDate?: string
    ) {
        // Base query to select chat sessions
        let query = this.knex
            .select(
                'external_chat_sessions.session_id',
                'external_chat_sessions.updated_at as created_at',
                'external_chat_sessions.user_email',
                'knowledge_base_sources.name as source_name',
                // Subquery for first prompt
                this.knex.raw(`(
                    SELECT user_prompt FROM external_chat_messages 
                    WHERE session_id = external_chat_sessions.session_id 
                    ORDER BY created_at ASC LIMIT 1
                ) as user_prompt`),
                // Subquery for message count
                this.knex.raw(`(
                    SELECT COUNT(*) FROM external_chat_messages 
                    WHERE session_id = external_chat_sessions.session_id
                ) as message_count`)
            )
            .from(this.tableName)
            .leftJoin('knowledge_base_sources', 'external_chat_sessions.share_id', 'knowledge_base_sources.share_id')
            .where('external_chat_sessions.user_email', userEmail)
            .orderBy('external_chat_sessions.updated_at', 'desc')
            .limit(limit)
            .offset(offset);

        // Apply search filter if provided
        if (search) {
            const cleanSearch = search.replace(/[^\w\s]/g, '').trim();
            const terms = cleanSearch.split(/\s+/).filter(t => t.length > 0);

            query = query.where(builder => {
                builder.whereExists(function () {
                    const sub = this.select('id').from('external_chat_messages')
                        .whereRaw('external_chat_messages.session_id = external_chat_sessions.session_id');

                    if (terms.length > 0) {
                        const prefixQuery = terms.join(' & ') + ':*';
                        const orQuery = terms.join(' | ');
                        sub.where(b => {
                            b.whereRaw("search_vector @@ websearch_to_tsquery('english', ?)", [search])
                                .orWhereRaw("search_vector @@ to_tsquery('english', ?)", [prefixQuery])
                                .orWhereRaw("search_vector @@ to_tsquery('english', ?)", [orQuery]);
                        });
                    } else {
                        sub.whereRaw("search_vector @@ websearch_to_tsquery('english', ?)", [search]);
                    }
                });
            });
        }

        if (startDate) {
            query = query.where('external_chat_sessions.updated_at', '>=', startDate);
        }

        if (endDate) {
            query = query.where('external_chat_sessions.updated_at', '<=', `${endDate} 23:59:59`);
        }

        return await query;
    }
}
