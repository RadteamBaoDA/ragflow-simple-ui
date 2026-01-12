
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExternalTraceService } from '@/services/external/trace.service';
import { langfuseClient } from '@/models/external/langfuse';

// Mock dependencies
vi.mock('@/models/external/langfuse', () => ({
    langfuseClient: {
        score: vi.fn(),
        flushAsync: vi.fn().mockResolvedValue(undefined),
    },
}));

vi.mock('@/models/factory', () => ({
    ModelFactory: {},
}));

vi.mock('@/config/index', () => ({
    config: {
        redis: { url: 'redis://localhost:6379' },
        externalTrace: { cacheTtlSeconds: 60, lockTimeoutMs: 1000 },
    },
}));

vi.mock('@/services/logger.service', () => ({
    log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('redis', () => ({
    createClient: vi.fn(() => ({
        on: vi.fn(),
        connect: vi.fn(),
        isOpen: false,
        quit: vi.fn(),
    }))
}));

describe('ExternalTraceService', () => {
    let service: ExternalTraceService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new ExternalTraceService();
    });

    describe('processFeedback', () => {
        it('should use deterministic ID for feedback to allow updates', async () => {
            const params = {
                traceId: 'trace-123',
                value: 1,
                comment: 'Good',
            };

            await service.processFeedback(params);

            expect(langfuseClient.score).toHaveBeenCalledWith(expect.objectContaining({
                traceId: 'trace-123',
                value: 1,
                comment: 'Good',
                // We expect the ID to be deterministic, e.g., "trace-123-user-feedback"
                id: 'trace-123-user-feedback',
                name: 'user-feedback',
            }));
        });

        it('should update existing feedback when called again', async () => {
            const params1 = { traceId: 'trace-123', value: 1 };
            await service.processFeedback(params1);

            const params2 = { traceId: 'trace-123', value: 0 };
            await service.processFeedback(params2);

            expect(langfuseClient.score).toHaveBeenCalledTimes(2);

            // Both calls should use the same ID
            const call1Args = vi.mocked(langfuseClient.score).mock.calls[0][0];
            const call2Args = vi.mocked(langfuseClient.score).mock.calls[1][0];

            expect(call1Args.id).toBeDefined();
            expect(call1Args.id).toBe(call2Args.id);
        });
    });
});
