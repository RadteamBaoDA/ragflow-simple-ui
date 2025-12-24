
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { addToHistoryQueue, processHistoryQueue } from '../../src/services/queue.service.js';
import * as redisService from '../../src/services/redis.service.js';
import { db } from '../../src/db/index.js';

// Mock Redis Service
vi.mock('../../src/services/redis.service.js', () => ({
    getRedisClient: vi.fn(),
}));

// Mock DB
vi.mock('../../src/db/index.js', () => ({
    db: {
        query: vi.fn(),
    },
}));

// Mock Logger
vi.mock('../../src/services/logger.service.js', () => ({
    log: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

describe('Queue Service', () => {
    let mockRedisClient: any;

    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();

        mockRedisClient = {
            isOpen: true,
            lPush: vi.fn(),
            rPop: vi.fn(),
        };
        (redisService.getRedisClient as any).mockReturnValue(mockRedisClient);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('addToHistoryQueue', () => {
        it('should push chat history to Redis queue', async () => {
            const data = {
                session_id: '123',
                user_prompt: 'hello',
                llm_response: 'hi',
                citation_info: {}
            };

            await addToHistoryQueue('chat', data);

            expect(mockRedisClient.lPush).toHaveBeenCalledWith('ragflow:history:chat', JSON.stringify(data));
        });

        it('should push search history to Redis queue', async () => {
            const data = {
                session_id: '123',
                search_input: 'query',
                file_name_result: []
            };

            await addToHistoryQueue('search', data);

            expect(mockRedisClient.lPush).toHaveBeenCalledWith('ragflow:history:search', JSON.stringify(data));
        });

        it('should fallback to DB if Redis is unavailable', async () => {
            (redisService.getRedisClient as any).mockReturnValue(null);

            const data = {
                session_id: '123',
                user_prompt: 'hello',
                llm_response: 'hi',
                citation_info: {}
            };

            await addToHistoryQueue('chat', data);

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO ragflow_chat_history'),
                expect.arrayContaining(['123', 'hello', 'hi'])
            );
        });

        it('should fallback to DB if Redis push fails', async () => {
            mockRedisClient.lPush.mockRejectedValue(new Error('Redis error'));

            const data = {
                session_id: '123',
                user_prompt: 'hello',
                llm_response: 'hi',
                citation_info: {}
            };

            await addToHistoryQueue('chat', data);

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO ragflow_chat_history'),
                expect.arrayContaining(['123', 'hello', 'hi'])
            );
        });
    });
});
