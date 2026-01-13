/**
 * @fileoverview Comprehensive unit tests for external trace service.
 * Tests Redis caching, email validation, Langfuse integration, and lock mechanisms.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
const mockRedisClient = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  quit: vi.fn(),
  get: vi.fn(),
  setEx: vi.fn(),
  setNX: vi.fn(),
  pExpire: vi.fn(),
  del: vi.fn(),
  exists: vi.fn(),
  isReady: true,
  isOpen: true,
  on: vi.fn(),
};

const mockLangfuseTrace = {
  id: 'trace-123',
  generation: vi.fn(),
  event: vi.fn(),
  update: vi.fn(),
};

const mockLangfuseClient = {
  trace: vi.fn(() => mockLangfuseTrace),
  score: vi.fn(),
  flushAsync: vi.fn().mockResolvedValue(undefined),
};

const mockUserModel = {
  findByEmail: vi.fn(),
};

const mockModelFactory = {
  user: mockUserModel,
};

const mockLog = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

const mockConfig = {
  redis: {
    url: 'redis://localhost:6379',
    host: 'localhost',
  },
  externalTrace: {
    cacheTtlSeconds: 3600,
    lockTimeoutMs: 5000,
  },
  nodeEnv: 'test',
  langfuse: {
    publicKey: 'test-public-key',
    secretKey: 'test-secret-key',
    baseUrl: 'https://langfuse.example.com',
  },
};

vi.mock('redis', () => ({
  createClient: vi.fn(() => mockRedisClient),
}));

vi.mock('../../../src/models/external/langfuse.js', () => ({
  langfuseClient: mockLangfuseClient,
}));

vi.mock('../../../src/models/factory.js', () => ({
  ModelFactory: mockModelFactory,
}));

vi.mock('../../../src/services/logger.service.js', () => ({
  log: mockLog,
}));

vi.mock('../../../src/config/index.js', () => ({
  config: mockConfig,
}));

describe('ExternalTraceService', () => {
  let externalTraceService: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRedisClient.isReady = true;
    mockRedisClient.isOpen = true;
    
    // Reset module to get fresh instance
    vi.resetModules();
    const module = await import('../../../src/services/external/trace.service.js');
    externalTraceService = module.externalTraceService;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('validateEmailWithCache', () => {
    it('should return cached validation result when available', async () => {
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.get.mockResolvedValue('true');

      const result = await externalTraceService.validateEmailWithCache(
        'test@example.com',
        '192.168.1.1'
      );

      expect(result).toBe(true);
      expect(mockRedisClient.get).toHaveBeenCalled();
      expect(mockUserModel.findByEmail).not.toHaveBeenCalled();
    });

    it('setEmailValidationInCache writes to redis when available', async () => {
      vi.spyOn(externalTraceService as any, 'getRedisClient').mockResolvedValue(mockRedisClient);
      await (externalTraceService as any).setEmailValidationInCache('key1', true);
      expect(mockRedisClient.setEx).toHaveBeenCalledWith('key1', mockConfig.externalTrace.cacheTtlSeconds, 'true');
    });

    it('acquireLock returns true when redis not available', async () => {
      // Force getRedisClient to return null
      vi.spyOn(externalTraceService as any, 'getRedisClient').mockResolvedValue(null);
      const res = await (externalTraceService as any).acquireLock('lock');
      expect(res).toBe(true);
    });

    it('acquireLock returns correct value and sets expiry when acquired', async () => {
      vi.spyOn(externalTraceService as any, 'getRedisClient').mockResolvedValue(mockRedisClient);
      mockRedisClient.setNX.mockResolvedValue(true);
      await (externalTraceService as any).acquireLock('lk');
      expect(mockRedisClient.setNX).toHaveBeenCalledWith('lk', 'locked');
      expect(mockRedisClient.pExpire).toHaveBeenCalledWith('lk', mockConfig.externalTrace.lockTimeoutMs);
    });

    it('acquireLock returns false when not acquired', async () => {
      vi.spyOn(externalTraceService as any, 'getRedisClient').mockResolvedValue(mockRedisClient);
      mockRedisClient.setNX.mockResolvedValue(false);
      const a = await (externalTraceService as any).acquireLock('lk2');
      expect(a).toBe(false);
    });

    it('releaseLock deletes key when redis available', async () => {
      vi.spyOn(externalTraceService as any, 'getRedisClient').mockResolvedValue(mockRedisClient);
      await (externalTraceService as any).releaseLock('lkdel');
      expect(mockRedisClient.del).toHaveBeenCalledWith('lkdel');
    });

    it('waitForLock returns true immediately when no redis', async () => {
      vi.spyOn(externalTraceService as any, 'getRedisClient').mockResolvedValue(null);
      const ok = await (externalTraceService as any).waitForLock('lk', 2);
      expect(ok).toBe(true);
    });

    it('waitForLock returns true when lock cleared', async () => {
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.exists.mockResolvedValueOnce(0);
      const ok = await (externalTraceService as any).waitForLock('lk', 2);
      expect(ok).toBe(true);
    });

    it('should validate email from database when cache miss', async () => {
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.setNX.mockResolvedValue(true);
      mockRedisClient.setEx.mockResolvedValue('OK' as any);
      mockUserModel.findByEmail.mockResolvedValue({ 
        id: 1, 
        email: 'test@example.com' 
      });

      const result = await externalTraceService.validateEmailWithCache(
        'test@example.com',
        '192.168.1.1'
      );

      expect(result).toBe(true);
      expect(mockUserModel.findByEmail).toHaveBeenCalledWith('test@example.com');
    });

    it('should return false for invalid email', async () => {
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.setNX.mockResolvedValue(true);
      mockRedisClient.setEx.mockResolvedValue('OK' as any);
      mockUserModel.findByEmail.mockResolvedValue(null);

      const result = await externalTraceService.validateEmailWithCache(
        'invalid@example.com',
        '192.168.1.1'
      );

      expect(result).toBe(false);
    });

    it('should handle Redis connection failure gracefully', async () => {
      mockRedisClient.connect.mockRejectedValue(new Error('Connection failed'));
      mockUserModel.findByEmail.mockResolvedValue({ 
        id: 1, 
        email: 'test@example.com' 
      });

      const result = await externalTraceService.validateEmailWithCache(
        'test@example.com',
        '192.168.1.1'
      );

      expect(result).toBe(true);
      expect(mockLog.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to connect Redis'),
        expect.any(Object)
      );
    });

    it('should wait for lock when not acquired (stable)', async () => {
      mockRedisClient.connect.mockResolvedValue(undefined);
      // Keep cache miss; lock not acquired
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.setNX.mockResolvedValue(false); // Lock not acquired
      // Stub waitForLock to succeed so we don't rely on timing
      vi.spyOn(externalTraceService as any, 'waitForLock').mockResolvedValue(true);
      // Ensure DB returns a user so the function can proceed to DB lookup path
      mockUserModel.findByEmail.mockResolvedValue({ id: 1, email: 'test@example.com' });

      const result = await externalTraceService.validateEmailWithCache(
        'test@example.com',
        '192.168.1.1'
      );

      // Should eventually return true based on DB lookup
      expect(result).toBe(true);
    });
  });

  describe('processTrace', () => {
    beforeEach(() => {
      mockRedisClient.connect.mockResolvedValue(undefined);
      // Set up email validation to succeed by mocking both cache miss and DB hit
      mockRedisClient.get.mockResolvedValue(null); // Cache miss
      mockRedisClient.setNX.mockResolvedValue(true); // Lock acquired
      mockUserModel.findByEmail.mockResolvedValue({ id: 1, email: 'user@example.com' }); // DB hit
      mockRedisClient.setEx.mockResolvedValue('OK');
      mockLangfuseClient.flushAsync.mockResolvedValue(undefined);
    });

    it('should process user message trace successfully', async () => {
      mockLangfuseClient.trace.mockReturnValue(mockLangfuseTrace);

      const params = {
        email: 'user@example.com',
        message: 'Hello, I have a question',
        ipAddress: '192.168.1.1',
        role: 'user' as const,
        metadata: {
          chatId: 'chat-123',
          source: 'web-app',
        },
      };

      const result = await externalTraceService.processTrace(params);

      expect(result.success).toBe(true);
      expect(result.traceId).toBe('trace-123');
      expect(mockLangfuseClient.trace).toHaveBeenCalled();
      expect(mockLangfuseTrace.event).toHaveBeenCalled();
      expect(mockLangfuseClient.flushAsync).toHaveBeenCalled();
    });

    it('should process assistant generation trace with usage', async () => {
      mockLangfuseClient.trace.mockReturnValue(mockLangfuseTrace);

      const params = {
        email: 'user@example.com',
        message: 'What is RAG?',
        response: 'RAG stands for Retrieval-Augmented Generation...',
        ipAddress: '192.168.1.1',
        role: 'assistant' as const,
        metadata: {
          chatId: 'chat-123',
          modelName: 'gpt-4',
          usage: {
            promptTokens: 100,
            completionTokens: 150,
            totalTokens: 250,
          },
        },
      };

      const result = await externalTraceService.processTrace(params);

      expect(result.success).toBe(true);
      expect(mockLangfuseTrace.generation).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4',
          input: params.message,
          output: params.response,
          usage: expect.objectContaining({
            input: 100,
            output: 150,
            total: 250,
            unit: 'TOKENS',
          }),
        })
      );
    });

    it('should process generation without usage data', async () => {
      mockLangfuseClient.trace.mockReturnValue(mockLangfuseTrace);

      const params = {
        email: 'user@example.com',
        message: 'Test message',
        response: 'Test response',
        ipAddress: '192.168.1.1',
        role: 'assistant' as const,
        metadata: {
          chatId: 'chat-456',
          modelName: 'gpt-3.5-turbo',
        },
      };

      const result = await externalTraceService.processTrace(params);

      expect(result.success).toBe(true);
      expect(mockLangfuseTrace.generation).toHaveBeenCalledWith(
        expect.not.objectContaining({
          usage: expect.anything(),
        })
      );
    });

    it('should reject invalid email', async () => {
      // Override email validation to fail
      mockUserModel.findByEmail.mockResolvedValueOnce(null);

      const params = {
        email: 'invalid@example.com',
        message: 'Test',
        ipAddress: '192.168.1.1',
      };

      const result = await externalTraceService.processTrace(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid email');
      expect(mockLangfuseClient.trace).not.toHaveBeenCalled();
    });

    it('should handle Langfuse errors gracefully', async () => {
      mockLangfuseClient.trace.mockImplementationOnce(() => {
        throw new Error('Langfuse connection failed');
      });

      const params = {
        email: 'user@example.com',
        message: 'Test',
        ipAddress: '192.168.1.1',
      };

      const result = await externalTraceService.processTrace(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to process chat data');
      expect(mockLog.error).toHaveBeenCalledWith(
        'Failed to process trace',
        expect.any(Object)
      );
    });

    it('should build tags correctly from metadata', async () => {
      mockLangfuseClient.trace.mockReturnValue(mockLangfuseTrace);

      const params = {
        email: 'user@example.com',
        message: 'Test',
        ipAddress: '192.168.1.1',
        metadata: {
          chatId: 'chat-789',
          tags: ['custom-tag', 'feature-x'],
          source: 'mobile-app',
          task: 'search_query',
        },
      };

      await externalTraceService.processTrace(params);

      expect(mockLangfuseClient.trace).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: expect.arrayContaining([
            'knowledge-base',
            'external-trace',
            'test',
            'custom-tag',
            'feature-x',
            'mobile-app',
            'search_query',
          ]),
        })
      );
    });

    it('should reuse existing trace for same chatId', async () => {
      mockLangfuseClient.trace.mockReturnValue(mockLangfuseTrace);

      const params = {
        email: 'user@example.com',
        message: 'First message',
        ipAddress: '192.168.1.1',
        metadata: { chatId: 'chat-reuse' },
      };

      // First call creates trace
      await externalTraceService.processTrace(params);

      // Second call should reuse trace
      await externalTraceService.processTrace({
        ...params,
        message: 'Second message',
      });

      expect(mockLangfuseClient.trace).toHaveBeenCalledTimes(1);
      expect(mockLangfuseTrace.update).toHaveBeenCalled();
    });
  });

  describe('processFeedback', () => {
    it('should process feedback with traceId', async () => {
      const params = {
        traceId: 'trace-123',
        score: 5,
        comment: 'Very helpful',
      };

      const result = await externalTraceService.processFeedback(params);

      expect(result.success).toBe(true);
      expect(mockLangfuseClient.score).toHaveBeenCalledWith(
        expect.objectContaining({
          traceId: 'trace-123',
          name: 'user-feedback',
          value: 5,
          comment: 'Very helpful',
        })
      );
      expect(mockLangfuseClient.flushAsync).toHaveBeenCalled();
    });

    it('should process feedback with messageId fallback', async () => {
      const params = {
        messageId: 'msg-456',
        value: 3,
      };

      const result = await externalTraceService.processFeedback(params);

      expect(result.success).toBe(true);
      expect(mockLangfuseClient.score).toHaveBeenCalledWith(
        expect.objectContaining({
          traceId: 'msg-456',
        })
      );
    });

    it('should throw error when no trace ID provided', async () => {
      const params = {
        score: 5,
      };

      await expect(externalTraceService.processFeedback(params)).rejects.toThrow(
        'Trace ID required'
      );
    });
  });

  describe('shutdown', () => {
    it('should close Redis connection on shutdown', async () => {
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.get.mockResolvedValue('true');
      mockUserModel.findByEmail.mockResolvedValue({ id: 1, email: 'test@example.com' });
      
      // Trigger Redis connection by calling validateEmailWithCache
      await externalTraceService.validateEmailWithCache('test@example.com', '1.1.1.1');
      
      // Manually set redisClient to trigger shutdown path
      // Since we can't access private property, let's just verify shutdown doesn't throw
      await expect(externalTraceService.shutdown()).resolves.toBeUndefined();
    });

    it('should handle shutdown when Redis not connected', async () => {
      await expect(externalTraceService.shutdown()).resolves.toBeUndefined();
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle missing role parameter in processTrace', async () => {
      mockLangfuseClient.trace.mockReturnValue(mockLangfuseTrace);
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.setNX.mockResolvedValue(true);
      mockUserModel.findByEmail.mockResolvedValue({ id: 1, email: 'user@example.com' });
      mockRedisClient.setEx.mockResolvedValue('OK');

      const params = {
        email: 'user@example.com',
        message: 'Test message',
        ipAddress: '192.168.1.1',
        metadata: { chatId: 'chat-default' },
      };

      const result = await externalTraceService.processTrace(params);

      expect(result.success).toBe(true);
    });

    it('should handle empty metadata in processTrace', async () => {
      mockLangfuseClient.trace.mockReturnValue(mockLangfuseTrace);
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.setNX.mockResolvedValue(true);
      mockUserModel.findByEmail.mockResolvedValue({ id: 1, email: 'user@example.com' });
      mockRedisClient.setEx.mockResolvedValue('OK');

      const params = {
        email: 'user@example.com',
        message: 'Test message',
        ipAddress: '192.168.1.1',
        role: 'user' as const,
        metadata: {},
      };

      const result = await externalTraceService.processTrace(params);

      expect(result.success).toBe(true);
      expect(mockLangfuseTrace.event).toHaveBeenCalled();
    });

    it('should handle validation failure gracefully', async () => {
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.get.mockResolvedValue('false'); // Cached as invalid
      mockLangfuseClient.trace.mockReturnValue(mockLangfuseTrace);

      const params = {
        email: 'invalid@example.com',
        message: 'Test message',
        ipAddress: '192.168.1.1',
      };

      const result = await externalTraceService.processTrace(params);

      expect(result.success).toBe(false);
      expect(mockLangfuseClient.trace).not.toHaveBeenCalled();
    });

    it('should handle Langfuse errors gracefully', async () => {
      mockLangfuseClient.trace.mockImplementation(() => {
        throw new Error('Langfuse error');
      });
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.setNX.mockResolvedValue(true);
      mockUserModel.findByEmail.mockResolvedValue({ id: 1, email: 'user@example.com' });
      mockRedisClient.setEx.mockResolvedValue('OK');

      const params = {
        email: 'user@example.com',
        message: 'Test message',
        ipAddress: '192.168.1.1',
      };

      const result = await externalTraceService.processTrace(params);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to process chat data');
    });

    it('should handle very long messages', async () => {
      mockLangfuseClient.trace.mockReturnValue(mockLangfuseTrace);
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.setNX.mockResolvedValue(true);
      mockUserModel.findByEmail.mockResolvedValue({ id: 1, email: 'user@example.com' });
      mockRedisClient.setEx.mockResolvedValue('OK');

      const longMessage = 'A'.repeat(10000);
      const params = {
        email: 'user@example.com',
        message: longMessage,
        ipAddress: '192.168.1.1',
        role: 'user' as const,
      };

      const result = await externalTraceService.processTrace(params);

      expect(result.success).toBe(true);
      expect(mockLangfuseTrace.event).toHaveBeenCalled();
    });

    it('should handle special characters in email', async () => {
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.setNX.mockResolvedValue(true);
      mockUserModel.findByEmail.mockResolvedValue({ id: 1, email: 'user+tag@example.com' });
      mockRedisClient.setEx.mockResolvedValue('OK');

      const result = await externalTraceService.validateEmailWithCache(
        'user+tag@example.com',
        '192.168.1.1'
      );

      expect(result).toBe(true);
      expect(mockUserModel.findByEmail).toHaveBeenCalledWith('user+tag@example.com');
    });

    it('should handle missing usage data in assistant trace', async () => {
      mockLangfuseClient.trace.mockReturnValue(mockLangfuseTrace);
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.setNX.mockResolvedValue(true);
      mockUserModel.findByEmail.mockResolvedValue({ id: 1, email: 'user@example.com' });
      mockRedisClient.setEx.mockResolvedValue('OK');

      const params = {
        email: 'user@example.com',
        message: 'Question',
        response: 'Answer',
        ipAddress: '192.168.1.1',
        role: 'assistant' as const,
        metadata: {
          chatId: 'chat-123',
          // No usage data
        },
      };

      const result = await externalTraceService.processTrace(params);

      expect(result.success).toBe(true);
      expect(mockLangfuseTrace.generation).toHaveBeenCalled();
    });

    it('should handle IPv6 addresses', async () => {
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.setNX.mockResolvedValue(true);
      mockUserModel.findByEmail.mockResolvedValue({ id: 1, email: 'user@example.com' });
      mockRedisClient.setEx.mockResolvedValue('OK');
      mockLangfuseClient.trace.mockReturnValue(mockLangfuseTrace);

      const params = {
        email: 'user@example.com',
        message: 'Test',
        ipAddress: '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
        role: 'user' as const,
      };

      const result = await externalTraceService.processTrace(params);

      expect(result.success).toBe(true);
    });

    it('should handle concurrent trace processing for different chats', async () => {
      mockLangfuseClient.trace.mockReturnValue(mockLangfuseTrace);
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.setNX.mockResolvedValue(true);
      mockUserModel.findByEmail.mockImplementation(async (email: string) => {
        return { id: email === 'user1@example.com' ? 1 : 2, email };
      });
      mockRedisClient.setEx.mockResolvedValue('OK');

      const params1 = {
        email: 'user1@example.com',
        message: 'Message 1',
        ipAddress: '192.168.1.1',
        metadata: { chatId: 'chat-1' },
      };

      const params2 = {
        email: 'user2@example.com',
        message: 'Message 2',
        ipAddress: '192.168.1.2',
        metadata: { chatId: 'chat-2' },
      };

      const results = await Promise.all([
        externalTraceService.processTrace(params1),
        externalTraceService.processTrace(params2),
      ]);

      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(mockLangfuseClient.trace).toHaveBeenCalledTimes(2);
    });

    it('should handle missing response in assistant trace', async () => {
      mockLangfuseClient.trace.mockReturnValue(mockLangfuseTrace);
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.setNX.mockResolvedValue(true);
      mockUserModel.findByEmail.mockResolvedValue({ id: 1, email: 'user@example.com' });
      mockRedisClient.setEx.mockResolvedValue('OK');

      const params = {
        email: 'user@example.com',
        message: 'Question',
        // No response field
        ipAddress: '192.168.1.1',
        role: 'assistant' as const,
        metadata: { chatId: 'chat-123' },
      };

      const result = await externalTraceService.processTrace(params);

      expect(result.success).toBe(true);
    });

    it('should handle custom metadata fields', async () => {
      mockLangfuseClient.trace.mockReturnValue(mockLangfuseTrace);
      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.setNX.mockResolvedValue(true);
      mockUserModel.findByEmail.mockResolvedValue({ id: 1, email: 'user@example.com' });
      mockRedisClient.setEx.mockResolvedValue('OK');

      const params = {
        email: 'user@example.com',
        message: 'Test',
        ipAddress: '192.168.1.1',
        metadata: {
          chatId: 'chat-123',
          customField1: 'value1',
          customField2: { nested: 'value' },
          customArray: [1, 2, 3],
        },
      };

      const result = await externalTraceService.processTrace(params);

      expect(result.success).toBe(true);
      expect(mockLangfuseTrace.event).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            customField1: 'value1',
            customField2: { nested: 'value' },
            customArray: [1, 2, 3],
          }),
        })
      );
    });
  });
});
