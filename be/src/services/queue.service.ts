/**
 * @fileoverview Queue service for handling background jobs using bee-queue.
 *
 * This service manages queues for offloading heavy or high-throughput tasks
 * like saving chat and search history to the database.
 *
 * @module services/queue
 */

import BeeQueue from 'bee-queue';
import { config } from '@/config/index.js';
import { log } from '@/services/logger.service.js';
import { getAdapter } from '@/db/index.js';

// Types for job data
export interface ChatHistoryJob {
    sessionId: string;
    userId?: string;
    messages: Array<{
        prompt: string;
        response: string;
        citations: any;
    }>;
}

export interface SearchHistoryJob {
    sessionId: string;
    userId?: string;
    query: string;
    summary: string;
    results: any;
}

// Queue instances
let chatHistoryQueue: BeeQueue<ChatHistoryJob> | null = null;
let searchHistoryQueue: BeeQueue<SearchHistoryJob> | null = null;

/**
 * Initialize queues and their processors.
 */
export async function initQueues() {
    if (!config.redis.url) {
        log.warn('Redis URL not configured, queues will not be initialized');
        return;
    }

    log.info('Initializing queues...');

    const redisConfig = {
        redis: {
            host: config.redis.host,
            port: config.redis.port,
            password: config.redis.password,
            db: config.redis.db,
        },
        removeOnSuccess: true,
        removeOnFailure: false,
    };

    // Chat History Queue
    chatHistoryQueue = new BeeQueue('chat-history', redisConfig);

    if (chatHistoryQueue) {
        chatHistoryQueue.process(async (job) => {
        const { sessionId, userId, messages } = job.data;
        log.debug(`Processing chat history job for session ${sessionId}`);

        try {
            const db = await getAdapter();
            for (const msg of messages) {
                await db.query(
                    `INSERT INTO external_chat_history (session_id, user_id, prompt, response, citations)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [sessionId, userId || null, msg.prompt, msg.response, JSON.stringify(msg.citations)]
                );
            }
            log.debug(`Saved ${messages.length} chat messages for session ${sessionId}`);
        } catch (error) {
            log.error('Error processing chat history job', { error, jobId: job.id });
            throw error; // Let bee-queue handle retries
        }
        });

        chatHistoryQueue.on('ready', () => log.info('Chat history queue ready'));
        chatHistoryQueue.on('error', (err) => log.error('Chat history queue error', { error: err.message }));
    }

    // Search History Queue
    searchHistoryQueue = new BeeQueue('search-history', redisConfig);

    if (searchHistoryQueue) {
        searchHistoryQueue.process(async (job) => {
        const { sessionId, userId, query, summary, results } = job.data;
        log.debug(`Processing search history job for session ${sessionId}`);

        try {
            const db = await getAdapter();
            await db.query(
                `INSERT INTO external_search_history (session_id, user_id, query, summary, results)
                 VALUES ($1, $2, $3, $4, $5)`,
                [sessionId, userId || null, query, summary, JSON.stringify(results)]
            );
            log.debug(`Saved search history for session ${sessionId}`);
        } catch (error) {
            log.error('Error processing search history job', { error, jobId: job.id });
            throw error;
        }
        });

        searchHistoryQueue.on('ready', () => log.info('Search history queue ready'));
        searchHistoryQueue.on('error', (err) => log.error('Search history queue error', { error: err.message }));
    }
}

/**
 * Add a job to the chat history queue.
 */
export async function addChatHistoryJob(data: ChatHistoryJob) {
    if (!chatHistoryQueue) {
        throw new Error('Chat history queue not initialized');
    }
    return chatHistoryQueue.createJob(data).save();
}

/**
 * Add a job to the search history queue.
 */
export async function addSearchHistoryJob(data: SearchHistoryJob) {
    if (!searchHistoryQueue) {
        throw new Error('Search history queue not initialized');
    }
    return searchHistoryQueue.createJob(data).save();
}

/**
 * Close all queues.
 */
export async function closeQueues() {
    if (chatHistoryQueue) await chatHistoryQueue.close();
    if (searchHistoryQueue) await searchHistoryQueue.close();
    log.info('Queues closed');
}
