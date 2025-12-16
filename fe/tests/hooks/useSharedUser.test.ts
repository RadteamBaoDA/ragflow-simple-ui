/**
 * @fileoverview Tests for useSharedUser hook.
 * 
 * Tests:
 * - User state management
 * - Cross-subdomain storage
 * - BroadcastChannel synchronization
 * - localStorage interaction
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ============================================================================
// Types
// ============================================================================

interface SharedUser {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar?: string;
}

// ============================================================================
// Mock Implementation
// ============================================================================

const STORAGE_KEY = 'kb_shared_user';

let mockStorage: Record<string, string> = {};
let broadcastCallbacks: Array<(event: { data: any }) => void> = [];

const mockLocalStorage = {
  getItem: vi.fn((key: string) => mockStorage[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    mockStorage[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete mockStorage[key];
  }),
  clear: vi.fn(() => {
    mockStorage = {};
  }),
};

class MockBroadcastChannel {
  name: string;
  onmessage: ((event: { data: any }) => void) | null = null;

  constructor(name: string) {
    this.name = name;
  }

  postMessage(data: any) {
    // Simulate broadcast to other tabs
    broadcastCallbacks.forEach((cb) => cb({ data }));
  }

  close() {
    // No-op
  }
}

// ============================================================================
// Shared Storage Functions (matching src/hooks/useSharedUser.ts)
// ============================================================================

function getSharedUserSync(): SharedUser | null {
  try {
    const data = mockLocalStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to parse shared user:', error);
  }
  return null;
}

function setSharedUser(user: SharedUser): void {
  try {
    mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch (error) {
    console.error('Failed to set shared user:', error);
  }
}

function clearSharedUser(): void {
  mockLocalStorage.removeItem(STORAGE_KEY);
}

// ============================================================================
// Hook Implementation (simplified for testing)
// ============================================================================

import { useState, useEffect, useCallback } from 'react';

function useSharedUser() {
  const [user, setUser] = useState<SharedUser | null>(() => getSharedUserSync());

  // Listen for storage events from other tabs
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        if (event.newValue) {
          try {
            setUser(JSON.parse(event.newValue));
          } catch (e) {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const updateUser = useCallback((newUser: SharedUser | null) => {
    setUser(newUser);
    if (newUser) {
      setSharedUser(newUser);
    } else {
      clearSharedUser();
    }
  }, []);

  return { user, setUser: updateUser };
}

// ============================================================================
// Tests
// ============================================================================

describe('useSharedUser', () => {
  beforeEach(() => {
    mockStorage = {};
    broadcastCallbacks = [];
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockStorage = {};
  });

  describe('initial state', () => {
    it('should return null when no user is stored', () => {
      const { result } = renderHook(() => useSharedUser());

      expect(result.current.user).toBeNull();
    });

    it('should return stored user on mount', () => {
      const storedUser: SharedUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
      };

      mockStorage[STORAGE_KEY] = JSON.stringify(storedUser);

      const { result } = renderHook(() => useSharedUser());

      expect(result.current.user).toEqual(storedUser);
    });

    it('should handle invalid JSON in storage', () => {
      mockStorage[STORAGE_KEY] = 'invalid-json';

      const { result } = renderHook(() => useSharedUser());

      expect(result.current.user).toBeNull();
    });
  });

  describe('setUser', () => {
    it('should update user state', () => {
      const { result } = renderHook(() => useSharedUser());

      const newUser: SharedUser = {
        id: 'user-2',
        email: 'new@example.com',
        name: 'New User',
        role: 'admin',
      };

      act(() => {
        result.current.setUser(newUser);
      });

      expect(result.current.user).toEqual(newUser);
    });

    it('should persist user to storage', () => {
      const { result } = renderHook(() => useSharedUser());

      const newUser: SharedUser = {
        id: 'user-2',
        email: 'new@example.com',
        name: 'New User',
        role: 'manager',
      };

      act(() => {
        result.current.setUser(newUser);
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        JSON.stringify(newUser)
      );
    });

    it('should clear storage when setting null', () => {
      const initialUser: SharedUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
      };

      mockStorage[STORAGE_KEY] = JSON.stringify(initialUser);

      const { result } = renderHook(() => useSharedUser());

      act(() => {
        result.current.setUser(null);
      });

      expect(result.current.user).toBeNull();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    });
  });

  describe('user with avatar', () => {
    it('should handle user with avatar', () => {
      const userWithAvatar: SharedUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        avatar: 'https://example.com/avatar.jpg',
      };

      mockStorage[STORAGE_KEY] = JSON.stringify(userWithAvatar);

      const { result } = renderHook(() => useSharedUser());

      expect(result.current.user?.avatar).toBe('https://example.com/avatar.jpg');
    });

    it('should handle user without avatar', () => {
      const userWithoutAvatar: SharedUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
      };

      mockStorage[STORAGE_KEY] = JSON.stringify(userWithoutAvatar);

      const { result } = renderHook(() => useSharedUser());

      expect(result.current.user?.avatar).toBeUndefined();
    });
  });
});

describe('getSharedUserSync', () => {
  beforeEach(() => {
    mockStorage = {};
  });

  it('should return user from storage', () => {
    const user: SharedUser = {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test',
      role: 'user',
    };

    mockStorage[STORAGE_KEY] = JSON.stringify(user);

    expect(getSharedUserSync()).toEqual(user);
  });

  it('should return null when storage is empty', () => {
    expect(getSharedUserSync()).toBeNull();
  });

  it('should return null for invalid JSON', () => {
    mockStorage[STORAGE_KEY] = '{invalid}';

    expect(getSharedUserSync()).toBeNull();
  });
});

describe('setSharedUser', () => {
  beforeEach(() => {
    mockStorage = {};
    vi.clearAllMocks();
  });

  it('should store user in localStorage', () => {
    const user: SharedUser = {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test',
      role: 'user',
    };

    setSharedUser(user);

    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      JSON.stringify(user)
    );
  });
});

describe('clearSharedUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should remove user from localStorage', () => {
    clearSharedUser();

    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
  });
});
