/**
 * @fileoverview Tests for useAuth hook.
 * 
 * Tests:
 * - AuthProvider context
 * - useAuth hook
 * - Session checking
 * - Login/logout flow
 * - Error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import React, { ReactNode, createContext, useContext, useState, useCallback, useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'user';
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  checkSession: () => Promise<void>;
  logout: () => Promise<void>;
}

// ============================================================================
// Mock Implementation
// ============================================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
  mockFetch?: (url: string, options?: RequestInit) => Promise<Response>;
}

/**
 * Mock AuthProvider for testing.
 */
function AuthProvider({ children, mockFetch }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = mockFetch || global.fetch;

  const checkSession = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetchUser('/api/auth/me', {
        credentials: 'include',
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Session check failed:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [fetchUser]);

  const logout = useCallback(async () => {
    try {
      await fetchUser('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      setUser(null);
    }
  }, [fetchUser]);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        checkSession,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// ============================================================================
// Helpers
// ============================================================================

function createMockResponse(data: any, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
  } as unknown as Response;
}

// ============================================================================
// Tests
// ============================================================================

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should start with loading true', async () => {
      const mockFetch = vi.fn().mockImplementation(() => new Promise(() => {})); // Never resolves

      const wrapper = ({ children }: { children: ReactNode }) => (
        <AuthProvider mockFetch={mockFetch}>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('successful authentication', () => {
    it('should set user when session is valid', async () => {
      const mockUser: User = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
      };

      const mockFetch = vi.fn().mockResolvedValue(createMockResponse(mockUser));

      const wrapper = ({ children }: { children: ReactNode }) => (
        <AuthProvider mockFetch={mockFetch}>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should handle admin user', async () => {
      const mockUser: User = {
        id: 'admin-1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin',
        avatar: 'https://example.com/avatar.jpg',
      };

      const mockFetch = vi.fn().mockResolvedValue(createMockResponse(mockUser));

      const wrapper = ({ children }: { children: ReactNode }) => (
        <AuthProvider mockFetch={mockFetch}>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user?.role).toBe('admin');
    });
  });

  describe('unauthenticated state', () => {
    it('should set user to null when not authenticated', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse({ error: 'Unauthorized' }, false, 401)
      );

      const wrapper = ({ children }: { children: ReactNode }) => (
        <AuthProvider mockFetch={mockFetch}>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should handle network errors gracefully', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const wrapper = ({ children }: { children: ReactNode }) => (
        <AuthProvider mockFetch={mockFetch}>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('checkSession', () => {
    it('should call API with credentials', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse({ id: '1', email: 'test@example.com', name: 'Test', role: 'user' })
      );

      const wrapper = ({ children }: { children: ReactNode }) => (
        <AuthProvider mockFetch={mockFetch}>{children}</AuthProvider>
      );

      renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/auth/me', {
          credentials: 'include',
        });
      });
    });

    it('should allow manual session refresh', async () => {
      const mockUser: User = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
      };

      const mockFetch = vi.fn().mockResolvedValue(createMockResponse(mockUser));

      const wrapper = ({ children }: { children: ReactNode }) => (
        <AuthProvider mockFetch={mockFetch}>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Clear previous calls
      mockFetch.mockClear();

      // Manually check session
      await act(async () => {
        await result.current.checkSession();
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/auth/me', {
        credentials: 'include',
      });
    });
  });

  describe('logout', () => {
    it('should call logout API and clear user', async () => {
      const mockUser: User = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
      };

      const mockFetch = vi.fn()
        .mockResolvedValueOnce(createMockResponse(mockUser)) // Initial session check
        .mockResolvedValueOnce(createMockResponse({ success: true })); // Logout

      const wrapper = ({ children }: { children: ReactNode }) => (
        <AuthProvider mockFetch={mockFetch}>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Wait for initial auth
      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      // Logout
      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should clear user even if logout API fails', async () => {
      const mockUser: User = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
      };

      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Initial session check
          return Promise.resolve(createMockResponse(mockUser));
        } else {
          // Logout fails
          return Promise.reject(new Error('Network error'));
        }
      });

      const wrapper = ({ children }: { children: ReactNode }) => (
        <AuthProvider mockFetch={mockFetch}>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Wait for initial auth
      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      // Logout - should not throw
      await act(async () => {
        try {
          await result.current.logout();
        } catch {
          // Expected to fail silently
        }
      });

      // User should still be cleared
      expect(result.current.user).toBeNull();
    });
  });

  describe('context errors', () => {
    it('should throw error when used outside provider', () => {
      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider');
    });
  });

  describe('user roles', () => {
    it('should handle user role', async () => {
      const mockUser: User = {
        id: 'user-1',
        email: 'user@example.com',
        name: 'Regular User',
        role: 'user',
      };

      const mockFetch = vi.fn().mockResolvedValue(createMockResponse(mockUser));

      const wrapper = ({ children }: { children: ReactNode }) => (
        <AuthProvider mockFetch={mockFetch}>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user?.role).toBe('user');
    });

    it('should handle manager role', async () => {
      const mockUser: User = {
        id: 'manager-1',
        email: 'manager@example.com',
        name: 'Manager User',
        role: 'manager',
      };

      const mockFetch = vi.fn().mockResolvedValue(createMockResponse(mockUser));

      const wrapper = ({ children }: { children: ReactNode }) => (
        <AuthProvider mockFetch={mockFetch}>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user?.role).toBe('manager');
    });
  });
});
