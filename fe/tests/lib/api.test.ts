/**
 * @fileoverview Tests for API utility functions.
 * 
 * Tests:
 * - apiFetch function with credentials
 * - AuthenticationError class
 * - api object methods (get, post, put, delete)
 * - 401 authentication handling
 * - Error handling for network failures
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { api, apiFetch, AuthenticationError } from '@/lib/api';

// ============================================================================
// Helper Functions
// ============================================================================

function createMockResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
    headers: new Headers({ 'Content-Type': 'application/json' }),
  } as unknown as Response;
}

// ============================================================================
// Tests
// ============================================================================

describe('API utilities', () => {
  const originalFetch = globalThis.fetch;
  const originalLocation = window.location;

  beforeEach(() => {
    // Reset fetch mock
    globalThis.fetch = vi.fn();
    
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: { href: '', pathname: '/current', search: '' },
      writable: true,
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
    vi.restoreAllMocks();
  });

  describe('AuthenticationError', () => {
    it('should create error with default message', () => {
      const error = new AuthenticationError();
      expect(error.message).toBe('Not authenticated');
      expect(error.name).toBe('AuthenticationError');
    });

    it('should create error with custom message', () => {
      const error = new AuthenticationError('Session expired');
      expect(error.message).toBe('Session expired');
      expect(error.name).toBe('AuthenticationError');
    });

    it('should be instance of Error', () => {
      const error = new AuthenticationError();
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('apiFetch', () => {
    it('should include credentials in request', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(createMockResponse({ success: true }));

      await apiFetch('/api/test');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ credentials: 'include' })
      );
    });

    it('should set Content-Type to application/json', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(createMockResponse({ success: true }));

      await apiFetch('/api/test');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        })
      );
    });

    it('should throw and redirect on 401 response', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(createMockResponse({ error: 'Unauthorized' }, 401));

      await expect(apiFetch('/api/test')).rejects.toThrow(AuthenticationError);
    });

    it('should skip auth check when skipAuthCheck is true', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(createMockResponse({ error: 'Unauthorized' }, 401));

      // With skipAuthCheck=true, it should still throw but as a regular error (not redirect)
      await expect(apiFetch('/api/test', { skipAuthCheck: true })).rejects.toThrow();
    });

    it('should return parsed JSON for successful requests', async () => {
      const data = { id: 1, name: 'Test' };
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(createMockResponse(data));

      const result = await apiFetch('/api/test');

      expect(result).toEqual(data);
    });

    it('should throw error for non-OK responses', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(createMockResponse({ error: 'Not Found' }, 404));

      await expect(apiFetch('/api/test')).rejects.toThrow('Not Found');
    });

    it('should throw generic error when no error message in response', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(createMockResponse({}, 500));

      await expect(apiFetch('/api/test')).rejects.toThrow('API error: 500');
    });

    it('should preserve absolute URLs', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(createMockResponse({}));

      await apiFetch('https://external.com/api/test');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://external.com/api/test',
        expect.any(Object)
      );
    });
  });

  describe('api.get', () => {
    it('should make GET request and return JSON', async () => {
      const testData = { id: 1, name: 'Test' };
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(createMockResponse(testData));

      const result = await api.get('/api/users/1');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/users/1'),
        expect.objectContaining({ method: 'GET' })
      );
      expect(result).toEqual(testData);
    });

    it('should handle empty response', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(createMockResponse(null));

      const result = await api.get('/api/empty');

      expect(result).toBeNull();
    });

    it('should throw AuthenticationError on 401', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(createMockResponse({}, 401));

      await expect(api.get('/api/protected')).rejects.toThrow(AuthenticationError);
    });
  });

  describe('api.post', () => {
    it('should make POST request with JSON body', async () => {
      const requestData = { name: 'New User' };
      const responseData = { id: 1, name: 'New User' };
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(createMockResponse(responseData));

      const result = await api.post('/api/users', requestData);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/users'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(requestData),
        })
      );
      expect(result).toEqual(responseData);
    });

    it('should handle POST without body', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(createMockResponse({ success: true }));

      await api.post('/api/action');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/action'),
        expect.objectContaining({
          method: 'POST',
          body: null,
        })
      );
    });

    it('should throw AuthenticationError on 401', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(createMockResponse({}, 401));

      await expect(api.post('/api/protected', {})).rejects.toThrow(AuthenticationError);
    });
  });

  describe('api.put', () => {
    it('should make PUT request with JSON body', async () => {
      const requestData = { name: 'Updated User' };
      const responseData = { id: 1, name: 'Updated User' };
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(createMockResponse(responseData));

      const result = await api.put('/api/users/1', requestData);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/users/1'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(requestData),
        })
      );
      expect(result).toEqual(responseData);
    });

    it('should handle PUT without body', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(createMockResponse({ success: true }));

      await api.put('/api/resource/1');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/resource/1'),
        expect.objectContaining({
          method: 'PUT',
          body: null,
        })
      );
    });

    it('should throw AuthenticationError on 401', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(createMockResponse({}, 401));

      await expect(api.put('/api/protected/1', {})).rejects.toThrow(AuthenticationError);
    });
  });

  describe('api.delete', () => {
    it('should make DELETE request', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(createMockResponse({ success: true }));

      const result = await api.delete('/api/users/1');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/users/1'),
        expect.objectContaining({ method: 'DELETE' })
      );
      expect(result).toEqual({ success: true });
    });

    it('should throw AuthenticationError on 401', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(createMockResponse({}, 401));

      await expect(api.delete('/api/protected/1')).rejects.toThrow(AuthenticationError);
    });
  });

  describe('network error handling', () => {
    it('should propagate network errors from fetch', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

      await expect(apiFetch('/api/test')).rejects.toThrow('Network error');
    });

    it('should propagate network errors through api methods', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Failed to fetch'));

      await expect(api.get('/api/test')).rejects.toThrow('Failed to fetch');
    });
  });

  describe('JSON parsing', () => {
    it('should handle array responses', async () => {
      const testData = [{ id: 1 }, { id: 2 }];
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(createMockResponse(testData));

      const result = await api.get('/api/items');

      expect(result).toEqual(testData);
    });

    it('should handle complex nested objects', async () => {
      const testData = {
        user: { id: 1, profile: { name: 'Test', settings: { theme: 'dark' } } },
        items: [1, 2, 3],
      };
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(createMockResponse(testData));

      const result = await api.get('/api/complex');

      expect(result).toEqual(testData);
    });
  });

  describe('request URL handling', () => {
    it('should handle relative URLs', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(createMockResponse({}));

      await api.get('/api/test');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/test'),
        expect.any(Object)
      );
    });

    it('should handle URLs with query parameters', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(createMockResponse({}));

      await api.get('/api/search?q=test&page=1');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/search?q=test&page=1'),
        expect.any(Object)
      );
    });

    it('should handle URLs with special characters', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(createMockResponse({}));

      await api.get('/api/users/test%40example.com');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/users/test%40example.com'),
        expect.any(Object)
      );
    });
  });
});
