/**
 * @fileoverview Hook for managing RAGFlow iframe state, URL lifecycle, and actions.
 * @module features/ai/hooks/useRagflowIframe
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSharedUser } from '@/features/users'
import { useKnowledgeBase } from '@/features/knowledge-base/context/KnowledgeBaseContext'
import { useSettings } from '@/app/contexts/SettingsContext'
import type { IframeError } from '../types/ai.types'

// ============================================================================
// Return Type
// ============================================================================

export interface UseRagflowIframeReturn {
  /** Ref attached to the iframe element */
  iframeRef: React.RefObject<HTMLIFrameElement | null>
  /** Computed iframe src URL */
  iframeSrc: string
  /** Whether the iframe content is loading */
  iframeLoading: boolean
  /** Current error state (null if no error) */
  iframeError: IframeError | null
  /** Whether the URL availability check is in progress */
  isCheckingUrl: boolean
  /** Whether the URL has been checked */
  urlChecked: boolean
  /** Whether full-screen mode is active */
  isFullScreen: boolean
  /** Chat widget URL for search mode */
  chatWidgetUrl: string | null | undefined
  /** Knowledge base loading state */
  kbLoading: boolean
  /** Knowledge base error */
  kbError: string | null
  /** Handler: iframe loaded successfully */
  handleIframeLoad: () => void
  /** Handler: iframe failed to load */
  handleIframeError: () => void
  /** Handler: reload the iframe */
  handleReload: () => void
  /** Handler: toggle full-screen */
  toggleFullScreen: () => void
  /** Handler: reset session */
  handleResetSession: () => void
}

// ============================================================================
// Hook
// ============================================================================

/**
 * @description Hook encapsulating all RAGFlow iframe state, URL building,
 * availability checking, and action handlers.
 * @param {string} path - 'chat' or 'search'
 * @returns {UseRagflowIframeReturn} Iframe state and handlers.
 */
export const useRagflowIframe = (path: 'chat' | 'search'): UseRagflowIframeReturn => {
  const { t, i18n } = useTranslation()
  const { resolvedTheme } = useSettings()
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // State
  const [iframeSrc, setIframeSrc] = useState<string>('')
  const [iframeLoading, setIframeLoading] = useState(true)
  const [iframeError, setIframeError] = useState<IframeError | null>(null)
  const [isCheckingUrl, setIsCheckingUrl] = useState(false)
  const [urlChecked, setUrlChecked] = useState(false)
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [sessionKey, setSessionKey] = useState<number>(Date.now())

  // External data
  const { user, isLoading: isUserLoading } = useSharedUser()
  const knowledgeBase = useKnowledgeBase()

  // Derived values
  const selectedSourceId = path === 'chat'
    ? knowledgeBase.selectedChatSourceId
    : knowledgeBase.selectedSearchSourceId

  const chatWidgetUrl = path === 'search' && knowledgeBase.config
    ? knowledgeBase.config.searchSources.find(s => s.id === selectedSourceId)?.chat_widget_url
    : null

  // ============================================================================
  // Callbacks
  // ============================================================================

  /**
   * @description Check URL availability before loading iframe.
   * Uses no-cors mode to detect network errors and timeouts.
   * @param {string} url - The URL to check.
   */
  const checkUrlStatus = useCallback(async (url: string) => {
    if (!url) return

    setIsCheckingUrl(true)
    setIframeError(null)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      await fetch(url, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      setUrlChecked(true)
      setIframeError(null)
    } catch (error: any) {
      console.error('[useRagflowIframe] URL check failed:', error)

      if (error.name === 'AbortError') {
        setIframeError({ type: 'network', message: t('iframe.connectionTimeout') })
      } else if (error.message?.includes('REAUTH_REQUIRED')) {
        setIframeError({ type: 'forbidden', message: t('iframe.reauthRequired') })
      } else if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        setIframeError({ type: 'network', message: t('iframe.networkError') })
      } else {
        setIframeError({ type: 'unknown', message: t('iframe.unexpectedError') })
      }
      setUrlChecked(true)
    } finally {
      setIsCheckingUrl(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ============================================================================
  // Effects
  // ============================================================================

  /** Build URL with proper param handling */
  const buildUrl = (baseUrl: string, params: Record<string, string | undefined>) => {
    const url = new URL(baseUrl)
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) url.searchParams.set(key, value)
    })
    return url.toString()
  }

  /** Effect: Update iframe source URL when source, locale, or theme changes */
  useEffect(() => {
    if (isUserLoading) return
    if (!knowledgeBase.config) return

    const sources = path === 'chat'
      ? knowledgeBase.config.chatSources
      : knowledgeBase.config.searchSources

    let source = sources.find(s => s.id === selectedSourceId)
    if (!source) {
      const defaultId = path === 'chat'
        ? knowledgeBase.config.defaultChatSourceId
        : knowledgeBase.config.defaultSearchSourceId
      source = sources.find(s => s.id === defaultId)
    }

    if (source) {
      try {
        const urlWithParams = buildUrl(source.url, {
          locale: i18n.language,
          email: user?.email,
          theme: resolvedTheme,
          _t: sessionKey.toString(),
        })

        setIframeSrc(prev => {
          if (prev !== urlWithParams) {
            setUrlChecked(false)
            return urlWithParams
          }
          return prev
        })
      } catch (error) {
        console.error('[useRagflowIframe] Invalid source URL:', source.url, error)
        setIframeSrc('')
        setIframeLoading(false)
        setIframeError({
          type: 'unknown',
          message: t('iframe.invalidSourceUrl', 'Invalid Source URL configuration'),
        })
      }
    } else {
      setIframeSrc('')
      setIframeError({
        type: 'notfound',
        message: t(
          path === 'chat' ? 'iframe.noChatSourceConfigured' : 'iframe.noSearchSourceConfigured'
        ),
      })
    }
  }, [knowledgeBase.config, selectedSourceId, i18n.language, path, user?.email, resolvedTheme, isUserLoading, t, sessionKey])

  /** Effect: Check URL status when iframe source changes */
  useEffect(() => {
    if (iframeSrc && !urlChecked) {
      checkUrlStatus(iframeSrc)
    }
  }, [iframeSrc, urlChecked, checkUrlStatus])

  /** Effect: Reset loading state when iframe source changes */
  useEffect(() => {
    if (iframeSrc) setIframeLoading(true)
  }, [iframeSrc])

  // ============================================================================
  // Handlers
  // ============================================================================

  /** Handler: Called when iframe successfully loads */
  const handleIframeLoad = useCallback(() => {
    console.log('[useRagflowIframe] Iframe loaded:', { src: iframeSrc, user: user?.email || 'anonymous' })
    setIframeLoading(false)
    setIframeError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Handler: Called when iframe fails to load */
  const handleIframeError = useCallback(() => {
    console.error('[useRagflowIframe] Iframe failed to load:', iframeSrc)
    if (!iframeError) {
      setIframeError({ type: 'unknown', message: t('iframe.failedToLoad') })
    }
    setIframeLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Handler: Reload the iframe */
  const handleReload = useCallback(() => {
    if (!iframeSrc) return
    setIframeLoading(true)
    setIframeError(null)
    setUrlChecked(false)
    if (iframeRef.current) {
      iframeRef.current.src = ''
      setTimeout(() => {
        if (iframeRef.current) iframeRef.current.src = iframeSrc
      }, 100)
    }
  }, [iframeSrc])

  /** Handler: Toggle full-screen mode */
  const toggleFullScreen = useCallback(() => {
    setIsFullScreen(prev => !prev)
  }, [])

  /** Handler: Reset session by updating the timestamp key */
  const handleResetSession = useCallback(() => {
    setSessionKey(Date.now())
    setUrlChecked(false)
    setIframeLoading(true)
  }, [])

  return {
    iframeRef,
    iframeSrc,
    iframeLoading,
    iframeError,
    isCheckingUrl,
    urlChecked,
    isFullScreen,
    chatWidgetUrl,
    kbLoading: knowledgeBase.isLoading,
    kbError: knowledgeBase.error,
    handleIframeLoad,
    handleIframeError,
    handleReload,
    toggleFullScreen,
    handleResetSession,
  }
}
