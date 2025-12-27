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



export class QueueService {
    private static instance: QueueService;


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

        // Log successful startup with connection and concurrency details
        log.info('BeeQueue service started successfully', {
            queues: [],
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
     * @returns number - Optimal concurrency per queue (minimum 1)
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
     * @returns void
     * @description Placeholder for future queue event monitoring
     */
    private setupQueueEventListeners(): void {
        // Implementation for queue event listeners
    }

    /**
     * Get the singleton instance of QueueService.
     * Creates a new instance if one doesn't exist.
     * @returns QueueService - The singleton QueueService instance
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
     * Gracefully close queue connections.
     * @returns Promise<void>
     * @description Placeholder for cleanup logic (e.g., closing Redis connections).
     */
    public async close(): Promise<void> {
        // Implementation for graceful shutdown
    }
}

export const queueService = QueueService.getInstance();
