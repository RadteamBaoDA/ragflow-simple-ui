import { db } from '@/db/knex.js';
import { ModelFactory } from '@/models/factory.js';
import { log } from '@/services/logger.service.js';
import { Knex } from 'knex';

interface ChatHistoryData {
    session_id: string;
    user_email?: string;
    user_prompt: string;
    llm_response: string;
    citations: any[];
}

interface SearchHistoryData {
    session_id?: string;
    user_email?: string;
    search_input: string;
    ai_summary: string;
    file_results: any[];
}

export class ExternalHistoryService {
    /**
     * Save chat history from external clients using a database transaction.
     * @param data - The chat history data object.
     * @returns Promise<void>
     * @description Wraps the creation of a chat history record in a transaction for data integrity.
     */
    async saveChatHistory(data: ChatHistoryData): Promise<void> {
        // Start a database transaction
        return db.transaction(async (trx) => {
            log.debug(`Starting transaction for chat history session ${data.session_id}`);
            try {
                // Create chat history record within transaction
                await ModelFactory.externalChatHistory.create({
                    session_id: data.session_id,
                    user_email: data.user_email || '',
                    user_prompt: data.user_prompt,
                    llm_response: data.llm_response,
                    citations: JSON.stringify(data.citations) as any,
                } as any, trx as any);
                log.debug(`Successfully saved chat history for session ${data.session_id}`);
            } catch (error) {
                // Log and rethrow error to trigger rollback
                log.error(`Failed to save chat history for session ${data.session_id}`, error as Record<string, unknown>);
                throw error;
            }
        });
    }

    /**
     * Save search history from external clients using a database transaction.
     * @param data - The search history data object.
     * @returns Promise<void>
     * @description Wraps the creation of a search history record in a transaction for data integrity.
     */
    async saveSearchHistory(data: SearchHistoryData): Promise<void> {
        // Start a database transaction
        return db.transaction(async (trx) => {
            log.debug('Starting transaction for search history');
            try {
                // Create search history record within transaction
                await ModelFactory.externalSearchHistory.create({
                    session_id: data.session_id,
                    search_input: data.search_input,
                    user_email: data.user_email || '',
                    ai_summary: data.ai_summary,
                    file_results: JSON.stringify(data.file_results) as any,
                } as any, trx as any);
                log.debug('Successfully saved search history');
            } catch (error) {
                // Log and rethrow error to trigger rollback
                log.error('Failed to save search history', error as Record<string, unknown>);
                throw error;
            }
        });
    }
}

export const externalHistoryService = new ExternalHistoryService();
