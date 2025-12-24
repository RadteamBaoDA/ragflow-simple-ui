
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { queueService } from '../../src/services/queue.service.js';
import { ModelFactory } from '../../src/models/factory.js';

// Mock dependencies
vi.mock('@/config/index.js', () => ({
    config: {
        redis: {
            host: 'localhost',
            port: 6379,
            password: 'pass',
            db: 0,
            url: 'redis://:pass@localhost:6379/0'
        },
    }
}));

vi.mock('@/services/logger.service.js', () => ({
    log: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    }
}));

// Mock ModelFactory
const { mockChatHistoryCreate, mockSearchHistoryCreate } = vi.hoisted(() => ({
    mockChatHistoryCreate: vi.fn(),
    mockSearchHistoryCreate: vi.fn()
}));

vi.mock('../../src/models/factory.js', () => {
    return {
        ModelFactory: {
            externalChatHistory: {
                create: mockChatHistoryCreate
            },
            externalSearchHistory: {
                create: mockSearchHistoryCreate
            }
        }
    };
});

// Mock BeeQueue
const { mockProcess, mockCreateJob, mockSave, mockOn, mockClose } = vi.hoisted(() => ({
    mockProcess: vi.fn(),
    mockCreateJob: vi.fn(),
    mockSave: vi.fn(),
    mockOn: vi.fn(),
    mockClose: vi.fn()
}));

// Mock BeeQueue class directly
vi.mock('bee-queue', () => {
    return {
        default: class MockBeeQueue {
            constructor() {
                // Return proxy or this, but ensuring methods exist on instance
            }
            process = mockProcess;
            createJob = mockCreateJob.mockReturnThis();
            save = mockSave.mockResolvedValue({ id: 'job-123' });
            on = mockOn;
            close = mockClose.mockResolvedValue(undefined);
        }
    };
});


describe('Queue Service', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        mockChatHistoryCreate.mockResolvedValue({});
        mockSearchHistoryCreate.mockResolvedValue({});
        mockCreateJob.mockReturnThis();
        mockSave.mockResolvedValue({ id: 'job-123' });

        await queueService.initQueues();
    });

    describe('initQueues', () => {
        it('should initialize queues with redis config', async () => {
            // Check that queues are instantiated
            expect(mockProcess).toHaveBeenCalledTimes(2);
            expect(mockOn).toHaveBeenCalled();
        });
    });

    describe('addChatHistoryJob', () => {
        it('should add job to chat history queue', async () => {
            const jobData = {
                sessionId: 'session-1',
                messages: []
            };

            await queueService.addChatHistoryJob(jobData);

            expect(mockCreateJob).toHaveBeenCalledWith(jobData);
            expect(mockSave).toHaveBeenCalled();
        });
    });

    describe('Processors', () => {
        it('should process chat history job', async () => {
            expect(mockProcess).toHaveBeenCalled();
            const chatProcessor = mockProcess.mock.calls[0][0];

            const job = {
                id: 'job-1',
                data: {
                    sessionId: 'session-1',
                    userId: 'user-1',
                    messages: [{ prompt: 'p', response: 'r', citations: [] }]
                }
            };

            await chatProcessor(job);

            expect(mockChatHistoryCreate).toHaveBeenCalledWith({
                session_id: 'session-1',
                user_id: 'user-1',
                prompt: 'p',
                response: 'r',
                citations: '[]'
            });
        });

        it('should process search history job', async () => {
            expect(mockProcess).toHaveBeenCalled();
            const searchProcessor = mockProcess.mock.calls[1][0];

            const job = {
                id: 'job-2',
                data: {
                    sessionId: 'session-2',
                    userId: 'user-2',
                    query: 'q',
                    summary: 's',
                    results: []
                }
            };

            await searchProcessor(job);

            expect(mockSearchHistoryCreate).toHaveBeenCalledWith({
                session_id: 'session-2',
                user_id: 'user-2',
                query: 'q',
                summary: 's',
                results: '[]'
            });
        });
    });
});
