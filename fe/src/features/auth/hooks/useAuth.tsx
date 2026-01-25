/**
 * @fileoverview Authentication hook and provider.
 *
 * Provides authentication state management for the application:
 * - Session checking via /api/auth/me endpoint
 * - User state with role-based permissions
 * - Automatic redirect to login for unauthenticated users
 * - Logout functionality
 *
 * @module hooks/useAuth
 */

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/** Backend API base URL */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// ============================================================================
// Types
// ============================================================================

/**
 * @description Authenticated user information interface.
 * Contains profile data from Azure AD and role from database.
 */
export interface User {
  /** Unique user ID (from Azure AD or database) */
  id: string;
  /** User's email address */
  email: string;
  /** User's full name */
  name: string;
  /** Display name (may differ from full name) */
  displayName: string;
  /** Avatar URL (from Azure AD or generated) */
  avatar?: string;
  /** User's role: admin, manager, or user */
  role: 'admin' | 'leader' | 'user';
  /** List of granted permissions */
  permissions: string[];
  /** User's department (from Azure AD) */
  department?: string;
  /** User's job title (from Azure AD) */
  job_title?: string;
  /** User's mobile phone (from Azure AD) */
  mobile_phone?: string;
}

/**
 * @description Authentication context value interface.
 * Defines the shape of the data provided by AuthProvider.
 */
interface AuthContextType {
  /** Current authenticated user or null */
  user: User | null;
  /** Whether auth check is in progress */
  isLoading: boolean;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Error message if auth check failed */
  error: string | null;
  /** Function to manually check session */
  checkSession: () => Promise<boolean>;
  /** Function to logout user */
  logout: () => void;
}

// ============================================================================
// Context
// ============================================================================

/**
 * @description React Context for Authentication.
 */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================================================
// Provider
// ============================================================================

/**
 * @description Props for the AuthProvider component.
 */
interface AuthProviderProps {
  /** Child components to wrap with the auth context */
  children: ReactNode;
}

/**
 * @description Authentication provider component.
 * Wraps the application to provide authentication context.
 * Automatically checks session on mount and redirects if needed.
 *
 * @param {AuthProviderProps} props - Component properties.
 * @returns {JSX.Element} The provider wrapping children.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  /**
   * @description Check if user has a valid session.
   * Calls /api/auth/me endpoint to verify session and get user data.
   *
   * @returns {Promise<boolean>} true if session is valid, false otherwise.
   */
  const checkSession = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);
      console.log('[Auth] Checking session...');

      // Call the backend API to retrieve the current user's session
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        credentials: 'include', // Include session cookie in the request
      });

      if (response.ok) {
        // If response is successful, parse user data and update state
        const userData = await response.json();
        setUser(userData);
        console.log('[Auth] Session valid:', userData.email);
        return true;
      }

      if (response.status === 401) {
        // 401 Unauthorized means no active session
        console.log('[Auth] Session not found or expired (401)');
        setUser(null);
        return false;
      }

      throw new Error(`Unexpected response: ${response.status}`);
    } catch (err) {
      // Handle network errors or other exceptions during session check
      console.error('[Auth] Error checking session:', err);
      setError(err instanceof Error ? err.message : 'Failed to check session');
      setUser(null);
      return false;
    } finally {
      // Ensure loading state is turned off regardless of outcome
      setIsLoading(false);
    }
  }, []);

  /**
   * @description Logout the current user.
   * Clears local state and redirects to backend logout endpoint.
   */
  const logout = useCallback(() => {
    console.log('[Auth] Logging out...');
    setUser(null);
    setIsLoading(false);

    // Call the logout endpoint using POST method
    fetch(`${API_BASE_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' })
      .then(() => {
        // Redirect to login page after successful logout
        navigate('/login');
      })
      .catch((err) => {
        // Even if the API call fails, redirect to login to ensure client-side logout
        console.error('[Auth] Logout failed:', err);
        navigate('/login');
      });
  }, [navigate]);

  /**
   * @description Effect: Check session on mount or navigation.
   * Logic handles public paths, already authenticated state, and redirects.
   * 
   * IMPORTANT: This effect should NOT trigger re-renders during navigation when
   * the user is already authenticated. Doing so causes race conditions with
   * React Suspense lazy loading, resulting in double-click navigation bugs.
   */
  useEffect(() => {
    const publicPaths = ['/login', '/logout'];
    const isPublicPath = publicPaths.some(path => location.pathname.startsWith(path));

    // Skip auth check for defined public paths
    if (isPublicPath) {
      setIsLoading(false);
      return;
    }

    // Skip auth check if user is already authenticated
    // CRITICAL: Do NOT call setIsLoading here - it triggers re-renders that
    // conflict with Suspense transitions, causing the double-click bug
    if (user !== null) {
      return;
    }

    // Only check session if user is null (initial mount or after logout)
    console.log('[Auth] Protected path, checking session:', location.pathname);
    checkSession().then(isValid => {
      if (!isValid) {
        // If session is invalid, capture current path for post-login redirect
        const redirectUrl = location.pathname + location.search;
        console.log('[Auth] Not authenticated, redirecting to login. Intended destination:', redirectUrl);
        // Redirect to login page with the return URL
        navigate(`/login?redirect=${encodeURIComponent(redirectUrl)}`, { replace: true });
      }
    });
  }, [location.pathname, location.search, checkSession, navigate, user]);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
    checkSession,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * @description Hook to access authentication context.
 * Must be used within an AuthProvider.
 *
 * @returns {AuthContextType} Authentication context with user state and methods.
 * @throws {Error} If used outside of an AuthProvider.
 *
 * @example
 * ```tsx
 * const { user, isAuthenticated, logout } = useAuth();
 * if (isAuthenticated) {
 *   console.log('Logged in as:', user?.email);
 * }
 * ```
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default useAuth;
