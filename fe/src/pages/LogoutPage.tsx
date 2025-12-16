/**
 * @fileoverview Logout page component.
 * 
 * Displays a loading spinner while redirecting to the backend
 * logout endpoint. The backend handles Azure AD SSO logout.
 * 
 * @module pages/LogoutPage
 */

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../contexts/SettingsContext';

// ============================================================================
// Component
// ============================================================================

/**
 * Logout page - redirects to backend logout endpoint.
 * 
 * Displays a loading spinner with "signing out" message while
 * redirecting to the backend. The backend clears the session
 * and redirects to Azure AD logout if SSO is enabled.
 */
function LogoutPage() {
  const { t } = useTranslation();
  const { resolvedTheme } = useSettings();

  /**
   * Effect: Apply theme class to document.
   * Required since logout page is outside Layout component.
   */
  useEffect(() => {
    if (resolvedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [resolvedTheme]);

  /**
   * Effect: Redirect to backend logout endpoint.
   * The backend handles session cleanup and Azure AD logout.
   */
  useEffect(() => {
    window.location.href = '/api/auth/logout';
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-slate-600 dark:text-slate-400">{t('common.signingOut')}</p>
      </div>
    </div>
  );
}

export default LogoutPage;
