/**
 * @fileoverview Login page component with Azure AD OAuth.
 *
 * Provides authentication UI with:
 * - Microsoft/Azure AD sign-in button
 * - Optional root login dialog for development/emergency access
 * - Redirect handling for post-login navigation
 * - Error message display from OAuth flow
 * - Full i18n support for all text
 *
 * @module pages/LoginPage
 */

import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '@/app/contexts/SettingsContext';
import { Dialog } from '@/components/Dialog';
import logo from '@/assets/logo.png';
import logoDark from '@/assets/logo-dark.png';
import BroadcastBanner from '@/features/broadcast/components/BroadcastBanner';

/** API base URL from environment */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// ============================================================================
// Component
// ============================================================================

/**
 * @description Login page with Azure AD OAuth and optional root login.
 *
 * Features:
 * - Azure AD OAuth sign-in button
 * - Optional root login dialog (when enabled in config)
 * - Theme-aware styling
 * - Automatic redirect if already authenticated
 * - Error display from OAuth callback
 *
 * @returns {JSX.Element} The rendered Login page.
 */
function LoginPage() {
  const { t } = useTranslation();
  const { resolvedTheme } = useSettings();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Get error and redirect from URL params
  const error = searchParams.get('error');
  const redirect = searchParams.get('redirect') || '/chat';
  const { isAuthenticated, isLoading } = useAuth();

  // Root login state
  const [enableRootLogin, setEnableRootLogin] = useState(false);
  const [isRootLoginOpen, setIsRootLoginOpen] = useState(false);
  const [rootUsername, setRootUsername] = useState('');
  const [rootPassword, setRootPassword] = useState('');
  const [rootLoginError, setRootLoginError] = useState<string | null>(null);

  // Select logo based on theme
  const logoSrc = resolvedTheme === 'dark' ? logoDark : logo;

  // ============================================================================
  // Effects
  // ============================================================================

  /**
   * @description Effect: Apply theme class to document.
   * Required since login page is found outside the main Layout component which normally handles this.
   */
  useEffect(() => {
    if (resolvedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [resolvedTheme]);

  /**
   * @description Effect: Fetch auth configuration.
   * Checks if root login is enabled for this deployment to conditionally render the option.
   */
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/config`);
        if (response.ok) {
          const data = await response.json();
          setEnableRootLogin(data.enableRootLogin);
        }
      } catch (err) {
        console.error('Failed to fetch auth config:', err);
      }
    };
    fetchConfig();
  }, []);

  /**
   * @description Effect: Redirect if already authenticated.
   * Navigates to the intended destination from redirect param or default page.
   */
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      console.log('[Login] Already authenticated, redirecting to:', redirect);
      navigate(redirect, { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, redirect]);

  // ============================================================================
  // Handlers
  // ============================================================================

  /**
   * @description Handle Microsoft/Azure AD login button click.
   * Redirects to backend OAuth login endpoint with redirect URL for callback.
   */
  const handleLogin = () => {
    const loginUrl = `${API_BASE_URL}/api/auth/login?redirect=${encodeURIComponent(window.location.origin + redirect)}`;
    console.log('[Login] Redirecting to:', loginUrl);
    window.location.href = loginUrl;
  };

  /**
   * @description Handle root login form submission.
   * Posts credentials to backend and redirects on success.
   */
  const handleRootLogin = async () => {
    setRootLoginError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login/root`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: rootUsername, password: rootPassword }),
        credentials: 'include',
      });

      if (response.ok) {
        // Force reload to pick up session and redirect
        window.location.href = redirect;
      } else {
        const data = await response.json();
        setRootLoginError(data.error || t('login.error'));
      }
    } catch (err) {
      setRootLoginError(t('login.error'));
      console.error(err);
    }
  };

  /**
   * @description Handle Enter key press in root login form.
   * Triggers login submission.
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRootLogin();
    }
  };

  // Show loading while checking auth status to prevent flicker
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">{t('common.checkingSession')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-lg max-w-lg w-full overflow-hidden">
        <div className={`text-center mb-8 ${resolvedTheme === 'dark' ? '' : 'bg-white p-4 rounded-lg'}`}>
          <div className="flex justify-center mb-4">
            <img
              src={logoSrc}
              alt="Knowledge Base"
              className="max-w-[300px] w-full h-auto object-contain"
            />
          </div>
          <BroadcastBanner inline className="mt-2" />
          <p className="text-slate-600 dark:text-slate-400">{t('login.subtitle')}</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
            {t('login.error')}: {decodeURIComponent(error)}
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={handleLogin}
            className="w-full btn btn-primary py-3 text-base flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 21 21" fill="currentColor">
              <rect x="1" y="1" width="9" height="9" />
              <rect x="11" y="1" width="9" height="9" />
              <rect x="1" y="11" width="9" height="9" />
              <rect x="11" y="11" width="9" height="9" />
            </svg>
            {t('login.signInMicrosoft')}
          </button>

          {enableRootLogin && (
            <button
              onClick={() => setIsRootLoginOpen(true)}
              className="w-full btn btn-secondary py-3 text-base"
            >
              {t('login.rootLogin')}
            </button>
          )}
        </div>

        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-6">
          {t('login.signInPrompt')}
        </p>
      </div>

      <Dialog
        open={isRootLoginOpen}
        onClose={() => setIsRootLoginOpen(false)}
        title={t('login.rootLoginTitle')}
        footer={
          <>
            <button
              onClick={() => setIsRootLoginOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleRootLogin}
              className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors"
            >
              {t('common.login')}
            </button>
          </>
        }
      >
        <div className="space-y-4 py-4">
          {rootLoginError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
              {rootLoginError}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('common.username')}
            </label>
            <input
              type="text"
              value={rootUsername}
              onChange={(e) => setRootUsername(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="admin@localhost"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('common.password')}
            </label>
            <input
              type="password"
              value={rootPassword}
              onChange={(e) => setRootPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="••••••••"
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
}

export default LoginPage;
