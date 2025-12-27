/**
 * @fileoverview Protected route wrapper for authenticated pages.
 *
 * Guards routes that require authentication. Shows loading state
 * while checking session and redirects to login if not authenticated.
 *
 * @module components/ProtectedRoute
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { useTranslation } from 'react-i18next';
import { useSettings } from '@/app/contexts/SettingsContext';
import { useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

/** 
 * @description Props for ProtectedRoute component 
 */
interface ProtectedRouteProps {
  /** Child components to render when authenticated */
  children: React.ReactNode;
}

// ============================================================================
// Component
// ============================================================================

/**
 * @description Route wrapper that protects routes requiring authentication.
 * Manages loading state and redirects unauthenticated users to login.
 *
 * @param {ProtectedRouteProps} props - Component properties.
 * @returns {JSX.Element} The child components or a loading/redirect state.
 */
function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { t } = useTranslation();
  const { resolvedTheme } = useSettings();
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  /**
   * @description Effect: Apply theme class to document during loading.
   * This ensures proper styling before Layout component mounts.
   */
  useEffect(() => {
    if (resolvedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [resolvedTheme]);

  // Display a loading spinner while the session is being checked
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

  // If loading is complete and user is not authenticated, redirect to login
  if (!isAuthenticated) {
    // Preserve the current path to redirect back after successful login
    const redirectUrl = location.pathname + location.search;
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirectUrl)}`} replace />;
  }

  // Render the protected content if authenticated
  return <>{children}</>;
}

export default ProtectedRoute;
