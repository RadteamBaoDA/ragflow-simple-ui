/**
 * @fileoverview Prompt Builder Modal — Step-by-step prompt creation.
 *
 * Steps:
 *   1. Choose prompt language (EN/JA/VI), defaults to current display language
 *   2. Choose task (searchable across all columns)
 *   3. Choose keywords and input context query
 *
 * Prompt output = 2 lines:
 *   Line 1: task instruction (in selected language)
 *   Line 2: context template with {keyword} replaced by selected keywords
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
    Modal, Select, Button, Empty, Spin, Steps, Input
} from 'antd'
import { Copy, Check, Sparkles, Send } from 'lucide-react'
import {
    glossaryApi,
    type GlossaryTask,
    type GlossaryKeyword,
} from '../api/glossaryApi'
import { globalMessage } from '@/app/App'


// ============================================================================
// Types
// ============================================================================

/** Supported prompt languages */
type PromptLang = 'en' | 'ja' | 'vi'

/** Language option for the select control */
interface LangOption {
    value: PromptLang
    label: string
}

// ============================================================================
// Props
// ============================================================================

interface PromptBuilderModalProps {
    /** Whether the modal is open */
    open: boolean
    /** Callback when the modal is closed */
    onClose: () => void
    /** Optional callback when user applies prompt (receives the prompt text) */
    onApply?: (prompt: string) => void
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Map i18n language code to PromptLang.
 * Falls back to 'en' if the current language is not supported.
 * @param lang - i18n language string
 * @returns Matching PromptLang
 */
const mapI18nLangToPromptLang = (lang: string): PromptLang => {
    if (lang.startsWith('ja')) return 'ja'
    if (lang.startsWith('vi')) return 'vi'
    return 'en'
}

/**
 * Get the task instruction text for a given language, with fallback to EN.
 * @param task - Glossary task
 * @param lang - Selected prompt language
 * @returns Instruction text
 */
const getInstructionByLang = (task: GlossaryTask, lang: PromptLang): string => {
    switch (lang) {
        case 'ja':
            return task.task_instruction_ja || task.task_instruction_en
        case 'vi':
            return task.task_instruction_vi || task.task_instruction_en
        default:
            return task.task_instruction_en
    }
}

// ============================================================================
// Component
// ============================================================================

export const PromptBuilderModal = ({ open, onClose, onApply }: PromptBuilderModalProps) => {
    const { t, i18n } = useTranslation()

    // ── State ──────────────────────────────────────────────────────────────
    const [tasks, setTasks] = useState<GlossaryTask[]>([])
    const [keywords, setKeywords] = useState<GlossaryKeyword[]>([])
    const [loading, setLoading] = useState(false)

    // Step 1: language
    const [selectedLang, setSelectedLang] = useState<PromptLang>('en')

    // Step 2: task
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

    // Step 3: single keyword + context
    const [selectedKeyword, setSelectedKeyword] = useState<string>('')
    const [keywordSearchText, setKeywordSearchText] = useState('')
    const [contextInput, setContextInput] = useState('')

    // Output
    const [generatedPrompt, setGeneratedPrompt] = useState('')
    const [copied, setCopied] = useState(false)

    // ── Language options ────────────────────────────────────────────────────
    const langOptions: LangOption[] = useMemo(() => [
        { value: 'en', label: 'English (EN)' },
        { value: 'ja', label: '日本語 (JA)' },
        { value: 'vi', label: 'Tiếng Việt (VI)' },
    ], [])

    // ── Data Fetching ──────────────────────────────────────────────────────

    /** Fetch tasks and keywords on open */
    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const [tasksData, keywordsData] = await Promise.all([
                glossaryApi.listTasks(),
                glossaryApi.listKeywords(),
            ])
            setTasks(tasksData)
            setKeywords(keywordsData)
        } catch (error) {
            console.error('Error fetching glossary data:', error)
        } finally {
            setLoading(false)
        }
    }, [])

    /** Reset state and fetch data when modal opens */
    useEffect(() => {
        if (open) {
            fetchData()
            // Default language to current display language
            setSelectedLang(mapI18nLangToPromptLang(i18n.language))
            setSelectedTaskId(null)
            setSelectedKeyword('')
            setKeywordSearchText('')
            setContextInput('')
            setGeneratedPrompt('')
            setCopied(false)
        }
    }, [open, fetchData, i18n.language])

    // ── Derived Data ───────────────────────────────────────────────────────

    /** Active keywords available for selection */
    const activeKeywords = keywords.filter((k) => k.is_active)

    /** Currently selected task */
    const selectedTask = tasks.find((t) => t.id === selectedTaskId)

    /** Current step index for the Steps component */
    const currentStep = !selectedTaskId ? 1 : 2

    // ── Task search across all columns ─────────────────────────────────────

    /**
     * Custom filter for the task Select.
     * Matches against name, description, and all instruction fields.
     */
    const taskFilterOption = useCallback(
        (input: string, option: { value?: string } | undefined) => {
            if (!input || !option?.value) return true
            const task = tasks.find((t) => t.id === option.value)
            if (!task) return false

            const search = input.toLowerCase()
            return (
                task.name.toLowerCase().includes(search) ||
                (task.description || '').toLowerCase().includes(search) ||
                task.task_instruction_en.toLowerCase().includes(search) ||
                (task.task_instruction_ja || '').toLowerCase().includes(search) ||
                (task.task_instruction_vi || '').toLowerCase().includes(search) ||
                task.context_template.toLowerCase().includes(search)
            )
        },
        [tasks],
    )

    // ── Handlers ───────────────────────────────────────────────────────────

    /** Step 1: Language changed */
    const handleLangChange = (lang: PromptLang) => {
        setSelectedLang(lang)
        setGeneratedPrompt('')
    }

    /** Step 2: Task changed */
    const handleTaskChange = (taskId: string) => {
        setSelectedTaskId(taskId)
        setSelectedKeyword('')
        setKeywordSearchText('')
        setGeneratedPrompt('')
    }

    /** Step 3: Keyword changed from dropdown */
    const handleKeywordChange = (value: string) => {
        setSelectedKeyword(value)
        setKeywordSearchText('')
        setGeneratedPrompt('')
    }

    /** Handle search text change in keyword select */
    const handleKeywordSearch = (value: string) => {
        setKeywordSearchText(value)
    }

    /**
     * When user presses Enter and no option matched, auto-select the typed text.
     */
    const handleKeywordInputKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && keywordSearchText.trim()) {
            // Check if any option matches exactly
            const exactMatch = activeKeywords.find(
                (k) => k.name.toLowerCase() === keywordSearchText.trim().toLowerCase(),
            )
            if (!exactMatch) {
                // Use the typed text as a custom keyword
                setSelectedKeyword(keywordSearchText.trim())
                setKeywordSearchText('')
                setGeneratedPrompt('')
                e.preventDefault()
                e.stopPropagation()
            }
        }
    }

    /**
     * On blur, if there's unmatched search text, auto-select it as custom keyword.
     */
    const handleKeywordBlur = () => {
        if (keywordSearchText.trim() && !selectedKeyword) {
            setSelectedKeyword(keywordSearchText.trim())
            setKeywordSearchText('')
            setGeneratedPrompt('')
        }
    }

    /** Build keyword options with rich template: name, en_keyword, description */
    const keywordOptions = useMemo(() => {
        return activeKeywords.map((k) => ({
            value: k.name,
            label: (
                <div className="flex flex-col py-1">
                    <span className="font-medium text-sm">{k.name}</span>
                    {(k.en_keyword || k.description) && (
                        <span className="text-xs text-slate-400 truncate">
                            {k.en_keyword && <span className="mr-2">{k.en_keyword}</span>}
                            {k.description && <span>— {k.description}</span>}
                        </span>
                    )}
                </div>
            ),
            searchText: `${k.name} ${k.en_keyword || ''} ${k.description || ''}`.toLowerCase(),
        }))
    }, [activeKeywords])

    /**
     * Build prompt client-side from selected task, language, and keyword + context.
     * Line 1: task instruction (in selected language, fallback to EN)
     * Line 2: context with keyword in quotes
     *   - EN/VI: context + "keyword" at end
     *   - JA: 「keyword」 at beginning + context
     */
    const handleGenerate = () => {
        if (!selectedTask || !selectedKeyword) return

        // Line 1: instruction in selected language
        const instruction = getInstructionByLang(selectedTask, selectedLang)

        // Line 2: build context line with quoted keyword based on language
        const context = contextInput.trim()
        let contextLine: string
        if (selectedLang === 'ja') {
            // JA: keyword at beginning with Japanese quotes
            contextLine = context ? `「${selectedKeyword}」${context}` : `「${selectedKeyword}」`
        } else {
            // EN/VI: keyword at end with double quotes
            contextLine = context ? `${context} "${selectedKeyword}"` : `"${selectedKeyword}"`
        }

        setGeneratedPrompt(`${instruction}\n${contextLine}`)
    }

    /** Copy generated prompt to clipboard */
    const handleCopy = async () => {
        if (!generatedPrompt) return
        try {
            await navigator.clipboard.writeText(generatedPrompt)
            setCopied(true)
            globalMessage.success(t('glossary.promptBuilder.copied'))
            setTimeout(() => setCopied(false), 2000)
        } catch {
            globalMessage.error(t('common.error'))
        }
    }

    // ── Render ─────────────────────────────────────────────────────────────

    return (
        <Modal
            title={
                <div className="flex items-center gap-2">
                    <Sparkles size={18} className="text-blue-500" />
                    <span>{t('glossary.promptBuilder.title')}</span>
                </div>
            }
            open={open}
            onCancel={onClose}
            footer={null}
            width={700}
            destroyOnClose
        >
            {loading ? (
                <div className="flex justify-center py-12">
                    <Spin size="large" />
                </div>
            ) : tasks.length === 0 ? (
                <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={t('common.noData')}
                />
            ) : (
                <div className="flex flex-col gap-5">
                    {/* Progress indicator */}
                    <Steps
                        current={currentStep}
                        size="small"
                        items={[
                            { title: t('glossary.promptBuilder.stepLanguage') },
                            { title: t('glossary.promptBuilder.stepTask') },
                            { title: t('glossary.promptBuilder.stepKeyword') },
                        ]}
                    />

                    {/* Step 1: Choose Prompt Language */}
                    <div>
                        <label className="text-sm font-medium mb-1 block">
                            {t('glossary.promptBuilder.selectLanguage')}
                        </label>
                        <Select
                            className="w-full"
                            value={selectedLang}
                            onChange={handleLangChange}
                            options={langOptions}
                        />
                    </div>

                    {/* Step 2: Choose Task (search across all columns) */}
                    <div>
                        <label className="text-sm font-medium mb-1 block">
                            {t('glossary.promptBuilder.selectTask')}
                        </label>
                        <Select
                            className="w-full"
                            placeholder={t('glossary.promptBuilder.selectTask')}
                            value={selectedTaskId}
                            onChange={handleTaskChange}
                            options={tasks
                                .filter((task) => task.is_active)
                                .map((task) => ({
                                    value: task.id,
                                    label: task.name,
                                }))}
                            showSearch
                            filterOption={taskFilterOption}
                        />
                        {/* Show selected task instruction preview */}
                        {selectedTask && (
                            <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-800 rounded text-xs text-slate-600 dark:text-slate-300 border dark:border-slate-700">
                                <span className="font-medium">{t('glossary.promptBuilder.instructionPreview')}:</span>{' '}
                                {getInstructionByLang(selectedTask, selectedLang)}
                            </div>
                        )}
                    </div>

                    {/* Step 3: Choose Keyword + Context */}
                    {selectedTaskId && (
                        <div>
                            <label className="text-sm font-medium mb-1 block">
                                {t('glossary.promptBuilder.selectKeyword')}
                            </label>
                            <Select
                                className="w-full"
                                placeholder={t('glossary.promptBuilder.selectKeyword')}
                                value={selectedKeyword || undefined}
                                onChange={handleKeywordChange}
                                onSearch={handleKeywordSearch}
                                onBlur={handleKeywordBlur}
                                onInputKeyDown={handleKeywordInputKeyDown}
                                searchValue={keywordSearchText}
                                options={keywordOptions}
                                showSearch
                                allowClear
                                filterOption={(input: string, option: any) =>
                                    option?.searchText?.includes(input.toLowerCase()) ?? false
                                }
                                optionLabelProp="value"
                                notFoundContent={
                                    keywordSearchText.trim() ? (
                                        <div className="text-xs text-slate-400 py-2 text-center">
                                            {t('glossary.promptBuilder.pressEnterToUse', { keyword: keywordSearchText.trim() })}
                                        </div>
                                    ) : undefined
                                }
                            />

                            {/* Context input */}
                            <div className="mt-3">
                                <label className="text-sm font-medium mb-1 block">
                                    {t('glossary.promptBuilder.contextLabel')}
                                </label>
                                <Input.TextArea
                                    placeholder={t('glossary.promptBuilder.contextPlaceholder')}
                                    value={contextInput}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => { setContextInput(e.target.value); setGeneratedPrompt('') }}
                                    rows={2}
                                    className="w-full"
                                />
                            </div>
                        </div>
                    )}

                    {/* Generate Button */}
                    {selectedTaskId && selectedKeyword && (
                        <Button
                            type="primary"
                            onClick={handleGenerate}
                            icon={<Sparkles size={16} />}
                            className="self-start"
                        >
                            {t('glossary.promptBuilder.generate')}
                        </Button>
                    )}

                    {/* Generated Prompt (2 lines: instruction + context) */}
                    {generatedPrompt && (
                        <>
                            <div className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-800 dark:border-slate-600">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium">
                                        {t('glossary.promptBuilder.generatedPrompt')}
                                    </span>
                                    <Button
                                        type="text"
                                        size="small"
                                        icon={copied ? <Check size={14} /> : <Copy size={14} />}
                                        onClick={handleCopy}
                                        className={copied ? 'text-green-500' : ''}
                                    >
                                        {copied ? t('glossary.promptBuilder.copied') : t('glossary.promptBuilder.copy')}
                                    </Button>
                                </div>
                                <Input.TextArea
                                    value={generatedPrompt}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setGeneratedPrompt(e.target.value)}
                                    className="text-sm font-mono"
                                    autoSize={{ minRows: 2, maxRows: 8 }}
                                />
                            </div>

                            {/* Apply to Chat button */}
                            <Button
                                type="primary"
                                icon={<Send size={16} />}
                                onClick={() => {
                                    if (onApply) onApply(generatedPrompt)
                                    globalMessage.success(t('glossary.promptBuilder.appliedToChat'))
                                    onClose()
                                }}
                                className="self-start"
                            >
                                {t('glossary.promptBuilder.applyToChat')}
                            </Button>
                        </>
                    )}
                </div>
            )}
        </Modal>
    )
}

export default PromptBuilderModal
