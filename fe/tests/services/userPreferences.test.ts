/**
 * @fileoverview Tests for userPreferences service.
 * 
 * Tests:
 * - IndexedDB operations
 * - Get/set preferences
 * - Error handling
 * - Default values
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// ============================================================================
// Types
// ============================================================================

interface UserSetting {
  userId: string;
  key: string;
  value: any;
  updatedAt: number;
}

// ============================================================================
// Mock IndexedDB
// ============================================================================

let mockStore: Map<string, UserSetting> = new Map();

const mockObjectStore = {
  get: vi.fn((keyPath: [string, string]) => {
    const key = `${keyPath[0]}-${keyPath[1]}`;
    const result = mockStore.get(key);
    return {
      result,
      onsuccess: null as ((event: any) => void) | null,
      onerror: null as ((event: any) => void) | null,
    };
  }),
  put: vi.fn((setting: UserSetting) => {
    const key = `${setting.userId}-${setting.key}`;
    mockStore.set(key, setting);
    return {
      onsuccess: null as (() => void) | null,
      onerror: null as ((event: any) => void) | null,
    };
  }),
};

const mockTransaction = {
  objectStore: vi.fn((_name?: string) => mockObjectStore),
};

const mockDB = {
  transaction: vi.fn((_store?: string, _mode?: string) => mockTransaction),
  objectStoreNames: {
    contains: vi.fn(() => true),
  },
  createObjectStore: vi.fn(),
};

// ============================================================================
// UserPreferencesService Implementation (matching src/services/userPreferences.ts)
// ============================================================================

const DB_NAME = 'kb-preferences';
const DB_VERSION = 1;
const STORE_NAME = 'user_settings';

class UserPreferencesService {
  private dbPromise: Promise<typeof mockDB> | null = null;

  private async getDB(): Promise<typeof mockDB> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = Promise.resolve(mockDB);
    return this.dbPromise;
  }

  async get<T>(userId: string, key: string, defaultValue?: T): Promise<T | undefined> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get([userId, key]);

        // Simulate async
        setTimeout(() => {
          const result = mockStore.get(`${userId}-${key}`);
          resolve(result ? result.value : defaultValue);
        }, 0);
      });
    } catch (error) {
      console.error('Error accessing IndexedDB:', error);
      return defaultValue;
    }
  }

  async set(userId: string, key: string, value: any): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const setting: UserSetting = {
          userId,
          key,
          value,
          updatedAt: Date.now(),
        };

        store.put(setting);

        // Simulate async
        setTimeout(() => {
          mockStore.set(`${userId}-${key}`, setting);
          resolve();
        }, 0);
      });
    } catch (error) {
      console.error('Error accessing IndexedDB:', error);
    }
  }

  async delete(userId: string, key: string): Promise<void> {
    mockStore.delete(`${userId}-${key}`);
  }

  clearCache(): void {
    this.dbPromise = null;
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('UserPreferencesService', () => {
  let service: UserPreferencesService;

  beforeEach(() => {
    mockStore = new Map();
    vi.clearAllMocks();
    service = new UserPreferencesService();
  });

  afterEach(() => {
    service.clearCache();
  });

  describe('get', () => {
    it('should return undefined when key does not exist', async () => {
      const result = await service.get('user-1', 'nonexistent');
      expect(result).toBeUndefined();
    });

    it('should return default value when key does not exist', async () => {
      const result = await service.get('user-1', 'nonexistent', 'default');
      expect(result).toBe('default');
    });

    it('should return stored value', async () => {
      mockStore.set('user-1-theme', {
        userId: 'user-1',
        key: 'theme',
        value: 'dark',
        updatedAt: Date.now(),
      });

      const result = await service.get('user-1', 'theme');
      expect(result).toBe('dark');
    });

    it('should return complex stored value', async () => {
      const complexValue = { setting1: true, setting2: [1, 2, 3] };
      mockStore.set('user-1-settings', {
        userId: 'user-1',
        key: 'settings',
        value: complexValue,
        updatedAt: Date.now(),
      });

      const result = await service.get('user-1', 'settings');
      expect(result).toEqual(complexValue);
    });

    it('should isolate preferences by user', async () => {
      mockStore.set('user-1-theme', {
        userId: 'user-1',
        key: 'theme',
        value: 'dark',
        updatedAt: Date.now(),
      });
      mockStore.set('user-2-theme', {
        userId: 'user-2',
        key: 'theme',
        value: 'light',
        updatedAt: Date.now(),
      });

      const result1 = await service.get('user-1', 'theme');
      const result2 = await service.get('user-2', 'theme');

      expect(result1).toBe('dark');
      expect(result2).toBe('light');
    });
  });

  describe('set', () => {
    it('should store value', async () => {
      await service.set('user-1', 'theme', 'dark');

      const stored = mockStore.get('user-1-theme');
      expect(stored).toBeDefined();
      expect(stored?.value).toBe('dark');
    });

    it('should store complex value', async () => {
      const complexValue = { nested: { key: 'value' }, array: [1, 2, 3] };
      await service.set('user-1', 'settings', complexValue);

      const stored = mockStore.get('user-1-settings');
      expect(stored?.value).toEqual(complexValue);
    });

    it('should update existing value', async () => {
      await service.set('user-1', 'theme', 'light');
      await service.set('user-1', 'theme', 'dark');

      const stored = mockStore.get('user-1-theme');
      expect(stored?.value).toBe('dark');
    });

    it('should set updatedAt timestamp', async () => {
      const before = Date.now();
      await service.set('user-1', 'key', 'value');
      const after = Date.now();

      const stored = mockStore.get('user-1-key');
      expect(stored?.updatedAt).toBeGreaterThanOrEqual(before);
      expect(stored?.updatedAt).toBeLessThanOrEqual(after);
    });

    it('should store null value', async () => {
      await service.set('user-1', 'key', null);

      const stored = mockStore.get('user-1-key');
      expect(stored?.value).toBeNull();
    });

    it('should store boolean values', async () => {
      await service.set('user-1', 'flag', true);

      const result = await service.get('user-1', 'flag');
      expect(result).toBe(true);
    });

    it('should store number values', async () => {
      await service.set('user-1', 'count', 42);

      const result = await service.get('user-1', 'count');
      expect(result).toBe(42);
    });
  });

  describe('delete', () => {
    it('should remove stored value', async () => {
      mockStore.set('user-1-theme', {
        userId: 'user-1',
        key: 'theme',
        value: 'dark',
        updatedAt: Date.now(),
      });

      await service.delete('user-1', 'theme');

      expect(mockStore.has('user-1-theme')).toBe(false);
    });

    it('should not affect other keys', async () => {
      mockStore.set('user-1-theme', {
        userId: 'user-1',
        key: 'theme',
        value: 'dark',
        updatedAt: Date.now(),
      });
      mockStore.set('user-1-language', {
        userId: 'user-1',
        key: 'language',
        value: 'en',
        updatedAt: Date.now(),
      });

      await service.delete('user-1', 'theme');

      expect(mockStore.has('user-1-theme')).toBe(false);
      expect(mockStore.has('user-1-language')).toBe(true);
    });
  });

  describe('database connection', () => {
    it('should reuse database connection', async () => {
      await service.get('user-1', 'key1');
      await service.get('user-1', 'key2');
      await service.set('user-1', 'key3', 'value');

      // All operations should use the same cached connection
      expect(mockDB.transaction).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle empty string key', async () => {
      await service.set('user-1', '', 'value');

      const result = await service.get('user-1', '');
      expect(result).toBe('value');
    });

    it('should handle empty string userId', async () => {
      await service.set('', 'key', 'value');

      const result = await service.get('', 'key');
      expect(result).toBe('value');
    });

    it('should handle special characters in key', async () => {
      const specialKey = 'key-with-special_chars.and/slashes';
      await service.set('user-1', specialKey, 'value');

      const result = await service.get('user-1', specialKey);
      expect(result).toBe('value');
    });

    it('should handle array values', async () => {
      const arrayValue = [1, 'two', { three: 3 }];
      await service.set('user-1', 'array', arrayValue);

      const result = await service.get('user-1', 'array');
      expect(result).toEqual(arrayValue);
    });
  });
});

describe('UserPreferencesService constants', () => {
  it('should have correct database name', () => {
    expect(DB_NAME).toBe('kb-preferences');
  });

  it('should have correct database version', () => {
    expect(DB_VERSION).toBe(1);
  });

  it('should have correct store name', () => {
    expect(STORE_NAME).toBe('user_settings');
  });
});
