/**
 * @fileoverview Prompt Builder Modal
 *
 * A modal accessible from AI Chat page that allows users to:
 * 1. Select a glossary task
 * 2. Pick keywords (from all available keywords)
 * 3. Generate a structured prompt
 * 4. Copy the prompt to clipboard (since chat uses an iframe)
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
    Modal, Select, Button, Empty, Spin, Tag
} from 'antd'
import { Copy, Check, Sparkles } from 'lucide-react'
import {
    glossaryApi,
    type GlossaryTask,
    type GlossaryKeyword,
} from '../api/glossaryApi'
import { globalMessage } from '@/app/App'


// ============================================================================
// Props
// ============================================================================

interface PromptBuilderModalProps {
    /** Whether the modal is open */
    open: boolean
    /** Callback when the modal is closed */
    onClose: () => void
}

// ============================================================================
// Component
// ============================================================================

export const PromptBuilderModal = ({ open, onClose }: PromptBuilderModalProps) => {
    const { t } = useTranslation()

    // State
    const [tasks, setTasks] = useState<GlossaryTask[]>([])
    const [keywords, setKeywords] = useState<GlossaryKeyword[]>([])
    const [loading, setLoading] = useState(false)
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
    const [selectedKeywordIds, setSelectedKeywordIds] = useState<string[]>([])
    const [generatedPrompt, setGeneratedPrompt] = useState('')
    const [generating, setGenerating] = useState(false)
    const [copied, setCopied] = useState(false)

    // ========================================================================
    // Data Fetching
    // ========================================================================

    /** Fetch tasks and keywords separately */
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

    useEffect(() => {
        if (open) {
            fetchData()
            // Reset state when opening
            setSelectedTaskId(null)
            setSelectedKeywordIds([])
            setGeneratedPrompt('')
            setCopied(false)
        }
    }, [open, fetchData])

    // ========================================================================
    // Derived Data
    // ========================================================================

    /** Active keywords available for selection */
    const activeKeywords = keywords.filter((k) => k.is_active)

    // ========================================================================
    // Handlers
    // ========================================================================

    const handleTaskChange = (taskId: string) => {
        setSelectedTaskId(taskId)
        setGeneratedPrompt('')
    }

    const handleKeywordChange = (ids: string[]) => {
        setSelectedKeywordIds(ids)
        setGeneratedPrompt('')
    }

    const handleGenerate = async () => {
        if (!selectedTaskId || selectedKeywordIds.length === 0) return

        setGenerating(true)
        try {
            const result = await glossaryApi.generatePrompt(selectedTaskId, selectedKeywordIds)
            setGeneratedPrompt(result.prompt)
        } catch (error) {
            console.error('Error generating prompt:', error)
            globalMessage.error(t('common.error'))
        } finally {
            setGenerating(false)
        }
    }

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

    // ========================================================================
    // Render
    // ========================================================================

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
            width={640}
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
                <div className="flex flex-col gap-4">
                    {/* Step 1: Select Task */}
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
                                .filter((t) => t.is_active)
                                .map((t) => ({
                                    value: t.id,
                                    label: t.name,
                                }))}
                            showSearch
                            filterOption={(input: string, option: { label?: string; value?: string } | undefined) =>
                                (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
                            }
                        />
                    </div>

                    {/* Step 2: Select Keywords (from all keywords, not task-scoped) */}
                    {selectedTaskId && (
                        <div>
                            <label className="text-sm font-medium mb-1 block">
                                {t('glossary.promptBuilder.selectKeywords')}
                            </label>
                            <Select
                                mode="multiple"
                                className="w-full"
                                placeholder={t('glossary.promptBuilder.selectKeywords')}
                                value={selectedKeywordIds}
                                onChange={handleKeywordChange}
                                options={activeKeywords.map((k) => ({
                                    value: k.id,
                                    label: k.name,
                                }))}
                                showSearch
                                filterOption={(input: string, option: { label?: string; value?: string } | undefined) =>
                                    (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
                                }
                                tagRender={(props: { label: React.ReactNode; closable: boolean; onClose: () => void }) => (
                                    <Tag
                                        closable={props.closable}
                                        onClose={props.onClose}
                                        className="mr-1"
                                    >
                                        {props.label}
                                    </Tag>
                                )}
                            />
                        </div>
                    )}

                    {/* Generate Button */}
                    {selectedTaskId && selectedKeywordIds.length > 0 && (
                        <Button
                            type="primary"
                            onClick={handleGenerate}
                            loading={generating}
                            icon={<Sparkles size={16} />}
                            className="self-start"
                        >
                            {t('glossary.promptBuilder.generate')}
                        </Button>
                    )}

                    {/* Generated Prompt */}
                    {generatedPrompt && (
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
                            <pre className="whitespace-pre-wrap text-sm font-mono bg-white dark:bg-slate-900 p-3 rounded border dark:border-slate-700 max-h-[200px] overflow-auto">
                                {generatedPrompt}
                            </pre>
                        </div>
                    )}
                </div>
            )}
        </Modal>
    )
}

export default PromptBuilderModal
