/**
 * @fileoverview Floating action buttons for the RagflowIframe.
 * Includes full-screen toggle, reset session, prompt builder (chat mode), and chat widget (search mode).
 * @module features/ai/components/IframeActionButtons
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Maximize2, Minimize2, RotateCcw, Sparkles } from 'lucide-react'
import { Tooltip } from 'antd'
import { ChatWidgetEmbed } from './ChatWidgetEmbed'
import { PromptBuilderModal } from '@/features/glossary/components/PromptBuilderModal'

// ============================================================================
// Props
// ============================================================================

interface IframeActionButtonsProps {
  /** Current path mode */
  path: 'chat' | 'search'
  /** Whether full-screen is active */
  isFullScreen: boolean
  /** Toggle full-screen */
  onToggleFullScreen: () => void
  /** Reset session */
  onResetSession: () => void
  /** Chat widget URL for search mode (null/undefined if not available) */
  chatWidgetUrl?: string | null | undefined
  /** Ref to the iframe for postMessage */
  iframeRef: React.RefObject<HTMLIFrameElement | null>
}

// ============================================================================
// Component
// ============================================================================

/**
 * @description Floating action buttons (FABs) rendered inside the iframe container.
 * Includes full-screen toggle, session reset, prompt builder (chat), and chat widget (search).
 *
 * @param {IframeActionButtonsProps} props - Component props.
 * @returns {JSX.Element} The rendered FABs.
 */
export function IframeActionButtons({
  path,
  isFullScreen,
  onToggleFullScreen,
  onResetSession,
  chatWidgetUrl,
  iframeRef,
}: IframeActionButtonsProps) {
  const { t } = useTranslation()
  const [showPromptBuilder, setShowPromptBuilder] = useState(false)

  return (
    <>
      {/* Full Screen FAB */}
      <Tooltip title={isFullScreen ? t('common.exitFullScreen') : t('common.fullScreen')} placement="left">
        <button
          onClick={onToggleFullScreen}
          className="absolute right-6 p-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-full shadow-lg hover:bg-slate-100 dark:hover:bg-slate-600 transition-all duration-200 z-[100] border border-slate-200 dark:border-slate-600 group cursor-pointer"
          style={{ bottom: '9rem' }}
        >
          {isFullScreen ? <Minimize2 className="w-6 h-6" /> : <Maximize2 className="w-6 h-6" />}
          <span className="sr-only">
            {isFullScreen ? t('common.exitFullScreen') : t('common.fullScreen')}
          </span>
        </button>
      </Tooltip>

      {/* Reset Session FAB */}
      <Tooltip title={t('iframe.resetSession')} placement="left">
        <button
          onClick={onResetSession}
          className="absolute right-6 p-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-full shadow-lg hover:bg-slate-100 dark:hover:bg-slate-600 transition-all duration-200 z-[100] border border-slate-200 dark:border-slate-600 group cursor-pointer"
          style={{ bottom: '12.5rem' }}
        >
          <RotateCcw className="w-6 h-6" />
          <span className="sr-only">{t('iframe.resetSession')}</span>
        </button>
      </Tooltip>

      {/* Chat Widget for Search Mode */}
      {path === 'search' && chatWidgetUrl && (
        <ChatWidgetEmbed widgetUrl={chatWidgetUrl} />
      )}

      {/* Prompt Builder for Chat Mode — FAB + Modal */}
      {path === 'chat' && (
        <>
          <Tooltip title={t('glossary.promptBuilder.title')} placement="left">
            <button
              onClick={() => setShowPromptBuilder(true)}
              className="absolute right-6 p-3 bg-primary text-white rounded-full shadow-lg hover:bg-primary-hover transition-all duration-200 z-[100] cursor-pointer"
              style={{ bottom: '5.5rem' }}
            >
              <Sparkles className="w-6 h-6" />
              <span className="sr-only">{t('glossary.promptBuilder.title')}</span>
            </button>
          </Tooltip>
          <PromptBuilderModal
            open={showPromptBuilder}
            onClose={() => setShowPromptBuilder(false)}
            onApply={(text) => {
              if (iframeRef.current?.contentWindow) {
                iframeRef.current.contentWindow.postMessage(
                  { type: 'INSERT_PROMPT', payload: text },
                  '*'
                )
                console.log('[IframeActionButtons] Sent prompt to iframe:', text.substring(0, 50) + '...')
              }
            }}
          />
        </>
      )}
    </>
  )
}

export default IframeActionButtons
