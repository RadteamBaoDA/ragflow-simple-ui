
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import ragflowRouter from '../../src/routes/ragflow.js';
import * as queueService from '../../src/services/queue.service.js';

// Mock Queue Service
vi.mock('../../src/services/queue.service.js', () => ({
    addToHistoryQueue: vi.fn(),
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

const app = express();
app.use(express.json());
app.use('/api/ragflow', ragflowRouter);

describe('RAGFlow Routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('POST /api/ragflow/chat-history', () => {
        it('should accept valid chat history', async () => {
            const data = {
                session_id: '123',
                user_prompt: 'hello',
                llm_response: 'hi',
                citation_info: {}
            };

            const res = await request(app)
                .post('/api/ragflow/chat-history')
                .send(data);

            expect(res.status).toBe(202);
            expect(queueService.addToHistoryQueue).toHaveBeenCalledWith('chat', expect.objectContaining(data));
        });

        it('should reject invalid chat history (missing session_id)', async () => {
            const data = {
                user_prompt: 'hello',
                llm_response: 'hi',
            };

            const res = await request(app)
                .post('/api/ragflow/chat-history')
                .send(data);

            expect(res.status).toBe(400);
            expect(queueService.addToHistoryQueue).not.toHaveBeenCalled();
        });
    });

    describe('POST /api/ragflow/search-history', () => {
        it('should accept valid search history', async () => {
            const data = {
                session_id: '123',
                search_input: 'query',
                file_name_result: []
            };

            const res = await request(app)
                .post('/api/ragflow/search-history')
                .send(data);

            expect(res.status).toBe(202);
            expect(queueService.addToHistoryQueue).toHaveBeenCalledWith('search', expect.objectContaining(data));
        });

        it('should reject invalid search history (missing search_input)', async () => {
            const data = {
                session_id: '123',
            };

            const res = await request(app)
                .post('/api/ragflow/search-history')
                .send(data);

            expect(res.status).toBe(400);
            expect(queueService.addToHistoryQueue).not.toHaveBeenCalled();
        });
    });
});
