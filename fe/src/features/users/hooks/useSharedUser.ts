/**
 * @fileoverview Shared user hook for user info management.
 * 
 * This hook manages user information with localStorage caching.
 * 
 * @module hooks/useSharedUser
 */

import { useEffect, useState, useCallback } from 'react';

/** Backend API base URL */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const STORAGE_KEY = 'kb-user';

// ============================================================================
// Types
// ============================================================================

/**
 * Shared user information structure.
 */
export interface SharedUserInfo {
  id: string;
  email: string;
  name?: string;
  role?: string;
}

/**
 * Return type for useSharedUser hook.
 */
interface UseSharedUserResult {
  /** Current shared user info or null */
  user: SharedUserInfo | null;
  /** Whether user data is being fetched */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Function to refresh user data from backend */
  refresh: () => Promise<void>;
  /** Function to clear shared user data */
  clear: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook to access user info with localStorage caching.
 * 
 * @returns User state and control functions
 */
export function useSharedUser(): UseSharedUserResult {
  const [user, setUser] = useState<SharedUserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetches user from backend and stores in localStorage.
   */
  const fetchAndStoreUser = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Not authenticated, clear storage
          localStorage.removeItem(STORAGE_KEY);
          setUser(null);
          return;
        }
        throw new Error('Failed to fetch user info');
      }

      const userData = await response.json();
      
      const sharedUser: SharedUserInfo = {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        role: userData.role,
      };

      // Store in localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sharedUser));
      setUser(sharedUser);
    } catch (err) {
      console.error('[useSharedUser] Error fetching user:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Effect: Initialize user on mount.
   */
  useEffect(() => {
    const initUser = async () => {
      // Check localStorage cache first
      try {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
          const cachedUser = JSON.parse(cached) as SharedUserInfo;
          setUser(cachedUser);
          setIsLoading(false);
          
          // Refresh from backend in background
          fetchAndStoreUser();
          return;
        }
      } catch (err) {
        console.error('[useSharedUser] Error reading cache:', err);
      }

      // No cache, fetch from backend
      await fetchAndStoreUser();
    };

    initUser();
  }, [fetchAndStoreUser]);

  /**
   * Clears user data from localStorage.
   */
  const clear = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  return {
    user,
    isLoading,
    error,
    refresh: fetchAndStoreUser,
    clear,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get user info synchronously from cache.
 */
export function getSharedUserSync(): SharedUserInfo | null {
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

/**
 * Store user info in localStorage.
 */
export function setSharedUser(user: SharedUserInfo): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

/**
 * Clear user info from localStorage.
 */
export function clearSharedUser(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export default useSharedUser;
