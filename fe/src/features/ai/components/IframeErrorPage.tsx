/**
 * @fileoverview Error page component for iframe loading failures.
 * @module features/ai/components/IframeErrorPage
 */
import { useTranslation } from 'react-i18next'
import {
  AlertCircle,
  RefreshCw,
  WifiOff,
  Lock,
  FileQuestion,
  ServerCrash,
} from 'lucide-react'
import type { IframeError } from '../types/ai.types'

// ============================================================================
// Props
// ============================================================================

interface IframeErrorPageProps {
  /** The error to display */
  error: IframeError
  /** Handler to retry loading */
  onRetry: () => void
}

// ============================================================================
// Component
// ============================================================================

/**
 * @description Renders a custom error page based on error type.
 * Each error type has its own icon, colors, and messaging.
 *
 * @param {IframeErrorPageProps} props - Component props.
 * @returns {JSX.Element} The rendered error page.
 */
export function IframeErrorPage({ error, onRetry }: IframeErrorPageProps) {
  const { t } = useTranslation()

  /** Configuration map for different error types */
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
  }

  const config = errorConfigs[error.type]
  const Icon = config.icon

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
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            {t('common.retry')}
          </button>
        )}
      </div>
    </div>
  )
}

export default IframeErrorPage
