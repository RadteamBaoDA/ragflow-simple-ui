/**
 * @fileoverview Protected route wrapper for authenticated pages.
 * 
 * Guards routes that require authentication. Shows loading state
 * while checking session and redirects to login if not authenticated.
 * 
 * Usage:
 * ```tsx
 * <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
 *   <Route path="/dashboard" element={<Dashboard />} />
 * </Route>
 * ```
 * 
 * @module components/ProtectedRoute
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../contexts/SettingsContext';
import { useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

interface ProtectedRouteProps {
    /** Child components to render when authenticated */
    children: React.ReactNode;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Route wrapper that protects routes requiring authentication.
 * 
 * Behavior:
 * - Shows loading spinner while checking session
 * - Redirects to /login with redirect param if not authenticated
 * - Renders children if authenticated
 * 
 * Also applies theme class during loading (before Layout is rendered).
 * 
 * @param children - Components to render for authenticated users
 */
function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { t } = useTranslation();
  const { resolvedTheme } = useSettings();
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  /**
   * Effect: Apply theme class to document during loading.
   * This ensures proper styling before Layout component mounts.
   */
  useEffect(() => {
    if (resolvedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [resolvedTheme]);

  // Show loading spinner while checking session
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">{t('common.checkingSession')}</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    // Preserve intended destination for post-login redirect
    const redirectUrl = location.pathname + location.search;
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirectUrl)}`} replace />;
  }

  return <>{children}</>;
}

export default ProtectedRoute;
