import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { encodingForModel, getEncoding, Tiktoken } from 'js-tiktoken';
import { Eraser, Copy, Check } from 'lucide-react';

/**
 * @description Visual tokenizer playground component.
 * Allows users to input text and see how it is tokenized by different OpenAI and Ollama models.
 * Uses `js-tiktoken` for client-side tokenization.
 *
 * @returns {JSX.Element} The rendered Tokenizer page.
 */
const TokenizerPage = () => {
    const { t } = useTranslation();
    const [text, setText] = useState('');
    const [model, setModel] = useState('gpt-4');
    const [tokens, setTokens] = useState<number[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [encoding, setEncoding] = useState<Tiktoken | null>(null);
    const [copied, setCopied] = useState(false);

    /**
     * @description Effect to initialize the tokenizer encoder based on the selected model.
     * Maps the model name to the appropriate encoding scheme (e.g., cl100k_base, p50k_base).
     */
    useEffect(() => {
        setIsLoading(true);
        let enc: Tiktoken | null = null;
        try {
            // OpenAI models with specific encodings
            if (model === 'gpt-4' || model === 'gpt-3.5-turbo') {
                // Use encodingForModel for specific OpenAI models
                enc = encodingForModel(model as 'gpt-4' | 'gpt-3.5-turbo');
            } else if (model === 'text-davinci-003' || model === 'text-davinci-002') {
                // Use p50k_base for older GPT-3 models
                enc = getEncoding('p50k_base');
            } else if (model === 'text-embedding-ada-002') {
                // Use cl100k_base for embeddings
                enc = getEncoding('cl100k_base');
            }
            // Ollama and vLLM - use cl100k_base as a common default
            else if (model === 'ollama' || model === 'vllm') {
                enc = getEncoding('cl100k_base');
            }
            // Default fallback encoding
            else {
                enc = getEncoding('cl100k_base');
            }
            setEncoding(enc);
        } catch (e) {
            console.error('Failed to load encoding:', e);
        } finally {
            // Ensure loading state is turned off
            setIsLoading(false);
        }
    }, [model]);

    /**
     * @description Effect to update token counts whenever the input text or encoding changes.
     * Encodes the text into integer tokens.
     */
    useEffect(() => {
        if (!encoding || !text) {
            // Reset tokens if no text or encoding is available
            setTokens([]);
            return;
        }
        try {
            // Encode the text using the selected encoding
            const encoded = encoding.encode(text);
            setTokens(encoded);
        } catch (e) {
            console.error("Encoding error", e);
            setTokens([]);
        }
    }, [text, encoding]);

    /**
     * @description Handler to clear the input text and reset token state.
     */
    const handleClear = () => {
        setText('');
        setTokens([]);
    };

    /**
     * @description Handler to copy the token array to the clipboard.
     * Shows a brief success indicator.
     */
    const handleCopy = () => {
        navigator.clipboard.writeText(JSON.stringify(tokens));
        setCopied(true);
        // Reset the copied state after 2 seconds
        setTimeout(() => setCopied(false), 2000);
    };

    // Pastel colors for token highlighting
    const colors = [
        'bg-sky-200 dark:bg-sky-900/50',
        'bg-amber-200 dark:bg-amber-900/50',
        'bg-emerald-200 dark:bg-emerald-900/50',
        'bg-rose-200 dark:bg-rose-900/50',
        'bg-violet-200 dark:bg-violet-900/50',
    ];

    /**
     * @description Memoized calculation of display chunks for the tokenized text.
     * Decodes each token back to its string representation and assigns a color for visualization.
     *
     * @returns {Array<{token: number, text: string, colorClass: string}>} Array of token chunks for rendering.
     */
    const tokenizedText = useMemo(() => {
        if (!encoding) return [];

        const chunks: { token: number, text: string, colorClass: string }[] = [];
        let currentColorIndex = 0;

        // Decode each token individually to visualize them
        for (const token of tokens) {
            const displayDecoded = encoding.decode([token]);

            chunks.push({
                token,
                text: displayDecoded,
                // Cycle through colors for distinct token visualization
                colorClass: colors[currentColorIndex % colors.length] ?? colors[0] ?? ''
            });
            currentColorIndex++;
        }
        return chunks;
    }, [tokens, encoding]);

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 p-6 gap-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <p className="text-slate-600 dark:text-slate-400">
                    {t('pages.tokenizer.description', 'Calculate token counts for OpenAI, Ollama, and vLLM models')}
                </p>

                <div className="flex items-center gap-3">
                    <select
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
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
                        onClick={handleClear}
                        className="p-2 text-slate-600 dark:text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        title={t('common.clear', 'Clear')}
                    >
                        <Eraser size={20} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full min-h-0">
                {/* Input Section */}
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {t('pages.tokenizer.inputText', 'Input Text')}
                    </label>
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder={t('pages.tokenizer.placeholder', 'Enter text here to see token count...')}
                        className="flex-1 w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                </div>

                {/* Output Section */}
                <div className="flex flex-col gap-2 min-h-0">
                    <div className="flex justify-between items-center">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {t('pages.tokenizer.tokenizedOutput', 'Tokenized Output')}
                        </label>
                        <div className="flex items-center gap-4">
                            <div className="text-sm">
                                <span className="font-semibold text-slate-900 dark:text-white">{tokens.length}</span>
                                <span className="text-slate-500 dark:text-slate-400 ml-1">
                                    {t('pages.tokenizer.tokens', 'tokens')}
                                </span>
                            </div>
                            <div className="text-sm">
                                <span className="font-semibold text-slate-900 dark:text-white">{text.length}</span>
                                <span className="text-slate-500 dark:text-slate-400 ml-1">
                                    {t('pages.tokenizer.chars', 'chars')}
                                </span>
                            </div>
                            <button
                                onClick={handleCopy}
                                className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                                title={t('pages.tokenizer.copyTokenIds', 'Copy token IDs')}
                            >
                                {copied ? <Check size={16} /> : <Copy size={16} />}
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-y-auto font-mono text-sm whitespace-pre-wrap leading-relaxed">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-full text-slate-400">
                                {t('pages.tokenizer.loading', 'Loading tokenizer...')}
                            </div>
                        ) : text.length === 0 ? (
                            <span className="text-slate-400 italic">
                                {t('pages.tokenizer.emptyState', 'Tokens will appear here...')}
                            </span>
                        ) : (
                            tokenizedText.map((chunk, idx) => (
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
    );
};

export default TokenizerPage;
