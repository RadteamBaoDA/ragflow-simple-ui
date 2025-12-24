import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ExternalFeedbackService } from '../../src/services/external-feedback.service.js';
import { externalTraceService } from '../../src/services/external-trace.service.js';
import { getLangfuseClient } from '../../src/services/langfuse.service.js';

// Mock dependencies
vi.mock('../../src/services/langfuse.service.js');
vi.mock('../../src/services/external-trace.service.js');
vi.mock('../../src/services/logger.service.js');

describe('ExternalFeedbackService', () => {
    let service: ExternalFeedbackService;
    let mockLangfuseClient: any;

    beforeEach(() => {
        service = new ExternalFeedbackService();

        mockLangfuseClient = {
            score: vi.fn(),
            flushAsync: vi.fn().mockResolvedValue(undefined)
        };
        (getLangfuseClient as any).mockReturnValue(mockLangfuseClient);

        // Clear all mocks before each test
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('collectFeedback', () => {
        const validParams = {
            email: 'test@example.com',
            ipAddress: '127.0.0.1',
            traceId: 'trace-123',
            value: 1,
            comment: 'Great job!',
            name: 'user-satisfaction'
        };

        it('should successfully collect feedback when email is valid', async () => {
            // Mock email validation to return true
            (externalTraceService.validateEmailWithCache as any).mockResolvedValue(true);

            const result = await service.collectFeedback(validParams);

            expect(result.success).toBe(true);
            expect(externalTraceService.validateEmailWithCache).toHaveBeenCalledWith(
                validParams.email,
                validParams.ipAddress
            );
            expect(mockLangfuseClient.score).toHaveBeenCalledWith({
                traceId: validParams.traceId,
                name: validParams.name,
                value: validParams.value,
                comment: validParams.comment
            });
            expect(mockLangfuseClient.flushAsync).toHaveBeenCalled();
        });

        it('should use default name if not provided', async () => {
            (externalTraceService.validateEmailWithCache as any).mockResolvedValue(true);

            const paramsWithoutName = { ...validParams, name: undefined };
            await service.collectFeedback(paramsWithoutName);

            expect(mockLangfuseClient.score).toHaveBeenCalledWith(expect.objectContaining({
                name: 'user-feedback'
            }));
        });

        it('should reject feedback when email is invalid', async () => {
            // Mock email validation to return false
            (externalTraceService.validateEmailWithCache as any).mockResolvedValue(false);

            const result = await service.collectFeedback(validParams);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid email');
            expect(mockLangfuseClient.score).not.toHaveBeenCalled();
        });

        it('should handle errors during scoring', async () => {
            (externalTraceService.validateEmailWithCache as any).mockResolvedValue(true);
            mockLangfuseClient.score.mockImplementation(() => {
                throw new Error('Langfuse error');
            });

            const result = await service.collectFeedback(validParams);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to process feedback data');
        });
    });
});
