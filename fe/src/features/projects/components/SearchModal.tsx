/**
 * @fileoverview Modal form for creating/updating an AI Search app with full RAGFlow config.
 *
 * Matches RAGFlow's search settings UI:
 * - Name, Description
 * - Datasets (category-level selection)
 * - Similarity Threshold, Vector Similarity Weight
 * - Rerank Model, AI Summary toggle
 * - LLM config (Model, Temperature, Top P, Presence Penalty, Frequency Penalty)
 *
 * @module features/projects/components/SearchModal
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
  Select,
  Divider,
} from 'antd'
import type { FormInstance } from 'antd'
import type {
  DocumentCategory,
  DocumentCategoryVersion,
  ProjectSearch,
} from '../api/projectService'

const { TextArea } = Input
const { Text } = Typography

// ============================================================================
// Constants
// ============================================================================

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
 * Custom slider + input control that shows the value on the right.
 */
const SliderInput = ({
  value = 0,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
}: {
  value?: number
  onChange?: (val: number) => void
  min?: number
  max?: number
  step?: number
}) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
    <Slider
      style={{ flex: 1 }}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={onChange}
    />
    <InputNumber
      style={{ width: 72 }}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(v: number | null) => onChange?.(v ?? min)}
      size="small"
    />
  </div>
)

/**
 * Custom control for Vector Similarity Weight that shows dual labels
 * (vector X.XX / full-text X.XX) above the slider.
 */
const VectorWeightControl = ({
  value = 0.7,
  onChange,
}: {
  value?: number
  onChange?: (val: number) => void
}) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
      <Text type="secondary" style={{ fontSize: 12 }}>vector {value.toFixed(2)}</Text>
      <Text type="secondary" style={{ fontSize: 12 }}>full-text {(1 - value).toFixed(2)}</Text>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Slider
        style={{ flex: 1 }}
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={onChange}
      />
      <InputNumber
        style={{ width: 72 }}
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(v: number | null) => onChange?.(v ?? 0.7)}
        size="small"
      />
    </div>
  </div>
)

// ============================================================================
// Types
// ============================================================================

interface SearchModalProps {
  /** Whether the modal is visible */
  open: boolean
  /** Close handler */
  onClose: () => void
  /** Success callback after save */
  onSuccess: () => void
  /** Ant Design form instance (controlled externally) */
  form: FormInstance
  /** Whether in edit mode */
  isEditing: boolean
  /** Search being edited (null for create) */
  editingSearch: ProjectSearch | null
  /** Project document categories */
  categories: DocumentCategory[]
  /** Map of category ID → its versions */
  categoryVersions: Record<string, DocumentCategoryVersion[]>
  /** Available chat models from the RAGFlow server */
  chatModels: string[]
  /** Save handler — called with form values */
  onSave: (values: any) => Promise<void>
  /** Loading state for save */
  saving: boolean
}

// ============================================================================
// Component
// ============================================================================

/**
 * Modal form for creating/editing an AI Search app.
 */
const SearchModal = ({
  open,
  onClose,
  form,
  isEditing,
  editingSearch,
  categories,
  categoryVersions,
  chatModels,
  onSave,
  saving,
}: SearchModalProps) => {
  const { t } = useTranslation()

  // Watch AI summary switch to show/hide LLM config
  const aiSummary = Form.useWatch(['search_config', 'ai_summary'], form)

  /**
   * Category checkbox options: one per category with a label showing version count.
   */
  const categoryOptions = useMemo(() => {
    return categories.map((cat) => {
      const versions = categoryVersions[cat.id] || []
      const activeVersions = versions.filter((v) => v.ragflow_dataset_id)
      return {
        label: `${cat.name} (${activeVersions.length} dataset${activeVersions.length !== 1 ? 's' : ''})`,
        value: cat.id,
      }
    })
  }, [categories, categoryVersions])

  /**
   * Populate form when editing an existing search.
   */
  useEffect(() => {
    if (open && isEditing && editingSearch) {
      form.setFieldsValue({
        name: editingSearch.name,
        description: editingSearch.description || '',
        dataset_ids: editingSearch.dataset_ids || [],
        search_config: {
          similarity_threshold: editingSearch.search_config?.similarity_threshold ?? 0.2,
          vector_similarity_weight: editingSearch.search_config?.vector_similarity_weight ?? 0.7,
          rerank_enabled: editingSearch.search_config?.rerank_enabled ?? false,
          rerank_model: editingSearch.search_config?.rerank_model || '',
          ai_summary: editingSearch.search_config?.ai_summary ?? false,
          model: editingSearch.search_config?.model || '',
          temperature: editingSearch.search_config?.temperature ?? 0.5,
          top_p: editingSearch.search_config?.top_p ?? 0.85,
          presence_penalty: editingSearch.search_config?.presence_penalty ?? 0.2,
          frequency_penalty: editingSearch.search_config?.frequency_penalty ?? 0.3,
        },
      })
    } else if (open && !isEditing) {
      form.resetFields()
      // Set defaults
      form.setFieldsValue({
        search_config: {
          similarity_threshold: 0.2,
          vector_similarity_weight: 0.7,
          rerank_enabled: false,
          ai_summary: false,
          temperature: 0.5,
          top_p: 0.85,
          presence_penalty: 0.2,
          frequency_penalty: 0.3,
        },
      })
    }
  }, [open, isEditing, editingSearch, form])

  /**
   * Handle creativity preset change.
   */
  const handleCreativityChange = (preset: string) => {
    if (preset === 'custom') return
    const values = CREATIVITY_PRESETS[preset]
    if (values) {
      form.setFieldsValue({
        search_config: {
          ...form.getFieldValue('search_config'),
          ...values,
        },
      })
    }
  }

  return (
    <Modal
      title={isEditing
        ? t('projectManagement.searches.editSearch', 'Edit Search')
        : t('projectManagement.searches.createSearch', 'Create Search')
      }
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={saving}
      width={720}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={onSave}
        preserve={false}
      >
        {/* ── Section 1: Basic Info ── */}
        <Form.Item
          name="name"
          label={t('projectManagement.searches.name', 'Name')}
          rules={[{ required: true, message: t('projectManagement.searches.nameRequired', 'Name is required') }]}
        >
          <Input placeholder={t('projectManagement.searches.namePlaceholder', 'Enter search app name')} />
        </Form.Item>

        <Form.Item
          name="description"
          label={t('projectManagement.searches.description', 'Description')}
        >
          <TextArea rows={2} placeholder={t('projectManagement.searches.descriptionPlaceholder', 'Enter description')} />
        </Form.Item>

        <Divider />

        {/* ── Section 2: Datasets ── */}
        <Form.Item
          name="dataset_ids"
          label={t('projectManagement.searches.datasets', 'Datasets')}
        >
          <Checkbox.Group options={categoryOptions} />
        </Form.Item>

        <Divider />

        {/* ── Section 3: Retrieval Config ── */}
        <Collapse
          ghost
          defaultActiveKey={['retrieval']}
          items={[
            {
              key: 'retrieval',
              label: t('projectManagement.searches.retrievalConfig', 'Retrieval Configuration'),
              children: (
                <>
                  <Form.Item
                    name={['search_config', 'similarity_threshold']}
                    label={t('projectManagement.searches.similarityThreshold', 'Similarity Threshold')}
                  >
                    <SliderInput min={0} max={1} step={0.01} />
                  </Form.Item>

                  <Form.Item
                    name={['search_config', 'vector_similarity_weight']}
                    label={t('projectManagement.searches.vectorWeight', 'Vector Similarity Weight')}
                  >
                    <VectorWeightControl />
                  </Form.Item>

                  <Form.Item
                    name={['search_config', 'rerank_enabled']}
                    label={t('projectManagement.searches.rerankModel', 'Rerank Model')}
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>

                  <Form.Item
                    name={['search_config', 'ai_summary']}
                    label={t('projectManagement.searches.aiSummary', 'AI Summary')}
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </>
              ),
            },
          ]}
        />

        {/* ── Section 4: LLM Config (shown when AI Summary is on) ── */}
        {aiSummary && (
          <Collapse
            ghost
            defaultActiveKey={['llm']}
            items={[
              {
                key: 'llm',
                label: t('projectManagement.searches.llmConfig', 'LLM Configuration'),
                children: (
                  <>
                    <Form.Item
                      name={['search_config', 'model']}
                      label={t('projectManagement.searches.model', 'Model')}
                    >
                      {chatModels.length > 0 ? (
                        <Select
                          placeholder={t('projectManagement.searches.selectModel', 'Select model')}
                          options={chatModels.map((m) => ({ label: m, value: m }))}
                          allowClear
                        />
                      ) : (
                        <Input placeholder={t('projectManagement.searches.modelPlaceholder', 'Enter model name')} />
                      )}
                    </Form.Item>

                    <Form.Item label={t('projectManagement.searches.creativity', 'Creativity')}>
                      <Select
                        defaultValue="custom"
                        onChange={handleCreativityChange}
                        options={[
                          { label: t('projectManagement.searches.improvise', 'Improvise'), value: 'improvise' },
                          { label: t('projectManagement.searches.precise', 'Precise'), value: 'precise' },
                          { label: t('projectManagement.searches.balance', 'Balance'), value: 'balance' },
                          { label: t('projectManagement.searches.custom', 'Custom'), value: 'custom' },
                        ]}
                      />
                    </Form.Item>

                    <Form.Item
                      name={['search_config', 'temperature']}
                      label={t('projectManagement.searches.temperature', 'Temperature')}
                    >
                      <SliderInput min={0} max={1} step={0.01} />
                    </Form.Item>

                    <Form.Item
                      name={['search_config', 'top_p']}
                      label={t('projectManagement.searches.topP', 'Top P')}
                    >
                      <SliderInput min={0} max={1} step={0.01} />
                    </Form.Item>

                    <Form.Item
                      name={['search_config', 'presence_penalty']}
                      label={t('projectManagement.searches.presencePenalty', 'Presence Penalty')}
                    >
                      <SliderInput min={0} max={1} step={0.01} />
                    </Form.Item>

                    <Form.Item
                      name={['search_config', 'frequency_penalty']}
                      label={t('projectManagement.searches.frequencyPenalty', 'Frequency Penalty')}
                    >
                      <SliderInput min={0} max={1} step={0.01} />
                    </Form.Item>
                  </>
                ),
              },
            ]}
          />
        )}
      </Form>
    </Modal>
  )
}

export default SearchModal
