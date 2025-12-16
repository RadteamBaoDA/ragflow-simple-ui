/**
 * @fileoverview API utility module with authentication interceptor.
 * 
 * Provides a fetch wrapper that:
 * - Automatically includes credentials (cookies) for session auth
 * - Handles 401 responses by redirecting to login page
 * - Provides typed HTTP methods (GET, POST, PUT, DELETE)
 * 
 * @module lib/api
 */

/** Backend API base URL from environment */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// ============================================================================
// Error Types
// ============================================================================

/**
 * Custom error for authentication failures.
 * Thrown when a 401 response is received.
 */
export class AuthenticationError extends Error {
  constructor(message: string = 'Not authenticated') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

// ============================================================================
// Authentication Handler
// ============================================================================

/**
 * Handles 401 Unauthorized responses.
 * Redirects to login page with current path for post-login redirect.
 * 
 * @throws AuthenticationError - Always throws after redirect
 */
function handleUnauthorized(): never {
  // Capture current path for redirect after login
  const currentPath = window.location.pathname + window.location.search;
  const loginUrl = `/login?redirect=${encodeURIComponent(currentPath)}`;
  
  console.log('[API] Unauthorized (401), redirecting to login:', loginUrl);
  
  // Force full page redirect to clear any stale state
  window.location.href = loginUrl;
  
  // Throw to stop further execution
  throw new AuthenticationError();
}

// ============================================================================
// Types
// ============================================================================

/**
 * Extended fetch options with auth skip flag.
 */
interface FetchOptions extends RequestInit {
  /** Skip 401 handling (used for login/logout endpoints) */
  skipAuthCheck?: boolean;
}

// ============================================================================
// Core Fetch Function
// ============================================================================

/**
 * Fetch wrapper with automatic authentication handling.
 * 
 * Features:
 * - Prepends API base URL for relative endpoints
 * - Always includes credentials for session cookies
 * - Sets JSON content type by default
 * - Handles 401 by redirecting to login
 * - Parses JSON response automatically
 * 
 * @template T - Expected response type
 * @param endpoint - API endpoint (relative or absolute URL)
 * @param options - Fetch options with optional auth skip
 * @returns Parsed JSON response
 * @throws AuthenticationError on 401 (after redirect)
 * @throws Error on non-OK responses
 */
export async function apiFetch<T = unknown>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { skipAuthCheck = false, ...fetchOptions } = options;
  
  // Build full URL (preserve absolute URLs)
  const url = endpoint.startsWith('http') 
    ? endpoint 
    : `${API_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...fetchOptions,
    credentials: 'include', // Always include cookies for session auth
    headers: {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    },
  });
  
  // Handle 401 Unauthorized - redirect to login
  if (response.status === 401 && !skipAuthCheck) {
    handleUnauthorized();
  }
  
  // Handle other errors
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API error: ${response.status}`);
  }
  
  // Return parsed JSON response
  return response.json() as Promise<T>;
}

// ============================================================================
// Convenience Methods
// ============================================================================

/**
 * API helper object with HTTP method shortcuts.
 * All methods include credentials and handle authentication.
 */
export const api = {
  /**
   * Perform a GET request.
   * @template T - Expected response type
   */
  get: <T = unknown>(endpoint: string, options?: FetchOptions) =>
    apiFetch<T>(endpoint, { ...options, method: 'GET' }),
  
  /**
   * Perform a POST request with JSON body.
   * @template T - Expected response type
   */
  post: <T = unknown>(endpoint: string, data?: unknown, options?: FetchOptions) => {
    const body = data ? JSON.stringify(data) : null;
    return apiFetch<T>(endpoint, {
      ...options,
      method: 'POST',
      body,
    });
  },
  
  /**
   * Perform a PUT request with JSON body.
   * @template T - Expected response type
   */
  put: <T = unknown>(endpoint: string, data?: unknown, options?: FetchOptions) => {
    const body = data ? JSON.stringify(data) : null;
    return apiFetch<T>(endpoint, {
      ...options,
      method: 'PUT',
      body,
    });
  },
  
  /**
   * Perform a DELETE request.
   * @template T - Expected response type
   */
  delete: <T = unknown>(endpoint: string, options?: FetchOptions) =>
    apiFetch<T>(endpoint, { ...options, method: 'DELETE' }),
};

export default api;
