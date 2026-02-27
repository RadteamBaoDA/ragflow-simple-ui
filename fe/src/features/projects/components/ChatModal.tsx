/**
 * @fileoverview Modal form for creating/updating a chat assistant with full RAGFlow config.
 *
 * Matches RAGFlow's native chat settings UI:
 * - Name, Description, Empty Response, Opener, Show Quote
 * - Keyword Analysis, TTS, Refine Multi-turn
 * - Datasets (category-level selection)
 * - System Prompt, Similarity Threshold, Keywords Similarity Weight, Top N
 * - Model, Temperature, Top P, Presence Penalty, Frequency Penalty, Max Tokens
 *
 * Field mapping to RAGFlow SDK:
 *   Frontend `prompt_config` → Backend sends as `prompt` → RAGFlow maps internally
 *   Frontend `llm_config` → Backend sends as `llm` → RAGFlow maps internally
 *
 * @module features/projects/components/ChatModal
 */

import { useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Modal,
  Form,
  Input,
  Checkbox,
  Collapse,
  Slider,
  InputNumber,
  Switch,
  Typography,
  Alert,
  Select,
  Divider,
  Button,
} from 'antd'
import type { FormInstance, FormListFieldData, FormListOperation } from 'antd'
import type {
  DocumentCategory,
  DocumentCategoryVersion,
  ProjectChat,
} from '../api/projectService'

const { TextArea } = Input
const { Text } = Typography

// ============================================================================
// Constants
// ============================================================================

/** Default system prompt matching RAGFlow's chat.py default */
const DEFAULT_SYSTEM_PROMPT = `You are an intelligent assistant. Please summarize the content of the dataset to answer the question. Please list the data in the dataset and answer in detail. When all dataset content is irrelevant to the question, your answer must include the sentence "The answer you are looking for is not found in the dataset!" Answers need to consider chat history.
  Here is the knowledge base:
  {knowledge}
  The above is the knowledge base.`

/** Default opener matching RAGFlow's default prologue */
const DEFAULT_OPENER = "Hi! I'm your assistant. What can I do for you?"

/** Default empty response */
const DEFAULT_EMPTY_RESPONSE = 'Sorry! No relevant content was found in the knowledge base!'

/** Creativity presets matching RAGFlow's native UI */
const CREATIVITY_PRESETS: Record<string, {
  temperature: number
  top_p: number
  presence_penalty: number
  frequency_penalty: number
}> = {
  improvise: { temperature: 0.8, top_p: 0.9, presence_penalty: 0.1, frequency_penalty: 0.1 },
  precise:   { temperature: 0.2, top_p: 0.75, presence_penalty: 0.5, frequency_penalty: 0.5 },
  balance:   { temperature: 0.5, top_p: 0.85, presence_penalty: 0.2, frequency_penalty: 0.3 },
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Custom control for Vector Similarity Weight that shows dual labels
 * (vector X.XX / full-text X.XX) above the slider, matching RAGFlow's UI.
 *
 * @param props - value + onChange from antd Form binding
 * @returns {JSX.Element} The weight control
 */
const VectorWeightControl = ({
  value = 0.3,
  onChange,
}: {
  value?: number
  onChange?: (val: number) => void
}) => {
  const vectorVal = (1 - value).toFixed(2)
  const fulltextVal = value.toFixed(2)

  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>vector <strong>{vectorVal}</strong></span>
        <span>full-text <strong>{fulltextVal}</strong></span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={value}
            onChange={onChange}
          />
        </div>
        <InputNumber
          min={0}
          max={1}
          step={0.01}
          value={value}
          onChange={(v: number | null) => onChange?.(v ?? 0)}
          style={{ width: 70 }}
        />
      </div>
    </div>
  )
}

/**
 * Reusable Slider + InputNumber combo as a single controlled component.
 * Avoids the infinite re-render loop caused by two Form.Items sharing the same name.
 *
 * @param props - min, max, step, inputWidth, value, onChange from antd Form binding
 * @returns {JSX.Element} Slider with paired InputNumber
 */
const SliderInput = ({
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  inputWidth = 70,
}: {
  value?: number
  onChange?: (val: number) => void
  min?: number
  max?: number
  step?: number
  inputWidth?: number
}) => (
  <div className="flex items-center gap-3">
    <div className="flex-1">
      <Slider
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        tooltip={{ formatter: (v?: number) => `${v}` }}
      />
    </div>
    <InputNumber
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(v: number | null) => onChange?.(v ?? min)}
      style={{ width: inputWidth }}
    />
  </div>
)

/**
 * Specialized control for Max Tokens.
 * The Slider is capped at 8192 for a smooth drag experience,
 * while the InputNumber allows values up to 128000.
 *
 * @param props - value + onChange from antd Form binding
 * @returns {JSX.Element} Slider + InputNumber combo
 */
const MaxTokensControl = ({
  value = 512,
  onChange,
}: {
  value?: number
  onChange?: (val: number) => void
}) => {
  /** Slider max is capped for usability; InputNumber allows the full range */
  const SLIDER_MAX = 8192
  const INPUT_MAX = 128000

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <Slider
          min={1}
          max={SLIDER_MAX}
          step={1}
          value={Math.min(value, SLIDER_MAX)}
          onChange={onChange}
        />
      </div>
      <InputNumber
        min={1}
        max={INPUT_MAX}
        step={1}
        value={value}
        onChange={(v: number | null) => onChange?.(v ?? 512)}
        style={{ width: 80 }}
      />
    </div>
  )
}

// ============================================================================
// Types
// ============================================================================

/**
 * Props for the ChatModal component.
 */
interface ChatModalProps {
  /** Whether the modal is visible */
  open: boolean
  /** Form instance managed by parent */
  form: FormInstance
  /** Whether the submit action is in progress */
  saving: boolean
  /** Callback when the user confirms */
  onOk: () => void
  /** Callback when the user cancels or closes */
  onCancel: () => void
  /** Project document categories */
  categories: DocumentCategory[]
  /** Map of category ID → its versions (pre-fetched) */
  categoryVersions: Record<string, DocumentCategoryVersion[]>
  /** Available chat models from the RAGFlow server config */
  chatModels: string[]
  /** Existing chat data for edit mode (null = create mode) */
  editingChat: ProjectChat | null
}

// ============================================================================
// Component
// ============================================================================

/**
 * Modal dialog with a full form for creating/editing a chat assistant.
 * Matches RAGFlow's native chat settings UI layout.
 *
 * @param {ChatModalProps} props - Component props
 * @returns {JSX.Element} The rendered modal
 */
const ChatModal = ({
  open,
  form,
  saving,
  onOk,
  onCancel,
  categories,
  categoryVersions,
  chatModels,
  editingChat,
}: ChatModalProps) => {
  const { t } = useTranslation()

  /** Determine if we are in edit mode */
  const isEditing = !!editingChat

  /**
   * Populate form with existing chat data when editing.
   */
  useEffect(() => {
    if (editingChat && open) {
      // Resolve which categories are linked (reverse: version IDs → category IDs)
      const linkedCategoryIds: string[] = []
      for (const [catId, versions] of Object.entries(categoryVersions)) {
        const hasLinked = versions.some(
          (v) => editingChat.dataset_ids?.includes(v.id)
        )
        if (hasLinked) linkedCategoryIds.push(catId)
      }

      form.setFieldsValue({
        name: editingChat.name,
        description: editingChat.prompt_config?.description || '',
        category_ids: linkedCategoryIds,
        prompt_config: {
          empty_response: editingChat.prompt_config?.empty_response || DEFAULT_EMPTY_RESPONSE,
          opener: editingChat.prompt_config?.opener || DEFAULT_OPENER,
          show_quote: editingChat.prompt_config?.show_quote ?? true,
          keyword: editingChat.prompt_config?.keyword ?? false,
          tts: editingChat.prompt_config?.tts ?? false,
          refine_multiturn: editingChat.prompt_config?.refine_multiturn ?? false,
          prompt: editingChat.prompt_config?.prompt || DEFAULT_SYSTEM_PROMPT,
          similarity_threshold: editingChat.prompt_config?.similarity_threshold ?? 0.2,
          keywords_similarity_weight: editingChat.prompt_config?.keywords_similarity_weight ?? 0.7,
          top_n: editingChat.prompt_config?.top_n ?? 6,
        },
        llm_config: {
          model_name: editingChat.llm_config?.model_name || undefined,
          temperature: editingChat.llm_config?.temperature ?? 0.1,
          top_p: editingChat.llm_config?.top_p ?? 0.3,
          presence_penalty: editingChat.llm_config?.presence_penalty ?? 0.4,
          frequency_penalty: editingChat.llm_config?.frequency_penalty ?? 0.7,
          max_tokens: editingChat.llm_config?.max_tokens ?? 512,
        },
      })
    }
  }, [editingChat, open, form, categoryVersions])

  /**
   * Build checkbox options from categories.
   * Each option shows the category name + count of active datasets.
   */
  const categoryOptions = useMemo(() => {
    return categories.map((cat) => {
      const versions = categoryVersions[cat.id] || []
      const activeCount = versions.filter(
        (v) => v.ragflow_dataset_id && v.status === 'active'
      ).length
      return {
        label: `${cat.name} (${activeCount} dataset${activeCount !== 1 ? 's' : ''})`,
        value: cat.id,
        disabled: activeCount === 0,
      }
    })
  }, [categories, categoryVersions])

  /** Check if any category has active datasets */
  const hasAnyDatasets = categoryOptions.some((opt) => !opt.disabled)

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <Modal
      title={isEditing
        ? t('projectManagement.chats.edit')
        : t('projectManagement.chats.add')
      }
      open={open}
      onOk={onOk}
      onCancel={onCancel}
      confirmLoading={saving}
      destroyOnHidden
      width={640}
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
    >
      <Form
        form={form}
        layout="vertical"
        className="mt-4"
        initialValues={{
          prompt_config: {
            empty_response: DEFAULT_EMPTY_RESPONSE,
            opener: DEFAULT_OPENER,
            show_quote: true,
            keyword: false,
            tts: false,
            refine_multiturn: false,
            prompt: DEFAULT_SYSTEM_PROMPT,
            similarity_threshold: 0.2,
            keywords_similarity_weight: 0.7,
            top_n: 6,
          },
          llm_config: {
            temperature: 0.1,
            top_p: 0.3,
            presence_penalty: 0.4,
            frequency_penalty: 0.7,
            max_tokens: 512,
          },
        }}
      >
        {/* ══════════════════════════════════════════════════════════
            SECTION 1: Chat Setting (basic)
        ══════════════════════════════════════════════════════════ */}

        {/* Name */}
        <Form.Item
          name="name"
          label={t('projectManagement.chats.name')}
          rules={[{ required: true }]}
        >
          <Input placeholder={t('projectManagement.chats.namePlaceholder')} />
        </Form.Item>

        {/* Description */}
        <Form.Item
          name="description"
          label={t('projectManagement.chats.description')}
        >
          <Input placeholder={t('projectManagement.chats.descriptionPlaceholder')} />
        </Form.Item>

        {/* Empty Response */}
        <Form.Item
          name={['prompt_config', 'empty_response']}
          label={t('projectManagement.chats.emptyResponse')}
        >
          <TextArea rows={2} />
        </Form.Item>

        {/* Opener (prologue / Opening greeting) */}
        <Form.Item
          name={['prompt_config', 'opener']}
          label={t('projectManagement.chats.opener')}
        >
          <TextArea rows={3} />
        </Form.Item>

        {/* Toggle flags row */}
        <div className="flex flex-wrap gap-6 mb-4">
          <Form.Item
            name={['prompt_config', 'show_quote']}
            label={t('projectManagement.chats.showQuote')}
            valuePropName="checked"
            className="mb-0"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            name={['prompt_config', 'keyword']}
            label={t('projectManagement.chats.keywordAnalysis')}
            valuePropName="checked"
            className="mb-0"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            name={['prompt_config', 'tts']}
            label={t('projectManagement.chats.tts')}
            valuePropName="checked"
            className="mb-0"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            name={['prompt_config', 'refine_multiturn']}
            label={t('projectManagement.chats.refineMultiturn')}
            valuePropName="checked"
            className="mb-0"
          >
            <Switch />
          </Form.Item>
        </div>

        <Divider />

        {/* ══════════════════════════════════════════════════════════
            SECTION 2: Datasets (category selection)
        ══════════════════════════════════════════════════════════ */}
        <Form.Item
          name="category_ids"
          label={t('projectManagement.chats.selectCategories')}
          rules={[{ required: true, message: t('projectManagement.chats.selectCategories') }]}
        >
          {hasAnyDatasets ? (
            <Checkbox.Group options={categoryOptions} className="flex flex-col gap-2" />
          ) : (
            <Alert
              message={t('projectManagement.chats.noActiveDatasets')}
              type="warning"
              showIcon
            />
          )}
        </Form.Item>

        <Divider />

        {/* ══════════════════════════════════════════════════════════
            SECTION 3: Prompt / Retrieval Configuration
        ══════════════════════════════════════════════════════════ */}
        <Collapse
          ghost
          defaultActiveKey={[]}
          items={[
            {
              key: 'prompt',
              label: <Text strong>{t('projectManagement.chats.promptSection')}</Text>,
              children: (
                <>
                  {/* System Prompt */}
                  <Form.Item
                    name={['prompt_config', 'prompt']}
                    label={t('projectManagement.chats.systemPrompt')}
                  >
                    <TextArea rows={6} />
                  </Form.Item>

                  {/* Similarity Threshold — slider + input */}
                  <Form.Item
                    name={['prompt_config', 'similarity_threshold']}
                    label={t('projectManagement.chats.similarityThreshold')}
                  >
                    <SliderInput min={0} max={1} step={0.01} />
                  </Form.Item>

                  {/* Vector Similarity Weight — dual labels + slider + input */}
                  <Form.Item label={t('projectManagement.chats.vectorSimilarityWeight')}>
                    <Form.Item name={['prompt_config', 'keywords_similarity_weight']} noStyle>
                      {/* Use a custom render to show vector/full-text labels */}
                      <VectorWeightControl />
                    </Form.Item>
                  </Form.Item>

                  {/* Top N — slider + input */}
                  <Form.Item
                    name={['prompt_config', 'top_n']}
                    label={t('projectManagement.chats.topN')}
                  >
                    <SliderInput min={1} max={100} step={1} />
                  </Form.Item>

                  {/* Rerank Model */}
                  <Form.Item
                    name={['prompt_config', 'rerank_model']}
                    label={t('projectManagement.chats.rerankModel')}
                  >
                    <Input
                      allowClear
                      placeholder={t('projectManagement.chats.rerankModelPlaceholder')}
                    />
                  </Form.Item>

                  {/* Cross-language Search */}
                  <Form.Item
                    name={['prompt_config', 'cross_languages']}
                    label={t('projectManagement.chats.crossLanguages')}
                  >
                    <Select
                      mode="tags"
                      allowClear
                      placeholder={t('projectManagement.chats.crossLanguagesPlaceholder')}
                      options={[
                        { label: 'English', value: 'English' },
                        { label: 'Chinese', value: 'Chinese' },
                        { label: 'Japanese', value: 'Japanese' },
                        { label: 'Vietnamese', value: 'Vietnamese' },
                        { label: 'Korean', value: 'Korean' },
                        { label: 'French', value: 'French' },
                        { label: 'German', value: 'German' },
                        { label: 'Spanish', value: 'Spanish' },
                      ]}
                    />
                  </Form.Item>

                  {/* Variables (maps to prompt_config.parameters in RAGFlow) */}
                  <Form.Item label={t('projectManagement.chats.variables')}>
                    <Form.List name={['prompt_config', 'variables']}>
                      {(fields: FormListFieldData[], { add, remove }: FormListOperation) => (
                        <>
                          {fields.map((field) => (
                            <div key={field.key} className="flex items-center gap-2 mb-2">
                              <Form.Item
                                {...field}
                                name={[field.name, 'key']}
                                noStyle
                                rules={[{ required: true, message: 'Key required' }]}
                              >
                                <Input placeholder="Key" style={{ width: 160 }} />
                              </Form.Item>
                              <span className="text-xs text-gray-400">
                                {t('projectManagement.chats.variableOptional')}
                              </span>
                              <Form.Item
                                {...field}
                                name={[field.name, 'optional']}
                                noStyle
                                valuePropName="checked"
                              >
                                <Switch size="small" />
                              </Form.Item>
                              <Button
                                type="text"
                                size="small"
                                danger
                                onClick={() => remove(field.name)}
                              >
                                ×
                              </Button>
                            </div>
                          ))}
                          <Button type="dashed" size="small" onClick={() => add({ key: '', optional: false })}>
                            + {t('projectManagement.chats.addVariable')}
                          </Button>
                        </>
                      )}
                    </Form.List>
                  </Form.Item>
                </>
              ),
            },
          ]}
        />

        <Divider />

        {/* ══════════════════════════════════════════════════════════
            SECTION 4: LLM Configuration
        ══════════════════════════════════════════════════════════ */}
        <Collapse
          ghost
          defaultActiveKey={[]}
          items={[
            {
              key: 'llm',
              label: <Text strong>{t('projectManagement.chats.llmSection')}</Text>,
              children: (
                <>
                  {/* Model */}
                  <Form.Item
                    name={['llm_config', 'model_name']}
                    label={t('projectManagement.chats.modelName')}
                  >
                    <Select
                      showSearch
                      allowClear
                      placeholder={t('projectManagement.chats.selectModel')}
                      options={chatModels.map((m) => ({ label: m, value: m }))}
                      notFoundContent={t('projectManagement.chats.noModels')}
                    />
                  </Form.Item>

                  {/* Creativity — preset dropdown */}
                  <Form.Item
                    label={t('projectManagement.chats.creativity')}
                  >
                    <Select
                      allowClear
                      placeholder={t('projectManagement.chats.selectCreativity')}
                      options={[
                        { label: t('projectManagement.chats.creativityImprovise'), value: 'improvise' },
                        { label: t('projectManagement.chats.creativityPrecise'), value: 'precise' },
                        { label: t('projectManagement.chats.creativityBalance'), value: 'balance' },
                        { label: t('projectManagement.chats.creativityCustom'), value: 'custom' },
                      ]}
                      onChange={(val: string) => {
                        if (val && val !== 'custom' && CREATIVITY_PRESETS[val]) {
                          form.setFieldsValue({ llm_config: CREATIVITY_PRESETS[val] })
                        }
                      }}
                    />
                  </Form.Item>

                  {/* Temperature — slider + input */}
                  <Form.Item
                    name={['llm_config', 'temperature']}
                    label={t('projectManagement.chats.temperature')}
                  >
                    <SliderInput min={0} max={1} step={0.01} />
                  </Form.Item>

                  {/* Top P — slider + input */}
                  <Form.Item
                    name={['llm_config', 'top_p']}
                    label={t('projectManagement.chats.topP')}
                  >
                    <SliderInput min={0} max={1} step={0.01} />
                  </Form.Item>

                  {/* Presence Penalty — slider + input */}
                  <Form.Item
                    name={['llm_config', 'presence_penalty']}
                    label={t('projectManagement.chats.presencePenalty')}
                  >
                    <SliderInput min={0} max={1} step={0.01} />
                  </Form.Item>

                  {/* Frequency Penalty — slider + input */}
                  <Form.Item
                    name={['llm_config', 'frequency_penalty']}
                    label={t('projectManagement.chats.frequencyPenalty')}
                  >
                    <SliderInput min={0} max={1} step={0.01} />
                  </Form.Item>, 

                  {/* Max Tokens — slider capped at 8192 for UX, input accepts up to 128000 */}
                  <Form.Item
                    name={['llm_config', 'max_tokens']}
                    label={t('projectManagement.chats.maxTokens')}
                  >
                    <MaxTokensControl />
                  </Form.Item>
                </>
              ),
            },
          ]}
        />
      </Form>
    </Modal>
  )
}

export default ChatModal
