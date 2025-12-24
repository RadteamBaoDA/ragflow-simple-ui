
import { langfuseClient } from '../models/external/langfuse.js';
import { ModelFactory } from '../models/factory.js';
import { config } from '../config/index.js';
import { log } from './logger.service.js';
import { createClient } from 'redis';

export interface ExternalTraceParams {
    email: string;
    message: string;
    ipAddress: string;
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

    private async getRedisClient(): Promise<ReturnType<typeof createClient> | null> {
        if (this.redisClient && this.redisClient.isReady) {
            return this.redisClient;
        }

        try {
            this.redisClient = createClient({
                url: config.redis.url,
            });

            this.redisClient.on('error', (err) => {
                log.error('External trace Redis client error', { error: err.message });
            });

            await this.redisClient.connect();
            log.info('External trace Redis client connected');
            return this.redisClient;
        } catch (error) {
            log.warn('Failed to connect Redis for external trace caching', {
                error: error instanceof Error ? error.message : String(error)
            });
            return null;
        }
    }

    private getCacheKey(ipAddress: string, email: string): string {
        return `${this.CACHE_PREFIX}${ipAddress}:${email.toLowerCase()}`;
    }

    private getLockKey(ipAddress: string, email: string): string {
        return `${this.LOCK_PREFIX}${ipAddress}:${email.toLowerCase()}`;
    }

    private async getEmailValidationFromCache(cacheKey: string): Promise<boolean | null> {
        const redis = await this.getRedisClient();
        if (!redis) return null;

        try {
            const cached = await redis.get(cacheKey);
            if (cached !== null) {
                return cached === 'true';
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    private async setEmailValidationInCache(cacheKey: string, isValid: boolean): Promise<void> {
        const redis = await this.getRedisClient();
        if (!redis) return;

        try {
            await redis.setEx(
                cacheKey,
                config.externalTrace.cacheTtlSeconds,
                isValid ? 'true' : 'false'
            );
        } catch (error) {
        }
    }

    private async acquireLock(lockKey: string): Promise<boolean> {
        const redis = await this.getRedisClient();
        if (!redis) return true;

        try {
            const result = await redis.setNX(lockKey, 'locked');
            const acquired = !!result;
            if (acquired) {
                await redis.pExpire(lockKey, config.externalTrace.lockTimeoutMs);
            }
            return acquired;
        } catch (error) {
            return true;
        }
    }

    private async releaseLock(lockKey: string): Promise<void> {
        const redis = await this.getRedisClient();
        if (!redis) return;

        try {
            await redis.del(lockKey);
        } catch (error) {
        }
    }

    private async waitForLock(lockKey: string, maxAttempts = 5): Promise<boolean> {
        const redis = await this.getRedisClient();
        if (!redis) return true;

        for (let i = 0; i < maxAttempts; i++) {
            const delay = Math.pow(2, i) * 50;
            await new Promise(resolve => setTimeout(resolve, delay));

            const exists = await redis.exists(lockKey);
            if (!exists) {
                return true;
            }
        }
        return false;
    }

    async validateEmailWithCache(email: string, ipAddress: string): Promise<boolean> {
        const cacheKey = this.getCacheKey(ipAddress, email);
        const lockKey = this.getLockKey(ipAddress, email);

        const cachedResult = await this.getEmailValidationFromCache(cacheKey);
        if (cachedResult !== null) {
            return cachedResult;
        }

        const lockAcquired = await this.acquireLock(lockKey);

        if (!lockAcquired) {
            await this.waitForLock(lockKey);
            const resultAfterWait = await this.getEmailValidationFromCache(cacheKey);
            if (resultAfterWait !== null) {
                return resultAfterWait;
            }
        }

        try {
            const user = await ModelFactory.user.findByEmail(email);

            const isValid = !!user;
            await this.setEmailValidationInCache(cacheKey, isValid);

            return isValid;
        } finally {
            if (lockAcquired) {
                await this.releaseLock(lockKey);
            }
        }
    }

    private buildTags(metadata?: any): string[] {
        const tags = [...this.DEFAULT_TAGS];

        if (metadata?.tags && Array.isArray(metadata.tags)) {
            tags.push(...metadata.tags);
        }

        if (metadata?.source) {
            tags.push(metadata.source);
        }

        if (metadata?.task && !['user_response', 'llm_response'].includes(metadata.task)) {
            tags.push(metadata.task);
        }

        return [...new Set(tags)];
    }

    // Renamed from collectTrace to processTrace to match controller usage
    async processTrace(params: ExternalTraceParams): Promise<CollectTraceResult> {
        const { email, message, ipAddress, role = 'user', response, metadata } = params;

        const isValidEmail = await this.validateEmailWithCache(email, ipAddress);

        if (!isValidEmail) {
            return {
                success: false,
                error: 'Invalid email: not registered in system'
            };
        }

        try {
            const langfuse = langfuseClient; // Use singleton directly

            const chatId = metadata?.chatId ?? metadata?.sessionId ?? `chat-${email}-${Date.now()}`;
            const taskName = metadata?.task ?? (role === 'assistant' ? 'llm_response' : 'user_response');
            const tags = this.buildTags(metadata);

            let trace = this.chatTraces.get(chatId);

            if (!trace) {
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
                trace.update({
                    tags,
                    input: message,
                });
            }

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
                const hasUsage = metadata?.usage &&
                    (typeof metadata.usage.promptTokens === 'number' ||
                        typeof metadata.usage.completionTokens === 'number');

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

                if (response) {
                    trace.update({ output: response });
                }
            } else {
                trace.event({
                    name: `${taskName}:${Date.now()}`,
                    input: message,
                    metadata: enhancedMetadata,
                });
            }

            await langfuse.flushAsync();

            return {
                success: true,
                traceId: trace.id
            };
        } catch (error) {
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

    async processFeedback(params: any): Promise<any> {
        // Placeholder for feedback processing - Langfuse SDK has score/feedback methods
        // Assuming params has traceId, score, etc.
        const { traceId, score, comment } = params;
        if (!traceId) throw new Error('Trace ID required');

        const langfuse = langfuseClient;
        langfuse.score({
            traceId,
            name: 'user_feedback',
            value: score,
            comment
        });

        await langfuse.flushAsync();
        return { success: true };
    }

    async shutdown(): Promise<void> {
        if (this.redisClient && this.redisClient.isOpen) {
            await this.redisClient.quit();
        }
    }
}

export const externalTraceService = new ExternalTraceService();
