/**
 * @fileoverview Visual tokenizer playground page.
 * Composes from useTokenizer hook for all state and logic.
 * @module features/ai/pages/TokenizerPage
 */
import { useTranslation } from 'react-i18next'
import { Eraser, Copy, Check, FileCode } from 'lucide-react'
import { useTokenizer } from '../hooks/useTokenizer'

/**
 * @description Tokenizer playground page. Allows users to input text and
 * visualize how it is tokenized by different models using js-tiktoken.
 *
 * @returns {JSX.Element} The rendered Tokenizer page.
 */
export default function TokenizerPage() {
  const { t } = useTranslation()
  const tok = useTokenizer()

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 p-6 gap-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
          <FileCode className="w-6 h-6 text-primary-600 dark:text-primary-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{t('pages.tokenizer.title')}</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm">{t('pages.tokenizer.description')}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <select
            value={tok.model}
            onChange={(e) => tok.setModel(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
          >
            <optgroup label={t('pages.tokenizer.optGroupOpenAI', 'OpenAI Models')}>
              <option value="gpt-4">GPT-4</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              <option value="text-embedding-ada-002">Text Embedding Ada 002</option>
              <option value="text-davinci-003">GPT-3 (Davinci)</option>
              <option value="text-davinci-002">GPT-3 (Davinci 002)</option>
            </optgroup>
            <optgroup label={t('pages.tokenizer.optGroupOther', 'Other Platforms')}>
              <option value="ollama">Ollama</option>
              <option value="vllm">vLLM</option>
            </optgroup>
          </select>

          <button
            onClick={tok.handleClear}
            className="p-2 text-slate-600 dark:text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title={t('common.clear', 'Clear')}
          >
            <Eraser size={20} />
          </button>
        </div>
      </div>

      {/* Input + Output Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full min-h-0">
        {/* Input */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {t('pages.tokenizer.inputText', 'Input Text')}
          </label>
          <textarea
            value={tok.text}
            onChange={(e) => tok.setText(e.target.value)}
            placeholder={t('pages.tokenizer.placeholder', 'Enter text here to see token count...')}
            className="flex-1 w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
          />
        </div>

        {/* Output */}
        <div className="flex flex-col gap-2 min-h-0">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {t('pages.tokenizer.tokenizedOutput', 'Tokenized Output')}
            </label>
            <div className="flex items-center gap-4">
              <div className="text-sm">
                <span className="font-semibold text-slate-900 dark:text-white">{tok.tokens.length}</span>
                <span className="text-slate-500 dark:text-slate-400 ml-1">{t('pages.tokenizer.tokens', 'tokens')}</span>
              </div>
              <div className="text-sm">
                <span className="font-semibold text-slate-900 dark:text-white">{tok.text.length}</span>
                <span className="text-slate-500 dark:text-slate-400 ml-1">{t('pages.tokenizer.chars', 'chars')}</span>
              </div>
              <button
                onClick={tok.handleCopy}
                className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                title={t('pages.tokenizer.copyTokenIds', 'Copy token IDs')}
              >
                {tok.copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
          </div>

          <div className="flex-1 w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-y-auto font-mono text-sm whitespace-pre-wrap leading-relaxed">
            {tok.isLoading ? (
              <div className="flex items-center justify-center h-full text-slate-400">
                {t('pages.tokenizer.loading', 'Loading tokenizer...')}
              </div>
            ) : tok.text.length === 0 ? (
              <span className="text-slate-400 italic">
                {t('pages.tokenizer.emptyState', 'Tokens will appear here...')}
              </span>
            ) : (
              tok.tokenizedText.map((chunk, idx) => (
                <span
                  key={idx}
                  className={`${chunk.colorClass} inline-block px-0.5 border-l border-white/20`}
                  title={`${t('pages.tokenizer.tokenId', 'Token ID')}: ${chunk.token}`}
                >
                  {chunk.text}
                </span>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
