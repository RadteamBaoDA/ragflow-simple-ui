import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { externalTraceService } from '../../../src/services/external-trace.service.js';
import { config } from '../../../src/config/index.js';
import traceRouter from '../../../src/routes/external/trace.routes.js';

// Mock dependencies
vi.mock('../../../src/services/external-trace.service.js');
vi.mock('../../../src/services/logger.service.js');
vi.mock('../../../src/config/index.js', () => ({
    config: {
        externalTrace: {
            enabled: true,
            apiKey: 'test-api-key'
        }
    }
}));
vi.mock('../../../src/middleware/external.middleware.js', () => ({
    checkEnabled: (req: any, res: any, next: any) => next()
}));

const app = express();
app.use(express.json());
app.use('/api/external/trace', traceRouter);

describe('External Trace Routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('POST /api/external/trace', () => {
        const validBody = {
            email: 'test@example.com',
            message: 'Hello world',
            role: 'user',
            metadata: {
                source: 'test'
            }
        };

        const apiKey = 'test-api-key';

        it('should return 200 and traceId when trace is collected successfully', async () => {
            const mockTraceId = 'test-trace-id-123';
            (externalTraceService.collectTrace as any).mockResolvedValue({
                success: true,
                traceId: mockTraceId
            });

            const response = await request(app)
                .post('/api/external/trace')
                .set('x-api-key', apiKey)
                .send(validBody);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.traceId).toBe(mockTraceId); // Verify traceId is returned

            expect(externalTraceService.collectTrace).toHaveBeenCalledWith(expect.objectContaining({
                email: validBody.email,
                message: validBody.message
            }));
        });

        it('should return 401 when API key is missing or invalid', async () => {
            const response = await request(app)
                .post('/api/external/trace')
                .set('x-api-key', 'wrong-key')
                .send(validBody);

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Invalid or missing API key');
        });

        it('should return 400 when email is missing', async () => {
            const response = await request(app)
                .post('/api/external/trace')
                .set('x-api-key', apiKey)
                .send({ ...validBody, email: undefined });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Missing or invalid email');
        });

        it('should return 403 when email is not registered', async () => {
            (externalTraceService.collectTrace as any).mockResolvedValue({
                success: false,
                error: 'Invalid email: not registered in system'
            });

            const response = await request(app)
                .post('/api/external/trace')
                .set('x-api-key', apiKey)
                .send(validBody);

            expect(response.status).toBe(403);
            expect(response.body.error).toBe('Invalid email: not registered in system');
        });
    });

    describe('POST /api/external/trace/feedback', () => {
        const validBody = {
            email: 'test@example.com',
            traceId: 'trace-123',
            value: 1,
            comment: 'Great!',
            name: 'user-feedback'
        };

        const apiKey = 'test-api-key';

        it('should return 200 when feedback is collected successfully', async () => {
            (externalTraceService.collectFeedback as any).mockResolvedValue({ success: true });

            const response = await request(app)
                .post('/api/external/trace/feedback')
                .set('x-api-key', apiKey)
                .send(validBody);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(externalTraceService.collectFeedback).toHaveBeenCalledWith(expect.objectContaining({
                email: validBody.email,
                traceId: validBody.traceId,
                value: validBody.value
            }));
        });

        it('should return 400 when value is missing', async () => {
            const response = await request(app)
                .post('/api/external/trace/feedback')
                .set('x-api-key', apiKey)
                .send({ ...validBody, value: undefined });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Missing or invalid value (must be a number)');
        });

        it('should return 403 when email is not registered', async () => {
            (externalTraceService.collectFeedback as any).mockResolvedValue({
                success: false,
                error: 'Invalid email: not registered in system'
            });

            const response = await request(app)
                .post('/api/external/trace/feedback')
                .set('x-api-key', apiKey)
                .send(validBody);

            expect(response.status).toBe(403);
            expect(response.body.error).toBe('Invalid email: not registered in system');
        });
    });
});
