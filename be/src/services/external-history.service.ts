import { db } from '@/db/knex.js';
import { ModelFactory } from '@/models/factory.js';
import { log } from '@/services/logger.service.js';

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
     * @param data - The chat history data
     */
    async saveChatHistory(data: ChatHistoryData): Promise<void> {
        return db.transaction(async (trx) => {
            log.debug(`Starting transaction for chat history session ${data.session_id}`);
            try {
                await ModelFactory.externalChatHistory.create({
                    session_id: data.session_id,
                    user_email: data.user_email || '',
                    user_prompt: data.user_prompt,
                    llm_response: data.llm_response,
                    citations: JSON.stringify(data.citations) as any,
                }, trx);
                log.debug(`Successfully saved chat history for session ${data.session_id}`);
            } catch (error) {
                log.error(`Failed to save chat history for session ${data.session_id}`, error as Record<string, unknown>);
                throw error;
            }
        });
    }

    /**
     * Save search history from external clients using a database transaction.
     * @param data - The search history data
     */
    async saveSearchHistory(data: SearchHistoryData): Promise<void> {
        return db.transaction(async (trx) => {
            log.debug('Starting transaction for search history');
            try {
                await ModelFactory.externalSearchHistory.create({
                    session_id: data.session_id,
                    search_input: data.search_input,
                    user_email: data.user_email || '',
                    ai_summary: data.ai_summary,
                    file_results: JSON.stringify(data.file_results) as any,
                }, trx);
                log.debug('Successfully saved search history');
            } catch (error) {
                log.error('Failed to save search history', error as Record<string, unknown>);
                throw error;
            }
        });
    }
}

export const externalHistoryService = new ExternalHistoryService();
