/**
 * @fileoverview Redis service for session storage and caching.
 * 
 * This module manages the Redis client connection.
 * It provides a singleton client instance and helper methods
 * for checking connection status.
 * 
 * @module services/redis
 */

import { createClient } from 'redis';
import { config } from '@/config/index.js';
import { log } from '@/services/logger.service.js';

/** Redis client type alias */
export type RedisClient = ReturnType<typeof createClient>;

/** Singleton Redis client instance */
let redisClient: RedisClient | null = null;

/**
 * Initialize the Redis client if configured.
 * 
 * @returns Redis client instance or null if not configured
 */
export async function initRedis(): Promise<RedisClient | null> {
    if (config.sessionStore.type !== 'redis') {
        log.info('Redis not configured (using memory store)');
        return null;
    }

    if (redisClient) {
        return redisClient;
    }

    log.info('Initializing Redis client...', { url: config.redis.url.replace(/:[^:@]*@/, ':***@') });

    redisClient = createClient({
        url: config.redis.url,
    });

    // Redis event handlers for connection lifecycle logging
    redisClient.on('error', (err) => {
        log.error('Redis client error', { error: err.message });
    });

    redisClient.on('connect', () => {
        log.debug('Redis client connected');
    });

    redisClient.on('ready', () => {
        log.info('Redis client ready');
    });

    redisClient.on('reconnecting', () => {
        log.warn('Redis client reconnecting');
    });

    // Connect to Redis
    try {
        await redisClient.connect();
    } catch (error) {
        log.error('Failed to connect to Redis', {
            error: error instanceof Error ? error.message : String(error)
        });
        // We don't throw here to allow app to start even if Redis fails (if session store handles it)
        // But usually session store will fail if client is not connected.
    }

    return redisClient;
}

/**
 * Get the initialized Redis client.
 * 
 * @returns Redis client instance or null
 */
export function getRedisClient(): RedisClient | null {
    return redisClient;
}

/**
 * Shutdown the Redis client.
 */
export async function shutdownRedis(): Promise<void> {
    if (redisClient && redisClient.isOpen) {
        await redisClient.quit(); // Graceful shutdown
        log.info('Redis client disconnected');
        redisClient = null;
    }
}

/**
 * Get Redis connection status.
 * Used for health checks.
 */
export function getRedisStatus(): 'connected' | 'connecting' | 'disconnected' | 'not_initialized' | 'not_configured' {
    if (config.sessionStore.type !== 'redis') {
        return 'not_configured';
    }
    if (!redisClient) {
        return 'not_initialized';
    }
    if (redisClient.isReady) {
        return 'connected';
    }
    if (redisClient.isOpen) {
        return 'connecting';
    }
    return 'disconnected';
}
