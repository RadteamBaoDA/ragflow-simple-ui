/**
 * @fileoverview Shared user hook for cross-subdomain user info.
 * 
 * This hook manages user information that can be shared across
 * different subdomains (e.g., app.example.com and admin.example.com).
 * 
 * Sharing mechanisms:
 * 1. localStorage (same-origin only)
 * 2. BroadcastChannel (same-origin tab sync)
 * 3. Cross-subdomain cookies (for different subdomains)
 * 
 * @module hooks/useSharedUser
 */

import { useEffect, useState, useCallback } from 'react';
import { 
  sharedStorage, 
  SharedUserInfo, 
  subscribeToUserInfoChanges 
} from '../services/shared-storage.service';

/** Backend API base URL */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// ============================================================================
// Types
// ============================================================================

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
 * Hook to access shared user info across subdomains.
 * 
 * This hook:
 * 1. First checks shared storage (localStorage/cookie) for cached user
 * 2. Then fetches fresh data from backend /api/auth/me
 * 3. Stores the result in shared storage for other apps
 * 4. Subscribes to changes from other tabs/subdomains
 * 
 * @returns Shared user state and control functions
 * 
 * @example
 * ```tsx
 * const { user, isLoading, refresh } = useSharedUser();
 * if (user) {
 *   console.log('Shared user:', user.email);
 * }
 * ```
 */
export function useSharedUser(): UseSharedUserResult {
  const [user, setUser] = useState<SharedUserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetches user from backend and stores in shared storage.
   * Updates local state with fetched user data.
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
          sharedStorage.clearUser();
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
        displayName: userData.displayName,
        avatar: userData.avatar,
        lastUpdated: new Date().toISOString(),
        source: window.location.hostname,
      };

      // Store in shared storage
      sharedStorage.storeUser(sharedUser);
      setUser(sharedUser);
      
      console.log('[useSharedUser] User fetched and stored:', sharedUser.email);
    } catch (err) {
      console.error('[useSharedUser] Error fetching user:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Effect: Initialize user on mount.
   * Checks cache first, then refreshes from backend.
   */
  useEffect(() => {
    const initUser = async () => {
      // Check shared storage cache first
      const cachedUser = sharedStorage.getUser();
      if (cachedUser) {
        console.log('[useSharedUser] Found cached user:', cachedUser.email);
        setUser(cachedUser);
        setIsLoading(false);
        
        // Refresh from backend in background
        fetchAndStoreUser();
      } else {
        // No cache, fetch from backend
        await fetchAndStoreUser();
      }
    };

    initUser();
  }, [fetchAndStoreUser]);

  /**
   * Effect: Subscribe to user updates from other tabs/subdomains.
   * Uses BroadcastChannel or storage events.
   */
  useEffect(() => {
    const unsubscribe = subscribeToUserInfoChanges((updatedUser) => {
      console.log('[useSharedUser] Received user update from another source');
      setUser(updatedUser);
    });

    return unsubscribe;
  }, []);

  /**
   * Clears shared user data from all storage.
   */
  const clear = useCallback(() => {
    sharedStorage.clearUser();
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
 * Get shared user info synchronously from cache.
 * Use this when you need immediate access without async.
 * Returns null if no cached user exists.
 * 
 * @returns Cached user info or null
 */
export function getSharedUserSync(): SharedUserInfo | null {
  return sharedStorage.getUser();
}

/**
 * Store user info in shared storage.
 * Call this after successful authentication.
 * 
 * @param user - User info to store (without metadata fields)
 */
export function setSharedUser(user: Omit<SharedUserInfo, 'lastUpdated' | 'source'>): void {
  sharedStorage.storeUser(user);
}

/**
 * Clear shared user info from all storage.
 * Call this on logout to clean up cross-subdomain data.
 */
export function clearSharedUser(): void {
  sharedStorage.clearUser();
}

export default useSharedUser;
