/**
 * @fileoverview Unit tests for logger service.
 * Tests Winston logger configuration and log methods.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock winston transports
const mockFileTransport = vi.fn();
const mockDailyRotateFileTransport = vi.fn();

vi.mock('winston', () => {
    const createLogger = vi.fn().mockReturnValue({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    });

    return {
        createLogger,
        format: {
            combine: vi.fn().mockReturnValue({}),
            timestamp: vi.fn().mockReturnValue({}),
            printf: vi.fn().mockReturnValue({}),
            colorize: vi.fn().mockReturnValue({}),
            json: vi.fn().mockReturnValue({}),
            errors: vi.fn().mockReturnValue({}),
        },
        transports: {
            Console: vi.fn().mockImplementation(() => ({})),
            File: mockFileTransport,
        },
    };
});

vi.mock('winston-daily-rotate-file', () => ({
    default: mockDailyRotateFileTransport,
}));

describe('LoggerService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('log object', () => {
        it('should export log object with standard methods', async () => {
            const { log } = await import('../../src/shared/services/logger.service.js');

            expect(log).toBeDefined();
            expect(typeof log.debug).toBe('function');
            expect(typeof log.info).toBe('function');
            expect(typeof log.warn).toBe('function');
            expect(typeof log.error).toBe('function');
        });

        it('should call debug method', async () => {
            const { log } = await import('../../src/shared/services/logger.service.js');

            log.debug('Test debug message', { key: 'value' });

            expect(log.debug).toHaveBeenCalledWith('Test debug message', { key: 'value' });
        });

        it('should call info method', async () => {
            const { log } = await import('../../src/shared/services/logger.service.js');

            log.info('Test info message');

            expect(log.info).toHaveBeenCalledWith('Test info message');
        });

        it('should call warn method', async () => {
            const { log } = await import('../../src/shared/services/logger.service.js');

            log.warn('Test warning', { context: 'test' });

            expect(log.warn).toHaveBeenCalledWith('Test warning', { context: 'test' });
        });

        it('should call error method', async () => {
            const { log } = await import('../../src/shared/services/logger.service.js');
            const error = new Error('Test error');

            log.error('Error occurred', { error: error.message });

            expect(log.error).toHaveBeenCalledWith('Error occurred', { error: 'Test error' });
        });
    });

    describe('Module structure', () => {
        it('should export log as named export', async () => {
            const loggerModule = await import('../../src/shared/services/logger.service.js');

            expect(loggerModule.log).toBeDefined();
        });

        it('should have all required log level methods', async () => {
            const { log } = await import('../../src/shared/services/logger.service.js');

            const requiredMethods = ['debug', 'info', 'warn', 'error'];

            requiredMethods.forEach((method) => {
                expect(typeof log[method as keyof typeof log]).toBe('function');
            });
        });
    });
});
