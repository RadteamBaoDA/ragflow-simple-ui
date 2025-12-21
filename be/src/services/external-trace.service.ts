/**
 * @fileoverview External trace collection service.
 * 
 * This module handles collecting trace data from external systems with:
 * - Langfuse tracing for observability (based on open-webui pipeline patterns)
 * - Email validation against the database
 * - IP-based Redis caching for performance
 * - Request locking to prevent race conditions
 * 
 * @module services/external-trace
 */

import { getLangfuseClient } from './langfuse.service.js';
import { queryOne } from '../db/index.js';
import { config } from '../config/index.js';
import { log } from './logger.service.js';
import { createClient } from 'redis';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Parameters for collecting external trace data.
 * Based on open-webui Langfuse pipeline patterns for enhanced observability.
 */
export interface ExternalTraceParams {
    /** User's email address - must exist in database */
    email: string;
    /** The chat message content (user input) */
    message: string;
    /** Client IP address for caching */
    ipAddress: string;
    /** Message role: 'user' for input, 'assistant' for LLM response */
    role?: 'user' | 'assistant';
    /** LLM response content (when role is 'assistant') */
    response?: string;
    /** Optional metadata about the chat */
    metadata?: {
        /** Source system identifier */
        source?: string;
        /** Session ID from the external system - enables trace reuse */
        sessionId?: string;
        /** Chat/conversation ID */
        chatId?: string;
        /** Timestamp of the message */
        timestamp?: string;
        /** Model ID used for generation */
        model?: string;
        /** Model display name */
        modelName?: string;
        /** Task type: llm_response, user_response, etc. */
        task?: string;
        /** Token usage information */
        usage?: {
            promptTokens?: number;
            completionTokens?: number;
            totalTokens?: number;
        };
        /** Tags for filtering in Langfuse UI */
        tags?: string[];
        /** Any additional custom data */
        [key: string]: unknown;
    };
}

/**
 * Result of collecting trace data.
 */
export interface CollectTraceResult {
    /** Whether the operation was successful */
    success: boolean;
    /** Langfuse trace ID if successful */
    traceId?: string;
    /** Error message if failed */
    error?: string;
}

/**
 * User record for email validation (minimal fields).
 */
interface UserRecord {
    id: string;
    email: string;
}

// ============================================================================
// EXTERNAL TRACE SERVICE CLASS
// ============================================================================

/**
 * Service for collecting trace data from external systems.
 * Uses Langfuse for tracing and Redis for caching email validation.
 */
export class ExternalTraceService {
    /** Redis client for caching */
    private redisClient: ReturnType<typeof createClient> | null = null;

    /** Cache key prefix */
    private readonly CACHE_PREFIX = 'kb:email-validation:';

    /** Lock key prefix */
    private readonly LOCK_PREFIX = 'kb:email-lock:';

    /** 
     * Session-based trace cache for reusing traces.
     * Based on open-webui Langfuse pipeline pattern.
     */
    private chatTraces: Map<string, ReturnType<ReturnType<typeof getLangfuseClient>['trace']>> = new Map();

    /** Default tags for all traces */
    private readonly DEFAULT_TAGS = ['knowledge-base', 'external-trace'];

    /**
     * Initialize Redis client for caching.
     */
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

    /**
     * Generate cache key for email validation.
     */
    private getCacheKey(ipAddress: string, email: string): string {
        return `${this.CACHE_PREFIX}${ipAddress}:${email.toLowerCase()}`;
    }

    /**
     * Generate lock key for preventing race conditions.
     */
    private getLockKey(ipAddress: string, email: string): string {
        return `${this.LOCK_PREFIX}${ipAddress}:${email.toLowerCase()}`;
    }

    /**
     * Get cached email validation result.
     */
    private async getEmailValidationFromCache(cacheKey: string): Promise<boolean | null> {
        const redis = await this.getRedisClient();
        if (!redis) return null;

        try {
            const cached = await redis.get(cacheKey);
            if (cached !== null) {
                log.debug('Email validation cache hit', { cacheKey });
                return cached === 'true';
            }
            return null;
        } catch (error) {
            log.warn('Failed to get email validation cache', {
                error: error instanceof Error ? error.message : String(error)
            });
            return null;
        }
    }

    /**
     * Store email validation result in cache.
     */
    private async setEmailValidationInCache(cacheKey: string, isValid: boolean): Promise<void> {
        const redis = await this.getRedisClient();
        if (!redis) return;

        try {
            await redis.setEx(
                cacheKey,
                config.externalTrace.cacheTtlSeconds,
                isValid ? 'true' : 'false'
            );
            log.debug('Email validation cached', { cacheKey, isValid });
        } catch (error) {
            log.warn('Failed to cache email validation', {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    /**
     * Acquire a distributed lock using Redis SETNX.
     */
    private async acquireLock(lockKey: string): Promise<boolean> {
        const redis = await this.getRedisClient();
        if (!redis) return true;

        try {
            const result = await redis.setNX(lockKey, 'locked');
            const acquired = !!result;
            if (acquired) {
                await redis.pExpire(lockKey, config.externalTrace.lockTimeoutMs);
                log.debug('Lock acquired', { lockKey });
            }
            return acquired;
        } catch (error) {
            log.warn('Failed to acquire lock', {
                error: error instanceof Error ? error.message : String(error)
            });
            return true;
        }
    }

    /**
     * Release a distributed lock.
     */
    private async releaseLock(lockKey: string): Promise<void> {
        const redis = await this.getRedisClient();
        if (!redis) return;

        try {
            await redis.del(lockKey);
            log.debug('Lock released', { lockKey });
        } catch (error) {
            log.warn('Failed to release lock', {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    /**
     * Wait for lock to be released with exponential backoff.
     */
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

        log.warn('Lock wait timeout', { lockKey, maxAttempts });
        return false;
    }

    /**
     * Validate email exists in database with caching and locking.
     */
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
            const user = await queryOne<UserRecord>(
                'SELECT id, email FROM users WHERE LOWER(email) = LOWER($1)',
                [email]
            );

            const isValid = !!user;
            await this.setEmailValidationInCache(cacheKey, isValid);

            log.debug('Email validation completed', { email, isValid });
            return isValid;
        } finally {
            if (lockAcquired) {
                await this.releaseLock(lockKey);
            }
        }
    }

    /**
     * Build tags list based on metadata and defaults.
     * Based on open-webui Langfuse pipeline pattern.
     */
    private buildTags(metadata?: ExternalTraceParams['metadata']): string[] {
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

    /**
     * Collect chat data from an external system.
     * Enhanced with open-webui Langfuse pipeline patterns:
     * - Session-based trace reuse
     * - Tags for filtering
     * - Generation vs Event differentiation
     * - Usage metrics tracking
     */
    async collectTrace(params: ExternalTraceParams): Promise<CollectTraceResult> {
        const { email, message, ipAddress, role = 'user', response, metadata } = params;

        log.debug('Collecting external trace', {
            email,
            role,
            ipAddress: ipAddress.substring(0, 20),
            sessionId: metadata?.sessionId
        });

        const isValidEmail = await this.validateEmailWithCache(email, ipAddress);

        if (!isValidEmail) {
            log.warn('External trace rejected: email not in database', { email });
            return {
                success: false,
                error: 'Invalid email: not registered in system'
            };
        }

        try {
            const langfuse = getLangfuseClient();
            log.debug('Langfuse client obtained', { clientExists: !!langfuse });

            const chatId = metadata?.chatId ?? metadata?.sessionId ?? `chat-${email}-${Date.now()}`;
            const taskName = metadata?.task ?? (role === 'assistant' ? 'llm_response' : 'user_response');
            const tags = this.buildTags(metadata);

            log.debug('Trace params built', { chatId, taskName, tagsCount: tags.length });

            let trace = this.chatTraces.get(chatId);

            if (!trace) {
                log.debug('Creating new Langfuse trace', { chatId });

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
                log.debug('Reusing existing trace', { chatId });
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
                            unit: 'TOKENS' as const,
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

            log.info('External trace collected successfully', {
                email,
                traceId: trace.id,
                chatId,
                role,
                task: taskName,
                source: metadata?.source
            });

            return {
                success: true,
                traceId: trace.id
            };
        } catch (error) {
            log.error('Failed to collect external trace', {
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
     * Shutdown the service and close Redis connection.
     */
    async shutdown(): Promise<void> {
        if (this.redisClient && this.redisClient.isOpen) {
            await this.redisClient.quit();
            log.info('External trace Redis client disconnected');
        }
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

/** Singleton external trace service instance */
export const externalTraceService = new ExternalTraceService();

