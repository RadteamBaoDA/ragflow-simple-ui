/**
 * Queue Service
 * Handles background processing using Bee-Queue.
 */
import Queue from 'bee-queue';
import { config } from '@/config/index.js';
import { log } from '@/services/logger.service.js';
import { ModelFactory } from '@/models/factory.js';

interface ChatHistoryJobData {
    session_id: string;
    user_prompt: string;
    llm_response: string;
    citations: any[];
}

interface SearchHistoryJobData {
    search_input: string;
    ai_summary: string;
    file_results: any[];
}

export class QueueService {
    private static instance: QueueService;
    private chatHistoryQueue: Queue;
    private searchHistoryQueue: Queue;

    private constructor() {
        const redisConfig = {
            host: config.redis.host,
            port: config.redis.port,
            password: config.redis.password,
            db: config.redis.db,
        };

        this.chatHistoryQueue = new Queue('chat_history', {
            redis: redisConfig,
            isWorker: true,
            removeOnSuccess: true,
        } as any);

        this.searchHistoryQueue = new Queue('search_history', {
            redis: redisConfig,
            isWorker: true,
            removeOnSuccess: true,
        } as any);

        this.processChatHistoryJobs();
        this.processSearchHistoryJobs();
    }

    public static getInstance(): QueueService {
        if (!QueueService.instance) {
            QueueService.instance = new QueueService();
        }
        return QueueService.instance;
    }

    public async addChatHistoryJob(data: ChatHistoryJobData): Promise<void> {
        try {
            const job = this.chatHistoryQueue.createJob(data as any);
            await job.save();
            log.info(`Added chat history job ${job.id}`);
        } catch (error) {
            log.error('Failed to add chat history job', error as Record<string, unknown>);
            throw error;
        }
    }

    public async addSearchHistoryJob(data: SearchHistoryJobData): Promise<void> {
        try {
            const job = this.searchHistoryQueue.createJob(data as any);
            await job.save();
            log.info(`Added search history job ${job.id}`);
        } catch (error) {
            log.error('Failed to add search history job', error as Record<string, unknown>);
            throw error;
        }
    }

    private processChatHistoryJobs(): void {
        const concurrency = parseInt(process.env['QUEUE_CONCURRENCY'] || '5', 10);

        this.chatHistoryQueue.process(concurrency, async (job: any) => {
            log.info(`Processing chat history job ${job.id}`);
            try {
                const { session_id, user_prompt, llm_response, citations } = job.data;
                await ModelFactory.externalChatHistory.create({
                    session_id,
                    user_prompt,
                    llm_response,
                    citations: citations as any,
                });
                log.info(`Processed chat history job ${job.id}`);
            } catch (error) {
                log.error(`Failed to process chat history job ${job.id}`, error as Record<string, unknown>);
                throw error;
            }
        });
    }

    private processSearchHistoryJobs(): void {
        const concurrency = parseInt(process.env['QUEUE_CONCURRENCY'] || '5', 10);

        this.searchHistoryQueue.process(concurrency, async (job: any) => {
            log.info(`Processing search history job ${job.id}`);
            try {
                const { search_input, ai_summary, file_results } = job.data;
                await ModelFactory.externalSearchHistory.create({
                    search_input,
                    ai_summary,
                    file_results: file_results as any,
                });
                log.info(`Processed search history job ${job.id}`);
            } catch (error) {
                log.error(`Failed to process search history job ${job.id}`, error as Record<string, unknown>);
                throw error;
            }
        });
    }

    public async close(): Promise<void> {
        await this.chatHistoryQueue.close();
        await this.searchHistoryQueue.close();
    }
}

export const queueService = QueueService.getInstance();
