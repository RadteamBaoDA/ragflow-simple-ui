/**
 * @fileoverview RAGFlow iframe container component with i18n support.
 *
 * Embeds RAGFlow AI Chat or AI Search interfaces in an iframe.
 * Composes from useRagflowIframe hook, IframeErrorPage, and IframeActionButtons.
 *
 * @module features/ai/components/RagflowIframe
 */
import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'
import type { RagflowIframeProps } from '../types/ai.types'
import { useRagflowIframe } from '../hooks/useRagflowIframe'
import { IframeErrorPage } from './IframeErrorPage'
import { IframeActionButtons } from './IframeActionButtons'

// ============================================================================
// Component
// ============================================================================

/**
 * @description RAGFlow iframe container with error handling and loading states.
 * Embeds the RAGFlow Chat or Search interface based on the path prop.
 *
 * @param {RagflowIframeProps} props - Component properties.
 * @param {string} props.path - 'chat' or 'search' to determine which interface to load.
 * @returns {JSX.Element} The rendered iframe container.
 */
function RagflowIframe({ path }: RagflowIframeProps) {
  const { t } = useTranslation()
  const iframe = useRagflowIframe(path)

  // Loading state for initial Knowledge Base config
  if (iframe.kbLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-slate-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3"></div>
          <div className="text-slate-500 dark:text-slate-400">{t('common.loading')}</div>
        </div>
      </div>
    )
  }

  // Knowledge Base initialization error
  if (iframe.kbError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-red-50 dark:bg-red-900/20">
        <div className="text-red-600 dark:text-red-400">{iframe.kbError}</div>
      </div>
    )
  }

  // Checking URL availability
  if (iframe.isCheckingUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-slate-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3"></div>
          <div className="text-slate-500 dark:text-slate-400 mb-4">{t('iframe.checkingAvailability')}</div>
          <button
            onClick={iframe.handleReload}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 rounded-lg transition-colors text-sm shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {t('common.retry')}
          </button>
        </div>
      </div>
    )
  }

  // Error page
  if (iframe.iframeError) {
    return <IframeErrorPage error={iframe.iframeError} onRetry={iframe.handleReload} />
  }

  // Waiting for URL check
  if (!iframe.urlChecked) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-slate-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3"></div>
          <div className="text-slate-500 dark:text-slate-400 mb-4">{t('iframe.preparingContent')}</div>
          <button
            onClick={iframe.handleReload}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 rounded-lg transition-colors text-sm shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {t('common.retry')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col relative transition-all duration-200 ${iframe.isFullScreen ? '!fixed !inset-0 !z-[9999] !w-screen !h-screen !m-0 !rounded-none bg-white dark:bg-slate-900' : 'h-full w-full'}`}>
      <div className="flex-1 overflow-hidden bg-white dark:bg-slate-800 relative">
        {/* Loading overlay */}
        {iframe.iframeLoading && (
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
          ref={iframe.iframeRef}
          src={iframe.iframeSrc}
          title={path === 'chat' ? t('iframe.chatInterface') : t('iframe.searchInterface')}
          className="w-full h-full"
          style={{ border: 'none' }}
          allow="clipboard-read; clipboard-write"
          onLoad={iframe.handleIframeLoad}
          onError={iframe.handleIframeError}
        />

        {/* Action Buttons */}
        <IframeActionButtons
          path={path}
          isFullScreen={iframe.isFullScreen}
          onToggleFullScreen={iframe.toggleFullScreen}
          onResetSession={iframe.handleResetSession}
          chatWidgetUrl={iframe.chatWidgetUrl}
          iframeRef={iframe.iframeRef}
        />
      </div>
    </div>
  )
}

export default RagflowIframe
