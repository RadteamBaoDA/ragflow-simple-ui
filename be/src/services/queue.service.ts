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
import { ModelFactory } from '@/models/factory.js';

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

class QueueService {
    private chatHistoryQueue: BeeQueue<ChatHistoryJob> | null = null;
    private searchHistoryQueue: BeeQueue<SearchHistoryJob> | null = null;
    private static instance: QueueService;

    constructor() {
        // Private constructor for Singleton
    }

    public static getInstance(): QueueService {
        if (!QueueService.instance) {
            QueueService.instance = new QueueService();
        }
        return QueueService.instance;
    }

    /**
     * Initialize queues and their processors.
     */
    public async initQueues() {
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
        this.chatHistoryQueue = new BeeQueue('chat-history', redisConfig);

        if (this.chatHistoryQueue) {
            this.chatHistoryQueue.process(async (job) => {
                const { sessionId, userId, messages } = job.data;
                log.debug(`Processing chat history job for session ${sessionId}`);

                try {
                    const chatHistoryModel = ModelFactory.externalChatHistory;
                    for (const msg of messages) {
                        await chatHistoryModel.create({
                            session_id: sessionId,
                            user_id: userId || undefined,
                            prompt: msg.prompt,
                            response: msg.response,
                            citations: JSON.stringify(msg.citations)
                        });
                    }
                    log.debug(`Saved ${messages.length} chat messages for session ${sessionId}`);
                } catch (error) {
                    log.error('Error processing chat history job', { error, jobId: job.id });
                    throw error; // Let bee-queue handle retries
                }
            });

            this.chatHistoryQueue.on('ready', () => log.info('Chat history queue ready'));
            this.chatHistoryQueue.on('error', (err) => log.error('Chat history queue error', { error: err.message }));
        }

        // Search History Queue
        this.searchHistoryQueue = new BeeQueue('search-history', redisConfig);

        if (this.searchHistoryQueue) {
            this.searchHistoryQueue.process(async (job) => {
                const { sessionId, userId, query, summary, results } = job.data;
                log.debug(`Processing search history job for session ${sessionId}`);

                try {
                    const searchHistoryModel = ModelFactory.externalSearchHistory;
                    await searchHistoryModel.create({
                        session_id: sessionId,
                        user_id: userId || undefined,
                        query: query,
                        summary: summary,
                        results: JSON.stringify(results)
                    });
                    log.debug(`Saved search history for session ${sessionId}`);
                } catch (error) {
                    log.error('Error processing search history job', { error, jobId: job.id });
                    throw error;
                }
            });

            this.searchHistoryQueue.on('ready', () => log.info('Search history queue ready'));
            this.searchHistoryQueue.on('error', (err) => log.error('Search history queue error', { error: err.message }));
        }
    }

    /**
     * Add a job to the chat history queue.
     */
    public async addChatHistoryJob(data: ChatHistoryJob) {
        if (!this.chatHistoryQueue) {
            throw new Error('Chat history queue not initialized');
        }
        return this.chatHistoryQueue.createJob(data).save();
    }

    /**
     * Add a job to the search history queue.
     */
    public async addSearchHistoryJob(data: SearchHistoryJob) {
        if (!this.searchHistoryQueue) {
            throw new Error('Search history queue not initialized');
        }
        return this.searchHistoryQueue.createJob(data).save();
    }

    /**
     * Close all queues.
     */
    public async closeQueues() {
        if (this.chatHistoryQueue) await this.chatHistoryQueue.close();
        if (this.searchHistoryQueue) await this.searchHistoryQueue.close();
        log.info('Queues closed');
    }
}

export const queueService = QueueService.getInstance();
