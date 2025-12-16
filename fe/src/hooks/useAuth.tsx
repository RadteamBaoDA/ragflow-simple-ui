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
 * Authenticated user information.
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
  role: 'admin' | 'manager' | 'user';
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
 * Authentication context value type.
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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================================================
// Provider
// ============================================================================

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Authentication provider component.
 * 
 * Wraps the application to provide authentication context.
 * Automatically checks session on mount and redirects if needed.
 * 
 * @param children - Child components to wrap
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  /**
   * Check if user has a valid session.
   * Calls /api/auth/me endpoint to verify session and get user data.
   * 
   * @returns true if session is valid, false otherwise
   */
  const checkSession = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);
      console.log('[Auth] Checking session...');

      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        credentials: 'include', // Include session cookie
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        console.log('[Auth] Session valid:', userData.email);
        return true;
      }

      if (response.status === 401) {
        console.log('[Auth] Session not found or expired (401)');
        setUser(null);
        return false;
      }

      throw new Error(`Unexpected response: ${response.status}`);
    } catch (err) {
      console.error('[Auth] Error checking session:', err);
      setError(err instanceof Error ? err.message : 'Failed to check session');
      setUser(null);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Logout the current user.
   * Clears local state and redirects to backend logout endpoint.
   */
  const logout = useCallback(() => {
    console.log('[Auth] Logging out...');
    setUser(null);
    setIsLoading(false);
    // Redirect to backend logout which clears session and optionally Azure AD
    window.location.href = `${API_BASE_URL}/api/auth/logout`;
  }, []);

  /**
   * Effect: Check session on mount for protected routes.
   * Skips check for public paths (login, logout).
   */
  useEffect(() => {
    const publicPaths = ['/login', '/logout'];
    const isPublicPath = publicPaths.some(path => location.pathname.startsWith(path));

    // Skip auth check for public paths
    if (isPublicPath) {
      console.log('[Auth] Public path, skipping auth check:', location.pathname);
      setIsLoading(false);
      return;
    }

    // Check session for protected paths
    console.log('[Auth] Protected path, checking session:', location.pathname);
    checkSession().then(isValid => {
      if (!isValid) {
        // Store intended destination for post-login redirect
        const redirectUrl = location.pathname + location.search;
        console.log('[Auth] Not authenticated, redirecting to login. Intended destination:', redirectUrl);
        navigate(`/login?redirect=${encodeURIComponent(redirectUrl)}`, { replace: true });
      }
    });
  }, [location.pathname, location.search, checkSession, navigate]);

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
 * Hook to access authentication context.
 * Must be used within an AuthProvider.
 * 
 * @returns Authentication context with user state and methods
 * @throws Error if used outside AuthProvider
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
