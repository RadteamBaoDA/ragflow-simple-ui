/**
 * Queue Service
 * Handles background processing using Bee-Queue.
 * Implements smart concurrency based on system resources and database pool.
 */
import Queue from 'bee-queue';
import os from 'os';
import { config } from '@/config/index.js';
import { log } from '@/services/logger.service.js';
import { ModelFactory } from '@/models/factory.js';

interface ChatHistoryJobData {
    session_id: string;
    user_email?: string;
    user_prompt: string;
    llm_response: string;
    citations: any[];
}

interface SearchHistoryJobData {
    user_email?: string;
    search_input: string;
    ai_summary: string;
    file_results: any[];
}

export class QueueService {
    private static instance: QueueService;
    private chatHistoryQueue: Queue;
    private searchHistoryQueue: Queue;

    /** Database connection pool size (should match postgresql adapter) */
    private static readonly DB_POOL_SIZE = 20;

    /** Computed optimal concurrency for job processing */
    private readonly optimalConcurrency: number;

    /**
     * Private constructor to initialize the QueueService singleton.
     * Sets up Redis connection, initializes chat and search history queues,
     * configures event listeners, and starts job processors.
     */
    private constructor() {
        // Calculate optimal concurrency based on system resources
        this.optimalConcurrency = this.calculateOptimalConcurrency();

        // Configure Redis connection settings from application config
        const redisConfig = {
            host: config.redis.host,
            port: config.redis.port,
            password: config.redis.password,
            db: config.redis.db,
        };

        // Initialize chat history queue with Redis backend
        // isWorker: true enables this instance to process jobs
        // removeOnSuccess: true automatically removes completed jobs
        this.chatHistoryQueue = new Queue('chat_history', {
            redis: redisConfig,
            isWorker: true,
            removeOnSuccess: true,
        } as any);

        // Initialize search history queue with same configuration
        this.searchHistoryQueue = new Queue('search_history', {
            redis: redisConfig,
            isWorker: true,
            removeOnSuccess: true,
        } as any);

        // Setup event listeners for monitoring and debugging both queues
        this.setupQueueEventListeners();

        // Start job processors for both queues
        this.processChatHistoryJobs();
        this.processSearchHistoryJobs();

        // Log successful startup with connection and concurrency details
        log.info('BeeQueue service started successfully', {
            queues: ['chat_history', 'search_history'],
            redisHost: config.redis.host,
            redisPort: config.redis.port,
            concurrency: this.optimalConcurrency,
            cpuCores: os.cpus().length,
            dbPoolSize: QueueService.DB_POOL_SIZE,
        });
    }

    /**
     * Calculate optimal concurrency based on system resources.
     * Takes into account:
     * - CPU cores: More cores allow more parallel processing
     * - Database pool size: Avoid exhausting DB connections
     * - Queue count: Split resources across multiple queues
     * 
     * Formula: min(envOverride, cpuCores * 2, dbPoolSize / numQueues)
     * This ensures we don't overload CPU or exhaust DB connections.
     * 
     * @returns Optimal concurrency per queue (minimum 1)
     */
    private calculateOptimalConcurrency(): number {
        // Check for environment variable override first
        const envConcurrency = process.env['QUEUE_CONCURRENCY'];
        if (envConcurrency) {
            const parsed = parseInt(envConcurrency, 10);
            if (!isNaN(parsed) && parsed > 0) {
                log.debug('Using QUEUE_CONCURRENCY override', { concurrency: parsed });
                return parsed;
            }
        }

        // Get number of CPU cores available
        const cpuCores = os.cpus().length;

        // Calculate CPU-based concurrency (2 jobs per core is typical for I/O-bound work)
        const cpuBasedConcurrency = cpuCores * 2;

        // Calculate DB pool-based concurrency
        // We have 2 queues, so split DB pool connections between them
        // Reserve 50% of pool for web requests, divide remaining among queues
        const numQueues = 2;
        const reservedForWeb = Math.floor(QueueService.DB_POOL_SIZE * 0.5);
        const poolForQueues = QueueService.DB_POOL_SIZE - reservedForWeb;
        const dbBasedConcurrency = Math.floor(poolForQueues / numQueues);

        // Take the minimum to avoid overloading either resource
        const optimal = Math.min(cpuBasedConcurrency, dbBasedConcurrency);

        // Ensure at least 1 concurrent job
        const finalConcurrency = Math.max(1, optimal);

        log.debug('Calculated optimal queue concurrency', {
            cpuCores,
            cpuBasedConcurrency,
            dbPoolSize: QueueService.DB_POOL_SIZE,
            dbBasedConcurrency,
            finalConcurrency,
        });

        return finalConcurrency;
    }

    /**
     * Setup event listeners for queue monitoring and debugging
     */
    private setupQueueEventListeners(): void {
        // Chat History Queue Events
        this.chatHistoryQueue.on('ready', () => {
            log.debug('Chat history queue is ready');
        });

        this.chatHistoryQueue.on('error', (err: Error) => {
            log.error('Chat history queue error', { error: err.message });
        });

        this.chatHistoryQueue.on('retrying', (job: any, err: Error) => {
            log.debug(`Chat history job ${job.id} retrying`, { error: err.message });
        });

        this.chatHistoryQueue.on('failed', (job: any, err: Error) => {
            log.debug(`Chat history job ${job.id} failed`, { error: err.message });
        });

        this.chatHistoryQueue.on('stalled', (jobId: string) => {
            log.debug(`Chat history job ${jobId} stalled`);
        });

        this.chatHistoryQueue.on('succeeded', (job: any, result: any) => {
            log.debug(`Chat history job ${job.id} succeeded`, { result });
        });

        this.chatHistoryQueue.on('job progress', (jobId: string, progress: any) => {
            log.debug(`Chat history job ${jobId} progress`, { progress });
        });

        // Search History Queue Events
        this.searchHistoryQueue.on('ready', () => {
            log.debug('Search history queue is ready');
        });

        this.searchHistoryQueue.on('error', (err: Error) => {
            log.error('Search history queue error', { error: err.message });
        });

        this.searchHistoryQueue.on('retrying', (job: any, err: Error) => {
            log.debug(`Search history job ${job.id} retrying`, { error: err.message });
        });

        this.searchHistoryQueue.on('failed', (job: any, err: Error) => {
            log.debug(`Search history job ${job.id} failed`, { error: err.message });
        });

        this.searchHistoryQueue.on('stalled', (jobId: string) => {
            log.debug(`Search history job ${jobId} stalled`);
        });

        this.searchHistoryQueue.on('succeeded', (job: any, result: any) => {
            log.debug(`Search history job ${job.id} succeeded`, { result });
        });

        this.searchHistoryQueue.on('job progress', (jobId: string, progress: any) => {
            log.debug(`Search history job ${jobId} progress`, { progress });
        });
    }

    /**
     * Get the singleton instance of QueueService.
     * Creates a new instance if one doesn't exist.
     * @returns The singleton QueueService instance
     */
    public static getInstance(): QueueService {
        // Check if singleton instance already exists
        if (!QueueService.instance) {
            // Create new instance on first access (lazy initialization)
            QueueService.instance = new QueueService();
        }
        // Return the singleton instance
        return QueueService.instance;
    }

    /**
     * Add a new chat history job to the queue for background processing.
     * @param data - The chat history data containing session_id, user_prompt, llm_response, and citations
     * @throws Error if job creation fails
     */
    public async addChatHistoryJob(data: ChatHistoryJobData): Promise<void> {
        try {
            // Create a new job with the chat history data payload
            const job = this.chatHistoryQueue.createJob(data as any);

            // Persist job to Redis queue for processing
            await job.save();

            // Log successful job creation with job ID for tracking
            log.info(`Added chat history job ${job.id}`);
        } catch (error) {
            // Log error and re-throw to let caller handle failure
            log.error('Failed to add chat history job', error as Record<string, unknown>);
            throw error;
        }
    }

    /**
     * Add a new search history job to the queue for background processing.
     * @param data - The search history data containing search_input, ai_summary, and file_results
     * @throws Error if job creation fails
     */
    public async addSearchHistoryJob(data: SearchHistoryJobData): Promise<void> {
        try {
            // Create a new job with the search history data payload
            const job = this.searchHistoryQueue.createJob(data as any);

            // Persist job to Redis queue for processing
            await job.save();

            // Log successful job creation with job ID for tracking
            log.info(`Added search history job ${job.id}`);
        } catch (error) {
            // Log error and re-throw to let caller handle failure
            log.error('Failed to add search history job', error as Record<string, unknown>);
            throw error;
        }
    }

    /**
     * Start processing chat history jobs from the queue.
     * Uses smart concurrency based on CPU cores and database pool size.
     * Each job saves chat history data to the database via ModelFactory.
     */
    private processChatHistoryJobs(): void {
        // Register job processor with computed optimal concurrency
        this.chatHistoryQueue.process(this.optimalConcurrency, async (job: any) => {
            // Log when job processing starts
            log.info(`Processing chat history job ${job.id}`);

            try {
                // Destructure job data to extract chat history fields
                const { session_id, user_email, user_prompt, llm_response, citations } = job.data;

                // Persist chat history to database via model factory
                await ModelFactory.externalChatHistory.create({
                    session_id,
                    user_email,
                    user_prompt,
                    llm_response,
                    citations: citations as any,
                });

                // Log successful completion
                log.info(`Processed chat history job ${job.id}`);
            } catch (error) {
                // Log error and re-throw to trigger job failure/retry
                log.error(`Failed to process chat history job ${job.id}`, error as Record<string, unknown>);
                throw error;
            }
        });
    }

    /**
     * Start processing search history jobs from the queue.
     * Uses smart concurrency based on CPU cores and database pool size.
     * Each job saves search history data to the database via ModelFactory.
     */
    private processSearchHistoryJobs(): void {
        // Register job processor with computed optimal concurrency
        this.searchHistoryQueue.process(this.optimalConcurrency, async (job: any) => {
            // Log when job processing starts
            log.info(`Processing search history job ${job.id}`);

            try {
                // Destructure job data to extract search history fields
                const { search_input, user_email, ai_summary, file_results } = job.data;

                // Persist search history to database via model factory
                await ModelFactory.externalSearchHistory.create({
                    search_input,
                    user_email,
                    ai_summary,
                    file_results: file_results as any,
                });

                // Log successful completion
                log.info(`Processed search history job ${job.id}`);
            } catch (error) {
                // Log error and re-throw to trigger job failure/retry
                log.error(`Failed to process search history job ${job.id}`, error as Record<string, unknown>);
                throw error;
            }
        });
    }

    /**
     * Gracefully close all queue connections.
     * Should be called during application shutdown to ensure proper cleanup.
     */
    public async close(): Promise<void> {
        // Close chat history queue connection to Redis
        await this.chatHistoryQueue.close();

        // Close search history queue connection to Redis
        await this.searchHistoryQueue.close();
    }
}

export const queueService = QueueService.getInstance();
