
// Processes external trace submissions with Redis-backed email validation cache and Langfuse logging.
import { langfuseClient } from '@/models/external/langfuse.js';
import { ModelFactory } from '@/models/factory.js';
import { config } from '@/config/index.js';
import { log } from '@/services/logger.service.js';
import { createClient } from 'redis';

export interface ExternalTraceParams {
    email: string;
    message: string;
    ipAddress: string;
    share_id?: string;
    role?: 'user' | 'assistant';
    response?: string;
    metadata?: any;
}

export interface CollectTraceResult {
    success: boolean;
    traceId?: string;
    error?: string;
}

export class ExternalTraceService {
    private redisClient: ReturnType<typeof createClient> | null = null;
    private readonly CACHE_PREFIX = 'kb:email-validation:';
    private readonly LOCK_PREFIX = 'kb:email-lock:';
    private chatTraces: Map<string, any> = new Map();
    private readonly DEFAULT_TAGS = ['knowledge-base', 'external-trace'];

    /**
     * Lazily connect to Redis; continue without cache on failure.
     * @returns Promise<ReturnType<typeof createClient> | null> - The Redis client or null.
     * @description Initializes and connects the Redis client if not already connected.
     */
    private async getRedisClient(): Promise<ReturnType<typeof createClient> | null> {
        // Return existing client if connected
        if (this.redisClient && this.redisClient.isReady) {
            return this.redisClient;
        }

        try {
            // Create new client instance
            this.redisClient = createClient({
                url: config.redis.url,
            });

            // Handle client errors
            this.redisClient.on('error', (err) => {
                log.error('External trace Redis client error', { error: err.message });
            });

            // Connect to Redis
            await this.redisClient.connect();
            log.info('External trace Redis client connected');
            return this.redisClient;
        } catch (error) {
            // Log warning but allow fallthrough to DB mode
            log.warn('Failed to connect Redis for external trace caching', {
                error: error instanceof Error ? error.message : String(error)
            });
            return null;
        }
    }

    /**
     * Generate cache key for email validation.
     * @param ipAddress - Request IP.
     * @param email - User email.
     * @returns string - The cache key.
     * @description Includes IP and email to throttle per-actor validation.
     */
    private getCacheKey(ipAddress: string, email: string): string {
        return `${this.CACHE_PREFIX}${ipAddress}:${email.toLowerCase()}`;
    }

    /**
     * Generate lock key for cache population.
     * @param ipAddress - Request IP.
     * @param email - User email.
     * @returns string - The lock key.
     * @description Used to prevent cache stampedes on first-time validation.
     */
    private getLockKey(ipAddress: string, email: string): string {
        return `${this.LOCK_PREFIX}${ipAddress}:${email.toLowerCase()}`;
    }

    /**
     * Retrieve validation result from Redis cache.
     * @param cacheKey - The cache key.
     * @returns Promise<boolean | null> - True/False if cached, null if miss or error.
     * @description Checks Redis for a previously cached validation result.
     */
    private async getEmailValidationFromCache(cacheKey: string): Promise<boolean | null> {
        // Get redis client
        const redis = await this.getRedisClient();
        if (!redis) return null;

        try {
            // Fetch value from cache
            const cached = await redis.get(cacheKey);
            if (cached !== null) {
                // Return boolean representation
                return cached === 'true';
            }
            return null;
        } catch (error) {
            // Swallow errors on cache read
            return null;
        }
    }

    /**
     * Store validation result in Redis cache.
     * @param cacheKey - The cache key.
     * @param isValid - The validation result.
     * @returns Promise<void>
     * @description Caches the result with a TTL to reduce database load.
     */
    private async setEmailValidationInCache(cacheKey: string, isValid: boolean): Promise<void> {
        // Get redis client
        const redis = await this.getRedisClient();
        if (!redis) return;

        try {
            // Set value with expiration
            await redis.setEx(
                cacheKey,
                config.externalTrace.cacheTtlSeconds,
                isValid ? 'true' : 'false'
            );
        } catch (error) {
            // Ignore cache write errors
        }
    }

    /**
     * Acquire a distributed lock.
     * @param lockKey - The lock key.
     * @returns Promise<boolean> - True if lock acquired (or Redis unavailable), false if locked.
     * @description Tries to set a key with NX flag to acquire lock.
     */
    private async acquireLock(lockKey: string): Promise<boolean> {
        // Get redis client; fail open if no redis
        const redis = await this.getRedisClient();
        if (!redis) return true;

        try {
            // Try to set key only if not exists
            const result = await redis.setNX(lockKey, 'locked');
            const acquired = !!result;
            if (acquired) {
                // Set expiry on lock to prevent deadlocks
                await redis.pExpire(lockKey, config.externalTrace.lockTimeoutMs);
            }
            return acquired;
        } catch (error) {
            // Fail open on error
            return true;
        }
    }

    /**
     * Release a distributed lock.
     * @param lockKey - The lock key.
     * @returns Promise<void>
     * @description Deletes the lock key.
     */
    private async releaseLock(lockKey: string): Promise<void> {
        const redis = await this.getRedisClient();
        if (!redis) return;

        try {
            await redis.del(lockKey);
        } catch (error) {
            // Ignore errors on release
        }
    }

    /**
     * Wait for a lock to be released with exponential backoff.
     * @param lockKey - The lock key to wait on.
     * @param maxAttempts - Maximum validation attempts.
     * @returns Promise<boolean> - True if lock cleared, false if still locked.
     * @description Polls Redis for lock existance.
     */
    private async waitForLock(lockKey: string, maxAttempts = 5): Promise<boolean> {
        const redis = await this.getRedisClient();
        if (!redis) return true;

        for (let i = 0; i < maxAttempts; i++) {
            // Exponential backoff delay
            const delay = Math.pow(2, i) * 50;
            await new Promise(resolve => setTimeout(resolve, delay));

            // Check if lock still exists
            const exists = await redis.exists(lockKey);
            if (!exists) {
                return true;
            }
        }
        return false;
    }

    /**
     * Validate email against user table with Redis cache/lock to reduce DB churn.
     * @param email - User email to validate.
     * @param ipAddress - Request IP.
     * @returns Promise<boolean> - True if user exists.
     * @description Checks cache first, then DB with locking to prevent stampedes.
     */
    async validateEmailWithCache(email: string, ipAddress: string): Promise<boolean> {
        const cacheKey = this.getCacheKey(ipAddress, email);
        const lockKey = this.getLockKey(ipAddress, email);

        // Check cache first
        const cachedResult = await this.getEmailValidationFromCache(cacheKey);
        if (cachedResult !== null) {
            return cachedResult;
        }

        // Acquire lock for DB lookup
        const lockAcquired = await this.acquireLock(lockKey);

        if (!lockAcquired) {
            // Another process is validating; wait for it
            await this.waitForLock(lockKey);
            // Re-check cache after wait
            const resultAfterWait = await this.getEmailValidationFromCache(cacheKey);
            // If populated, return it; otherwise proceed to DB (race condition lost, but safe)
            if (resultAfterWait !== null) {
                return resultAfterWait;
            }
        }

        try {
            // Check database for user
            const user = await ModelFactory.user.findByEmail(email);

            const isValid = !!user;
            // Update cache
            await this.setEmailValidationInCache(cacheKey, isValid);

            return isValid;
        } finally {
            // Always release lock
            if (lockAcquired) {
                await this.releaseLock(lockKey);
            }
        }
    }

    /**
     * Build tags array for trace.
     * @param metadata - Optional metadata containing tags.
     * @returns string[] - Array of unique tags.
     * @description Merges default tags, environment, and metadata tags.
     */
    private buildTags(metadata?: any, shareId?: string): string[] {
        // Initialize with default tags
        const tags = [...this.DEFAULT_TAGS];

        // Add server environment tag
        if (config.nodeEnv) {
            tags.push(config.nodeEnv);
        }

        // Add share_id as tag
        if (shareId) {
            tags.push(`share_id:${shareId}`);
        }

        // Add tags from metadata
        if (metadata?.tags && Array.isArray(metadata.tags)) {
            tags.push(...metadata.tags);
        }

        // Add source as tag
        if (metadata?.source) {
            tags.push(metadata.source);
        }

        // Add task type as tag (filtering out standard response types)
        if (metadata?.task && !['user_response', 'llm_response'].includes(metadata.task)) {
            tags.push(metadata.task);
        }

        // Return unique list
        return [...new Set(tags)];
    }

    /**
     * Validate email then emit Langfuse trace/generation events for chat traffic.
     * @param params - Trace parameters.
     * @returns Promise<CollectTraceResult> - Result of trace processing.
     * @description Main entry point for processing and logging external traces.
     */
    async processTrace(params: ExternalTraceParams): Promise<CollectTraceResult> {
        const { email, message, ipAddress, role = 'user', response, metadata } = params;

        // Perform validation
        const isValidEmail = await this.validateEmailWithCache(email, ipAddress);

        if (!isValidEmail) {
            return {
                success: false,
                error: 'Invalid email: not registered in system'
            };
        }

        try {
            const langfuse = langfuseClient; // singleton instance

            // Determine identifiers and context
            const chatId = metadata?.chatId ?? metadata?.sessionId ?? `chat-${email}-${Date.now()}`;
            const taskName = metadata?.task ?? (role === 'assistant' ? 'llm_response' : 'user_response');
            const tags = this.buildTags(metadata, params.share_id);

            // Access or initialize memory trace object
            let trace = this.chatTraces.get(chatId);

            if (!trace) {
                // Start a new trace if not exists in memory map
                trace = langfuse.trace({
                    name: `chat:${chatId}`,
                    userId: email,
                    sessionId: chatId,
                    tags,
                    metadata: {
                        source: metadata?.source ?? 'unknown',
                        interface: 'knowledge-base',
                        type: taskName,
                        ipAddress,
                        collectedAt: new Date().toISOString(),
                        ...metadata
                    },
                    input: message,
                });

                this.chatTraces.set(chatId, trace);
            } else {
                // Update existing trace
                trace.update({
                    tags,
                    input: message,
                });
            }

            // construct metadata for generation/event
            const enhancedMetadata = {
                email,
                type: taskName,
                interface: 'knowledge-base',
                source: metadata?.source,
                model_id: metadata?.model,
                model_name: metadata?.modelName,
                timestamp: metadata?.timestamp ?? new Date().toISOString(),
                ...metadata
            };

            const isGeneration = taskName === 'llm_response' || role === 'assistant';

            if (isGeneration) {
                // Check if usage data is available
                const hasUsage = metadata?.usage &&
                    (typeof metadata.usage.promptTokens === 'number' ||
                        typeof metadata.usage.completionTokens === 'number');

                // Log generation event
                if (hasUsage && metadata?.usage) {
                    trace.generation({
                        name: `${taskName}:${Date.now()}`,
                        model: metadata?.modelName ?? metadata?.model ?? 'unknown',
                        input: message,
                        output: response,
                        metadata: enhancedMetadata,
                        usage: {
                            input: metadata.usage.promptTokens ?? null,
                            output: metadata.usage.completionTokens ?? null,
                            total: metadata.usage.totalTokens ?? null,
                            unit: 'TOKENS',
                        },
                    });
                } else {
                    trace.generation({
                        name: `${taskName}:${Date.now()}`,
                        model: metadata?.modelName ?? metadata?.model ?? 'unknown',
                        input: message,
                        output: response,
                        metadata: enhancedMetadata,
                    });
                }

                // Update trace output if response is present
                if (response) {
                    trace.update({ output: response });
                }
            } else {
                // Log generic event (non-generation)
                trace.event({
                    name: `${taskName}:${Date.now()}`,
                    input: message,
                    metadata: enhancedMetadata,
                });
            }

            // Flush to Langfuse service
            await langfuse.flushAsync();
            log.debug('Trace processed successfully', { langtraceinfo: JSON.stringify(trace) });
            return {
                success: true,
                traceId: trace.id
            };
        } catch (error) {
            // Log failure
            log.error('Failed to process trace', {
                error: error instanceof Error ? error.message : String(error),
                email
            });
            return {
                success: false,
                error: 'Failed to process chat data'
            };
        }
    }

    /**
     * Record user feedback score against an existing Langfuse trace.
     * @param params - Feedback parameters (traceId, score, etc).
     * @returns Promise<any> - Result object.
     * @description Sends feedback data to Langfuse.
     */
    async processFeedback(params: any): Promise<any> {
        const { traceId, messageId, value, score, comment } = params;
        const id = traceId || messageId;

        if (!id) throw new Error('Trace ID required');

        const langfuse = langfuseClient;
        // Submit score
        langfuse.score({
            traceId: id,
            name: 'user-feedback',
            value: value ?? score,
            comment
        });

        // Flush async
        await langfuse.flushAsync();
        return { success: true };
    }

    /**
     * Graceful cleanup of Redis connection.
     * @returns Promise<void>
     * @description Closes the Redis connection if open.
     */
    async shutdown(): Promise<void> {
        if (this.redisClient && this.redisClient.isOpen) {
            await this.redisClient.quit();
        }
    }
}

export const externalTraceService = new ExternalTraceService();
