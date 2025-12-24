/**
 * @fileoverview Service for managing history queues and background processing.
 *
 * Uses Redis lists to queue chat and search history items and processes them
 * in the background to avoid blocking API responses.
 *
 * @module services/queue
 */

import { getRedisClient } from './redis.service.js';
import { log } from './logger.service.js';
import { db } from '../db/index.js';

const CHAT_HISTORY_QUEUE = 'ragflow:history:chat';
const SEARCH_HISTORY_QUEUE = 'ragflow:history:search';

export interface ChatHistoryItem {
    session_id: string;
    user_prompt: string;
    llm_response: string;
    citation_info: any;
}

export interface SearchHistoryItem {
    session_id?: string;
    search_input: string;
    ai_summary?: string;
    file_name_result: any;
}

/**
 * Add an item to the history queue.
 *
 * @param type - The type of history ('chat' or 'search')
 * @param data - The data to store
 */
export async function addToHistoryQueue(type: 'chat' | 'search', data: ChatHistoryItem | SearchHistoryItem): Promise<void> {
    const redis = getRedisClient();
    if (!redis || !redis.isOpen) {
        log.warn('Redis client not available, skipping history queue', { type });
        // Fallback: Could insert directly to DB if critical, or just log error.
        // For now, we log warning as per "prevent throttle" requirement implies async processing is key.
        // But if Redis is down, maybe we should save directly to avoid data loss?
        // Let's attempt direct save if Redis is down for robustness.
        try {
            await saveToDb(type, data);
            log.info('Saved directly to DB due to Redis unavailability', { type });
        } catch (err) {
            log.error('Failed to save history (direct DB fallback)', { error: err instanceof Error ? err.message : String(err) });
        }
        return;
    }

    const queueName = type === 'chat' ? CHAT_HISTORY_QUEUE : SEARCH_HISTORY_QUEUE;
    try {
        await redis.lPush(queueName, JSON.stringify(data));
        log.debug('Added item to history queue', { type, queueName });
    } catch (error) {
        log.error('Failed to add to history queue', { error: error instanceof Error ? error.message : String(error) });
        // Fallback to direct DB save
        await saveToDb(type, data);
    }
}

/**
 * Process the history queues.
 * Should be called on application startup.
 * Runs in a loop with a small delay or blocking pop.
 */
export async function processHistoryQueue() {
    log.info('Starting history queue processor');

    // We use a loop with blocking pop or polling.
    // Since we have multiple queues, we might need separate loops or use BLPOP on multiple keys.
    // However, node-redis might act differently with blocking calls.
    // A simple polling loop is safer for stability if not using specialized queue lib.

    const processLoop = async () => {
        const redis = getRedisClient();
        if (!redis || !redis.isOpen) {
            setTimeout(processLoop, 5000); // Wait for reconnection
            return;
        }

        try {
            // Process Chat Queue
            const chatItem = await redis.rPop(CHAT_HISTORY_QUEUE);
            if (chatItem) {
                const data = JSON.parse(chatItem) as ChatHistoryItem;
                await saveToDb('chat', data);
            }

            // Process Search Queue
            const searchItem = await redis.rPop(SEARCH_HISTORY_QUEUE);
            if (searchItem) {
                const data = JSON.parse(searchItem) as SearchHistoryItem;
                await saveToDb('search', data);
            }

            // If both were empty, sleep a bit to avoid CPU spin
            if (!chatItem && !searchItem) {
                setTimeout(processLoop, 1000);
            } else {
                // If we found items, process next immediately (or with small yield)
                setImmediate(processLoop);
            }
        } catch (error) {
            log.error('Error in history queue processor', { error: error instanceof Error ? error.message : String(error) });
            setTimeout(processLoop, 5000); // Backoff on error
        }
    };

    // Start the loop
    processLoop();
}

/**
 * Save item to database.
 */
async function saveToDb(type: 'chat' | 'search', data: ChatHistoryItem | SearchHistoryItem) {
    try {
        if (type === 'chat') {
            const item = data as ChatHistoryItem;
            await db.query(
                `INSERT INTO ragflow_chat_history (session_id, user_prompt, llm_response, citation_info)
                 VALUES ($1, $2, $3, $4)`,
                [item.session_id, item.user_prompt, item.llm_response, JSON.stringify(item.citation_info)]
            );
        } else {
            const item = data as SearchHistoryItem;
            await db.query(
                `INSERT INTO ragflow_search_history (session_id, search_input, ai_summary, file_name_result)
                 VALUES ($1, $2, $3, $4)`,
                [item.session_id || null, item.search_input, item.ai_summary || null, JSON.stringify(item.file_name_result)]
            );
        }
    } catch (error) {
        log.error('Failed to save history to DB', { type, error: error instanceof Error ? error.message : String(error) });
        // If DB save fails, we might lose data. In a robust system, we'd retry or use a dead-letter queue.
    }
}
