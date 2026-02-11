/**
 * @fileoverview RAGFlow iframe container component with i18n support.
 *
 * Embeds RAGFlow AI Chat or AI Search interfaces in an iframe.
 * Handles:
 * - URL status checking before loading
 * - Loading states and error handling
 * - Custom error pages for different error types
 * - Locale appending to iframe URLs
 * - Iframe reload functionality
 * - All error messages internationalized via i18next
 *
 * @module components/RagflowIframe
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSharedUser } from '@/features/users';
import { useTranslation } from 'react-i18next';
import { useKnowledgeBase } from '@/features/knowledge-base/context/KnowledgeBaseContext';
import { useSettings } from '@/app/contexts/SettingsContext';
import { AlertCircle, RefreshCw, RotateCcw, WifiOff, Lock, FileQuestion, ServerCrash, Maximize2, Minimize2 } from 'lucide-react';
import { Tooltip } from 'antd';

import { ChatWidgetEmbed } from './ChatWidgetEmbed';

// ============================================================================
// Types
// ============================================================================

/** 
 * @description Props for RagflowIframe component 
 */
interface RagflowIframeProps {
  /** The type of RAGFlow interface to embed */
  path: "chat" | "search";
}

/** 
 * @description Error state for iframe loading failures 
 */
interface IframeError {
  /** Type of error for styling and messaging */
  type: 'network' | 'forbidden' | 'notfound' | 'server' | 'unknown';
  /** HTTP status code if available */
  statusCode?: number;
  /** Error message to display */
  message: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * @description RAGFlow iframe container with error handling and loading states.
 * Embeds the RAGFlow Chat or Search interface based on the path prop.
 * Includes URL validation, custom error pages, and retry functionality.
 *
 * @param {RagflowIframeProps} props - Component properties.
 * @param {string} props.path - 'chat' or 'search' to determine which interface to load.
 * @returns {JSX.Element} The rendered iframe container.
 */
function RagflowIframe({ path }: RagflowIframeProps) {
  const { t, i18n } = useTranslation();
  const { resolvedTheme } = useSettings();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // State management
  const [iframeSrc, setIframeSrc] = useState<string>('');
  const [iframeLoading, setIframeLoading] = useState(true);
  const [iframeError, setIframeError] = useState<IframeError | null>(null);
  const [isCheckingUrl, setIsCheckingUrl] = useState(false);

  const [urlChecked, setUrlChecked] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [sessionKey, setSessionKey] = useState<number>(Date.now());


  // Get user and Knowledge Base configuration
  const { user, isLoading: isUserLoading } = useSharedUser();
  const knowledgeBase = useKnowledgeBase();

  // Get the selected source ID based on path (chat or search)
  const selectedSourceId = path === 'chat' ? knowledgeBase.selectedChatSourceId : knowledgeBase.selectedSearchSourceId;

  // Get chat widget URL for search sources
  const chatWidgetUrl = path === 'search' && knowledgeBase.config
    ? knowledgeBase.config.searchSources.find(s => s.id === selectedSourceId)?.chat_widget_url
    : null;
  // ============================================================================
  // Callbacks
  // ============================================================================

  /**
   * @description Check URL availability before loading iframe.
   * Uses no-cors mode since we can't read status due to CORS.
   * Detects network errors and timeouts.
   *
   * @param {string} url - The URL to check.
   * @returns {Promise<void>}
   */
  const checkUrlStatus = useCallback(async (url: string) => {
    if (!url) return;

    setIsCheckingUrl(true);
    setIframeError(null);

    try {
      // Create abort controller for timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      // Attempt HEAD request with no-cors (can't read status, but detects network errors)
      await fetch(url, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // If we reach here without error, assume service is accessible
      setUrlChecked(true);
      setIframeError(null);
    } catch (error: any) {
      console.error('[RagflowIframe] URL check failed:', error);

      // Classify error type for appropriate error page
      if (error.name === 'AbortError') {
        setIframeError({
          type: 'network',
          message: t('iframe.connectionTimeout'),
        });
      } else if (error.message?.includes('REAUTH_REQUIRED')) {
        setIframeError({
          type: 'forbidden',
          message: t('iframe.reauthRequired'),
        });
      } else if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        setIframeError({
          type: 'network',
          message: t('iframe.networkError'),
        });
      } else {
        setIframeError({
          type: 'unknown',
          message: t('iframe.unexpectedError'),
        });
      }
      setUrlChecked(true);
    } finally {
      setIsCheckingUrl(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================================
  // Effects
  // ============================================================================

  /**
   * @description Effect: Update iframe source URL when source or locale changes.
   * Appends current locale to URL for internationalization.
   */
  useEffect(() => {
    // Wait for user data to be ready
    if (isUserLoading) return;
    if (!knowledgeBase.config) return;

    // Get sources array based on path type
    const sources = path === 'chat' ? knowledgeBase.config.chatSources : knowledgeBase.config.searchSources;

    // Try to find selected source
    let source = sources.find(s => s.id === selectedSourceId);

    // If not found, try default source
    if (!source) {
      const defaultId = path === 'chat' ? knowledgeBase.config.defaultChatSourceId : knowledgeBase.config.defaultSearchSourceId;
      source = sources.find(s => s.id === defaultId);
    }

    if (source) {
      // Helper to build URL with proper param handling (overwrites existing params)
      const buildUrl = (baseUrl: string, params: Record<string, string | undefined>) => {
        const url = new URL(baseUrl);
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined) {
            url.searchParams.set(key, value); // .set() overwrites existing param
          }
        });
        return url.toString();
      };

      // Build final URL with all params (locale, email, theme)
      try {
        const urlWithParams = buildUrl(source.url, {
          locale: i18n.language,
          email: user?.email,
          theme: resolvedTheme,
          _t: sessionKey.toString(),
        });

        // Only update if URL actually changed
        setIframeSrc(prev => {
          if (prev !== urlWithParams) {
            setUrlChecked(false); // Reset check when URL changes
            return urlWithParams;
          }
          return prev;
        });
      } catch (error) {
        console.error('[RagflowIframe] Invalid source URL:', source.url, error);
        setIframeSrc('');
        setIframeLoading(false);
        setIframeError({
          type: 'unknown',
          message: t('iframe.invalidSourceUrl', 'Invalid Source URL configuration'),
        });
      }
    } else {
      // No source configured
      setIframeSrc('');
      setIframeError({
        type: 'notfound',
        message: t(path === 'chat' ? 'iframe.noChatSourceConfigured' : 'iframe.noSearchSourceConfigured')
      });
    }
  }, [knowledgeBase.config, selectedSourceId, i18n.language, path, user?.email, resolvedTheme, isUserLoading, t, sessionKey]);

  /**
   * @description Effect: Check URL status when iframe source changes.
   * Only check if we haven't already checked (urlChecked) and we have a src.
   * Note: The warmup checks the base URL, so we might skip this if we consider warmup sufficient,
   * but keeping it for the final URL is safer.
   */
  useEffect(() => {
    if (iframeSrc && !urlChecked) {
      checkUrlStatus(iframeSrc);
    }
  }, [iframeSrc, urlChecked, checkUrlStatus]);

  /**
   * @description Effect: Reset loading state when iframe source changes.
   */
  useEffect(() => {
    if (iframeSrc) {
      setIframeLoading(true);
    }
  }, [iframeSrc]);

  /**
   * @description Handler: Called when iframe successfully loads.
   * Logs the load event and clears loading/error states.
   */
  const handleIframeLoad = useCallback(() => {
    console.log('[RagflowIframe] Iframe loaded:', {
      src: iframeSrc,
      user: user?.email || 'anonymous',
    });
    setIframeLoading(false);
    setIframeError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * @description Handler: Called when iframe fails to load.
   * Sets a generic error if no specific error is already set.
   */
  const handleIframeError = useCallback(() => {
    console.error('[RagflowIframe] Iframe failed to load:', iframeSrc);

    // Only set generic error if we don't have a specific one
    if (!iframeError) {
      setIframeError({
        type: 'unknown',
        message: t('iframe.failedToLoad'),
      });
    }
    setIframeLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * @description Handler: Reload the iframe by resetting its source.
   * Uses a small delay to ensure clean reload.
   */
  const handleReload = useCallback(() => {
    if (!iframeSrc) return;

    setIframeLoading(true);
    setIframeError(null);
    setUrlChecked(false);
    if (iframeRef.current) {
      iframeRef.current.src = '';
      // Small timeout to allow the browser to process the empty src
      setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.src = iframeSrc;
        }
      }, 100);
    }
  }, [iframeSrc]);

  /**
   * @description Handler: Toggle full screen mode.
   */
  const toggleFullScreen = useCallback(() => {
    setIsFullScreen(prev => !prev);
  }, []);

  /**
   * @description Handler: Reset the session by updating the timestamp key.
   */
  const handleResetSession = useCallback(() => {
    setSessionKey(Date.now());
    setUrlChecked(false);
    setIframeLoading(true);
  }, []);

  // ============================================================================
  // Render Helpers
  // ============================================================================

  /**
   * @description Render a custom error page based on error type.
   * Each error type has its own icon, colors, and messaging.
   *
   * @param {IframeError} error - The error to display.
   * @returns {JSX.Element} JSX for the error page.
   */
  const renderErrorPage = (error: IframeError) => {
    // Configuration for different error types
    const errorConfigs = {
      network: {
        icon: WifiOff,
        title: t('iframe.connectionFailed'),
        description: t('iframe.connectionFailedDesc'),
        color: 'text-orange-600 dark:text-orange-400',
        bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      },
      forbidden: {
        icon: Lock,
        title: t('iframe.accessDenied'),
        description: t('iframe.accessDeniedDesc'),
        color: 'text-red-600 dark:text-red-400',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
      },
      notfound: {
        icon: FileQuestion,
        title: t('iframe.pageNotFound'),
        description: t('iframe.pageNotFoundDesc'),
        color: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      },
      server: {
        icon: ServerCrash,
        title: t('iframe.serverError'),
        description: t('iframe.serverErrorDesc'),
        color: 'text-purple-600 dark:text-purple-400',
        bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      },
      unknown: {
        icon: AlertCircle,
        title: t('iframe.errorLoading'),
        description: t('iframe.errorLoadingDesc'),
        color: 'text-slate-600 dark:text-slate-400',
        bgColor: 'bg-slate-50 dark:bg-slate-800',
      },
    };

    const config = errorConfigs[error.type];
    const Icon = config.icon;

    return (
      <div className={`w-full h-full flex items-center justify-center ${config.bgColor}`}>
        <div className="text-center max-w-md px-6">
          <Icon className={`w-16 h-16 mx-auto mb-4 ${config.color}`} />
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
            {config.title}
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            {error.message || config.description}
          </p>
          {error.statusCode && (
            <p className="text-sm text-slate-500 dark:text-slate-500 mb-4">
              {t('iframe.errorCode', { code: error.statusCode })}
            </p>
          )}
          {error.type !== 'notfound' && (
            <button
              onClick={handleReload}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              {t('common.retry')}
            </button>
          )}
        </div>
      </div>
    );
  };

  // Loading state for initial knowledge base config
  if (knowledgeBase.isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-slate-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3"></div>
          <div className="text-slate-500 dark:text-slate-400">{t('common.loading')}</div>
        </div>
      </div>
    );
  }

  // Knowledge base initialization error
  if (knowledgeBase.error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-red-50 dark:bg-red-900/20">
        <div className="text-red-600 dark:text-red-400">{knowledgeBase.error}</div>
      </div>
    );
  }

  // Show loading while checking URL
  if (isCheckingUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-slate-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3"></div>
          <div className="text-slate-500 dark:text-slate-400 mb-4">{t('iframe.checkingAvailability')}</div>
          <button
            onClick={handleReload}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 rounded-lg transition-colors text-sm shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {t('common.retry')}
          </button>
        </div>
      </div>
    );
  }

  // Show custom error page if iframe failed to load or URL check failed
  if (iframeError) {
    return renderErrorPage(iframeError);
  }

  // Only render iframe if URL check passed
  if (!urlChecked) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-slate-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3"></div>
          <div className="text-slate-500 dark:text-slate-400 mb-4">{t('iframe.preparingContent')}</div>
          <button
            onClick={handleReload}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 rounded-lg transition-colors text-sm shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {t('common.retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col relative transition-all duration-200 ${isFullScreen ? '!fixed !inset-0 !z-[9999] !w-screen !h-screen !m-0 !rounded-none bg-white dark:bg-slate-900' : 'h-full w-full'}`}>
      <div className="flex-1 overflow-hidden bg-white dark:bg-slate-800 relative">
        {/* Loading overlay when iframe is refreshing or loading content */}
        {iframeLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50 dark:bg-slate-800 z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <div className="text-slate-500 dark:text-slate-400">
                {path === 'chat' ? t('iframe.loadingChat') : t('iframe.loadingSearch')}
              </div>
            </div>
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          title={path === 'chat' ? t('iframe.chatInterface') : t('iframe.searchInterface')}
          className="w-full h-full"
          style={{ border: 'none' }}
          allow="clipboard-read; clipboard-write"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
        />


        {/* Full Screen Bubble Button */}
        <Tooltip title={isFullScreen ? t('common.exitFullScreen') : t('common.fullScreen')} placement="left">
          <button
            onClick={toggleFullScreen}
            className="absolute right-6 p-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-full shadow-lg hover:bg-slate-100 dark:hover:bg-slate-600 transition-all duration-200 z-[100] border border-slate-200 dark:border-slate-600 group cursor-pointer"
            style={{ bottom: '9rem' }}
          >
            {isFullScreen ? (
              <Minimize2 className="w-6 h-6" />
            ) : (
              <Maximize2 className="w-6 h-6" />
            )}
            <span className="sr-only">
              {isFullScreen ? t('common.exitFullScreen') : t('common.fullScreen')}
            </span>
          </button>
        </Tooltip>

        {/* Reset Session Bubble Button - resets unique session key to force reload */}
        <Tooltip title={t('iframe.resetSession')} placement="left">
          <button
            onClick={handleResetSession}
            className="absolute right-6 p-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-full shadow-lg hover:bg-slate-100 dark:hover:bg-slate-600 transition-all duration-200 z-[100] border border-slate-200 dark:border-slate-600 group cursor-pointer"
            style={{ bottom: '12.5rem' }}
          >
            <RotateCcw className="w-6 h-6" />
            <span className="sr-only">
              {t('iframe.resetSession')}
            </span>
          </button>
        </Tooltip>


        {/* Chat Widget for Search Mode */}
        {path === 'search' && chatWidgetUrl && (
          <ChatWidgetEmbed widgetUrl={chatWidgetUrl} />
        )}


      </div>
    </div >
  );
}

export default RagflowIframe;
