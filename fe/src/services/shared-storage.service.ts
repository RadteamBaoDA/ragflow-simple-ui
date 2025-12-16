23 /**
 * @fileoverview Shared Storage Service for cross-subdomain user sharing.
 * 
 * This service uses BroadcastChannel + localStorage to share user info
 * across subdomains (e.g., a.abc.com and b.abc.com).
 * 
 * Storage Mechanisms:
 * - localStorage: Primary storage for same-origin access
 * - BroadcastChannel: Real-time sync between same-origin tabs
 * - Cookies: Cross-subdomain access with parent domain
 * 
 * Requirements for cross-subdomain sharing:
 * 1. Both apps must be on the same parent domain (e.g., *.abc.com)
 * 2. Cookies/localStorage must be set with the parent domain
 * 3. SHARED_STORAGE_DOMAIN env variable must be configured
 * 
 * Usage:
 * ```typescript
 * import { sharedStorage } from './shared-storage.service';
 * 
 * // Store user info
 * sharedStorage.storeUser({ id, email, name, displayName, avatar });
 * 
 * // Get user info
 * const user = sharedStorage.getUser();
 * 
 * // Subscribe to changes from other tabs
 * const unsubscribe = sharedStorage.subscribe((user) => {
 *   console.log('User changed:', user);
 * });
 * ```
 * 
 * @module services/shared-storage
 */

// ============================================================================
// Type Declarations
// ============================================================================

/** Vite-injected environment variable for shared domain */
declare const __SHARED_STORAGE_DOMAIN__: string;

// ============================================================================
// Types
// ============================================================================

/**
 * User information that can be shared across subdomains.
 */
export interface SharedUserInfo {
  /** Unique user identifier */
  id: string;
  /** User email address */
  email: string;
  /** User's full name */
  name: string;
  /** Display name (may differ from name) */
  displayName: string;
  /** Avatar URL (optional) */
  avatar?: string;
  /** ISO timestamp of last update */
  lastUpdated: string;
  /** Hostname that stored this info */
  source: string;
}

// ============================================================================
// Constants
// ============================================================================

/** LocalStorage key for user info */
const STORAGE_KEY = 'kb_shared_user_info';

/** BroadcastChannel name for tab sync */
const BROADCAST_CHANNEL_NAME = 'kb_user_info_channel';

/** Shared domain for cross-subdomain cookies */
const SHARED_DOMAIN = typeof __SHARED_STORAGE_DOMAIN__ !== 'undefined' 
  ? __SHARED_STORAGE_DOMAIN__ 
  : '.localhost';

// ============================================================================
// Public Functions
// ============================================================================

/**
 * Get the shared storage domain for cookies
 */
export function getSharedDomain(): string {
  return SHARED_DOMAIN;
}

/**
 * Store user info in localStorage and broadcast to other tabs/windows
 */
export function storeUserInfo(user: Omit<SharedUserInfo, 'lastUpdated' | 'source'>): void {
  const userInfo: SharedUserInfo = {
    ...user,
    lastUpdated: new Date().toISOString(),
    source: window.location.hostname,
  };

  try {
    // Store in localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userInfo));
    console.log('[SharedStorage] User info stored:', userInfo.email);

    // Broadcast to other tabs on same origin
    try {
      const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      channel.postMessage({ type: 'USER_INFO_UPDATED', data: userInfo });
      channel.close();
    } catch (e) {
      // BroadcastChannel not supported
      console.log('[SharedStorage] BroadcastChannel not supported');
    }

    // Also store in a cookie for cross-subdomain access
    setCrossSubdomainCookie(userInfo);
  } catch (error) {
    console.error('[SharedStorage] Failed to store user info:', error);
  }
}

/**
 * Get user info from localStorage or cookie
 */
export function getUserInfo(): SharedUserInfo | null {
  try {
    // First try localStorage
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const userInfo = JSON.parse(stored) as SharedUserInfo;
      console.log('[SharedStorage] User info retrieved from localStorage:', userInfo.email);
      return userInfo;
    }

    // Fallback to cookie (for cross-subdomain)
    const cookieInfo = getCrossSubdomainCookie();
    if (cookieInfo) {
      console.log('[SharedStorage] User info retrieved from cookie:', cookieInfo.email);
      // Also store in localStorage for faster access next time
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cookieInfo));
      return cookieInfo;
    }

    return null;
  } catch (error) {
    console.error('[SharedStorage] Failed to get user info:', error);
    return null;
  }
}

/**
 * Clear user info from all storage mechanisms
 */
export function clearUserInfo(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    clearCrossSubdomainCookie();
    
    // Broadcast to other tabs
    try {
      const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      channel.postMessage({ type: 'USER_INFO_CLEARED' });
      channel.close();
    } catch (e) {
      // BroadcastChannel not supported
    }
    
    console.log('[SharedStorage] User info cleared');
  } catch (error) {
    console.error('[SharedStorage] Failed to clear user info:', error);
  }
}

/**
 * Subscribe to user info changes from other tabs/windows
 */
export function subscribeToUserInfoChanges(
  callback: (userInfo: SharedUserInfo | null) => void
): () => void {
  let channel: BroadcastChannel | null = null;

  try {
    channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    channel.onmessage = (event) => {
      if (event.data.type === 'USER_INFO_UPDATED') {
        callback(event.data.data as SharedUserInfo);
      } else if (event.data.type === 'USER_INFO_CLEARED') {
        callback(null);
      }
    };
  } catch (e) {
    // BroadcastChannel not supported, use storage event fallback
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        callback(event.newValue ? JSON.parse(event.newValue) : null);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }

  return () => {
    if (channel) {
      channel.close();
    }
  };
}

// ============================================================================
// Private Functions (Cookie Helpers)
// ============================================================================

/**
 * Set a cookie that works across subdomains.
 * 
 * Sets cookie with parent domain for cross-subdomain access.
 * Cookie expires after 24 hours. Uses SameSite=Lax and Secure
 * flag for HTTPS connections.
 * 
 * @param userInfo - User information to store in cookie
 */
function setCrossSubdomainCookie(userInfo: SharedUserInfo): void {
  const value = encodeURIComponent(JSON.stringify(userInfo));
  const domain = SHARED_DOMAIN;
  const maxAge = 24 * 60 * 60; // 24 hours
  
  // Set cookie with parent domain for cross-subdomain access
  let cookieString = `${STORAGE_KEY}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
  
  // Only add domain if it's not localhost
  if (domain && !domain.includes('localhost')) {
    cookieString += `; domain=${domain}`;
  }
  
  // Add Secure flag for HTTPS
  if (window.location.protocol === 'https:') {
    cookieString += '; Secure';
  }
  
  document.cookie = cookieString;
  console.log('[SharedStorage] Cross-subdomain cookie set for domain:', domain);
}

/**
 * Get user info from cross-subdomain cookie
 */
function getCrossSubdomainCookie(): SharedUserInfo | null {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === STORAGE_KEY && value) {
      try {
        return JSON.parse(decodeURIComponent(value)) as SharedUserInfo;
      } catch (e) {
        console.error('[SharedStorage] Failed to parse cookie:', e);
      }
    }
  }
  return null;
}

/**
 * Clear cross-subdomain cookie
 */
function clearCrossSubdomainCookie(): void {
  const domain = SHARED_DOMAIN;
  let cookieString = `${STORAGE_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  
  if (domain && !domain.includes('localhost')) {
    cookieString += `; domain=${domain}`;
  }
  
  document.cookie = cookieString;
}

/**
 * Check if shared storage is available
 */
export function isSharedStorageAvailable(): boolean {
  try {
    localStorage.setItem('__test__', 'test');
    localStorage.removeItem('__test__');
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Exported Instance
// ============================================================================

/**
 * Shared storage service instance.
 * Provides a convenient API for cross-subdomain user info sharing.
 */
export const sharedStorage = {
  /** Store user info in all storage mechanisms */
  storeUser: storeUserInfo,
  /** Get user info from localStorage or cookie */
  getUser: getUserInfo,
  /** Clear user info from all storage mechanisms */
  clearUser: clearUserInfo,
  /** Subscribe to user info changes from other tabs */
  subscribe: subscribeToUserInfoChanges,
  /** Check if shared storage is available */
  isAvailable: isSharedStorageAvailable,
  /** Get the configured shared domain */
  getDomain: getSharedDomain,
};

export default sharedStorage;
