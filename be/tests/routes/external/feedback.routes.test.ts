import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { externalFeedbackService } from '../../../src/services/external-feedback.service.js';
import { config } from '../../../src/config/index.js';
import feedbackRouter from '../../../src/routes/external/feedback.routes.js';

// Mock dependencies
vi.mock('../../../src/services/external-feedback.service.js');
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
app.use('/api/external/feedback', feedbackRouter);

describe('External Feedback Routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('POST /api/external/feedback', () => {
        const validBody = {
            email: 'test@example.com',
            traceId: 'trace-123',
            value: 1,
            comment: 'Great!',
            name: 'user-feedback'
        };

        const apiKey = 'test-api-key';

        it('should return 200 when feedback is collected successfully', async () => {
            (externalFeedbackService.collectFeedback as any).mockResolvedValue({ success: true });

            const response = await request(app)
                .post('/api/external/feedback')
                .set('x-api-key', apiKey)
                .send(validBody);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(externalFeedbackService.collectFeedback).toHaveBeenCalledWith(expect.objectContaining({
                email: validBody.email,
                traceId: validBody.traceId,
                value: validBody.value
            }));
        });

        it('should return 401 when API key is missing or invalid', async () => {
            const response = await request(app)
                .post('/api/external/feedback')
                .set('x-api-key', 'wrong-key')
                .send(validBody);

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Invalid or missing API key');
        });

        it('should return 400 when email is missing', async () => {
            const response = await request(app)
                .post('/api/external/feedback')
                .set('x-api-key', apiKey)
                .send({ ...validBody, email: undefined });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Missing or invalid email');
        });

        it('should return 400 when email format is invalid', async () => {
            const response = await request(app)
                .post('/api/external/feedback')
                .set('x-api-key', apiKey)
                .send({ ...validBody, email: 'invalid-email' });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Invalid email format');
        });

        it('should return 400 when traceId is missing', async () => {
            const response = await request(app)
                .post('/api/external/feedback')
                .set('x-api-key', apiKey)
                .send({ ...validBody, traceId: undefined });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Missing or invalid traceId');
        });

        it('should return 400 when value is missing', async () => {
            const response = await request(app)
                .post('/api/external/feedback')
                .set('x-api-key', apiKey)
                .send({ ...validBody, value: undefined });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Missing or invalid value (must be a number)');
        });

        it('should return 403 when email is not registered', async () => {
            (externalFeedbackService.collectFeedback as any).mockResolvedValue({
                success: false,
                error: 'Invalid email: not registered in system'
            });

            const response = await request(app)
                .post('/api/external/feedback')
                .set('x-api-key', apiKey)
                .send(validBody);

            expect(response.status).toBe(403);
            expect(response.body.error).toBe('Invalid email: not registered in system');
        });

        it('should return 500 when service fails', async () => {
            (externalFeedbackService.collectFeedback as any).mockResolvedValue({
                success: false,
                error: 'Failed to process feedback data'
            });

            const response = await request(app)
                .post('/api/external/feedback')
                .set('x-api-key', apiKey)
                .send(validBody);

            expect(response.status).toBe(500);
            expect(response.body.error).toBe('Failed to process feedback data');
        });
    });
});
