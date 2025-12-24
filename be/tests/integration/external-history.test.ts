
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/index.js';
import { queueService } from '../../src/services/queue.service.js';
import { config } from '../../src/config/index.js';

// Mock queue service
vi.mock('../../src/services/queue.service.js', () => ({
    queueService: {
        initQueues: vi.fn(),
        addChatHistoryJob: vi.fn(),
        addSearchHistoryJob: vi.fn(),
        closeQueues: vi.fn(),
    }
}));

// Mock logger
vi.mock('@/services/logger.service.js', () => ({
    log: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
    },
}));

describe('External History API', () => {
    // Mock API Key if config check enabled
    const apiKey = 'test-api-key';
    const originalApiKey = config.externalTrace.apiKey;

    beforeEach(() => {
        vi.resetAllMocks();
        // Force API key for testing
        // @ts-ignore
        config.externalTrace.apiKey = apiKey;
    });

    afterEach(() => {
        // @ts-ignore
        config.externalTrace.apiKey = originalApiKey;
    });

    describe('POST /api/external/history/chat', () => {
        const validChatPayload = {
            session_id: 'test-session-123',
            user_id: 'user-123',
            messages: [
                {
                    prompt: 'Hello',
                    response: 'Hi there',
                    citations: [{ source: 'doc1.pdf' }]
                }
            ]
        };

        it('should return 401 if API key is invalid', async () => {
            await request(app)
                .post('/api/external/history/chat')
                .set('x-api-key', 'wrong-key')
                .send(validChatPayload)
                .expect(401);
        });

        it('should return 400 if session_id is missing', async () => {
            const payload = { ...validChatPayload, session_id: undefined };
            await request(app)
                .post('/api/external/history/chat')
                .set('x-api-key', apiKey)
                .send(payload)
                .expect(400);
        });

        it('should return 400 if messages is not an array', async () => {
            const payload = { ...validChatPayload, messages: 'not-an-array' };
            await request(app)
                .post('/api/external/history/chat')
                .set('x-api-key', apiKey)
                .send(payload)
                .expect(400);
        });

        it('should queue chat history job and return 202', async () => {
            await request(app)
                .post('/api/external/history/chat')
                .set('x-api-key', apiKey)
                .send(validChatPayload)
                .expect(202);

            expect(queueService.addChatHistoryJob).toHaveBeenCalledWith({
                sessionId: 'test-session-123',
                userId: 'user-123',
                messages: [
                    {
                        prompt: 'Hello',
                        response: 'Hi there',
                        citations: [{ source: 'doc1.pdf' }]
                    }
                ]
            });
        });
    });

    describe('POST /api/external/history/search', () => {
        const validSearchPayload = {
            session_id: 'test-session-123',
            user_id: 'user-123',
            query: 'test query',
            summary: 'test summary',
            results: [{ file: 'doc1.pdf', score: 0.9 }]
        };

        it('should return 401 if API key is invalid', async () => {
            await request(app)
                .post('/api/external/history/search')
                .set('x-api-key', 'wrong-key')
                .send(validSearchPayload)
                .expect(401);
        });

        it('should return 400 if session_id is missing', async () => {
            const payload = { ...validSearchPayload, session_id: undefined };
            await request(app)
                .post('/api/external/history/search')
                .set('x-api-key', apiKey)
                .send(payload)
                .expect(400);
        });

        it('should return 400 if query is missing', async () => {
            const payload = { ...validSearchPayload, query: undefined };
            await request(app)
                .post('/api/external/history/search')
                .set('x-api-key', apiKey)
                .send(payload)
                .expect(400);
        });

        it('should queue search history job and return 202', async () => {
            await request(app)
                .post('/api/external/history/search')
                .set('x-api-key', apiKey)
                .send(validSearchPayload)
                .expect(202);

            expect(queueService.addSearchHistoryJob).toHaveBeenCalledWith({
                sessionId: 'test-session-123',
                userId: 'user-123',
                query: 'test query',
                summary: 'test summary',
                results: [{ file: 'doc1.pdf', score: 0.9 }]
            });
        });
    });
});
