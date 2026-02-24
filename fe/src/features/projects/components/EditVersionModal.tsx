/**
 * @fileoverview Modal for editing a version's label, page rank, and pipeline config.
 * Shows built-in parser fields (pre-filled from version metadata or category defaults)
 * with a radio toggle matching RAGFlow's UI pattern.
 * @module features/projects/components/EditVersionModal
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Form, Input, InputNumber, Slider, Divider, Typography, Tooltip, Row, Col, Radio, message } from 'antd'
import type { RadioChangeEvent } from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons'
import {
  updateCategoryVersion,
  type DocumentCategoryVersion,
} from '../api/projectService'
import BuiltInParserFields from './BuiltInParserFields'

const { Text } = Typography

// ============================================================================
// Types
// ============================================================================

interface EditVersionModalProps {
  /** Whether the modal is visible */
  open: boolean
  /** The version being edited */
  version: DocumentCategoryVersion | null
  /** Project ID */
  projectId: string
  /** Category ID */
  categoryId: string
  /** Whether a save operation is in progress */
  saving: boolean
  /** Category-level dataset_config (fallback for pre-filling built-in fields) */
  categoryConfig?: Record<string, any> | undefined
  /** Callback to toggle saving state */
  onSavingChange: (saving: boolean) => void
  /** Callback after successful save */
  onSaved: () => void
  /** Callback to close the modal */
  onCancel: () => void
}

// ============================================================================
// Component
// ============================================================================

/**
 * Modal for editing a version's label and RAGFlow dataset config.
 *
 * @param {EditVersionModalProps} props - Component props
 * @returns {JSX.Element} The rendered edit version modal
 */
const EditVersionModal = ({
  open,
  version,
  projectId,
  categoryId,
  saving,
  categoryConfig,
  onSavingChange,
  onSaved,
  onCancel,
}: EditVersionModalProps) => {
  const { t } = useTranslation()
  const [form] = Form.useForm()
  const [parseMode, setParseMode] = useState<'builtin' | 'pipeline'>('builtin')

  // Pre-fill form when version changes
  useEffect(() => {
    if (version && open) {
      const meta = (version.metadata || {}) as Record<string, any>
      const hasPipeline = !!(meta.pipeline_id)
      setParseMode(hasPipeline ? 'pipeline' : 'builtin')

      // Use version metadata first, fall back to category config
      const catPc = (categoryConfig?.parser_config || {}) as Record<string, any>
      const verPc = (meta.parser_config || {}) as Record<string, any>

      // RAGFlow stores overlapped_percent as decimal (0.04 = 4%), UI expects integer
      const rawOverlap = verPc.overlapped_percent ?? catPc.overlapped_percent ?? 4
      const overlapped_percent = typeof rawOverlap === 'number' && rawOverlap > 0 && rawOverlap < 1
        ? Math.round(rawOverlap * 100)
        : rawOverlap

      form.setFieldsValue({
        version_label: version.version_label,
        pagerank: meta.pagerank ?? 0,
        pipeline_id: meta.pipeline_id ?? '',
        parse_type: meta.parse_type ?? undefined,
        chunk_method: meta.chunk_method || categoryConfig?.chunk_method || 'naive',
        parser_config: {
          layout_recognize: verPc.layout_recognize || catPc.layout_recognize || 'DeepDOC',
          chunk_token_num: verPc.chunk_token_num ?? catPc.chunk_token_num ?? 512,
          delimiter: verPc.delimiter ?? catPc.delimiter ?? '\\n',
          child_chunk: verPc.child_chunk ?? catPc.child_chunk ?? false,
          child_chunk_delimiter: verPc.child_chunk_delimiter ?? catPc.child_chunk_delimiter ?? '\\n',
          page_index: verPc.page_index ?? catPc.page_index ?? false,
          image_context_size: verPc.image_context_size ?? catPc.image_context_size ?? 128,
          auto_metadata: verPc.auto_metadata ?? catPc.auto_metadata ?? true,
          overlapped_percent,
          auto_keywords: verPc.auto_keywords ?? catPc.auto_keywords ?? 0,
          auto_questions: verPc.auto_questions ?? catPc.auto_questions ?? 0,
          html4excel: verPc.html4excel ?? catPc.html4excel ?? false,
        },
      })
    }
  }, [version, open, form, categoryConfig])

  /**
   * Handle form submission — validates and calls API.
   */
  const handleSubmit = async () => {
    if (!version) return
    try {
      const values = await form.validateFields()
      onSavingChange(true)
      await updateCategoryVersion(projectId, categoryId, version.id, {
        version_label: values.version_label.trim(),
        pagerank: values.pagerank ?? 0,
        ...(parseMode === 'pipeline' ? {
          pipeline_id: values.pipeline_id?.trim() || undefined,
          parse_type: values.parse_type ?? undefined,
        } : {
          chunk_method: values.chunk_method,
          parser_config: values.parser_config,
        }),
      })
      message.success(t('projectManagement.versions.updateSuccess'))
      onSaved()
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return
      message.error(String(err))
    } finally {
      onSavingChange(false)
    }
  }

  return (
    <Modal
      title={t('projectManagement.versions.editLabel')}
      open={open}
      onOk={handleSubmit}
      onCancel={onCancel}
      confirmLoading={saving}
      destroyOnHidden
      width={600}
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto', overflowX: 'hidden' } }}
    >
      <Form form={form} layout="vertical">
        {/* Version label */}
        <Form.Item
          name="version_label"
          label={t('projectManagement.versions.label')}
          rules={[{ required: true, message: t('projectManagement.versions.labelPlaceholder') }]}
        >
          <Input placeholder={t('projectManagement.versions.labelPlaceholder')} />
        </Form.Item>

        {/* Page Rank slider */}
        <Form.Item
          label={
            <span>
              {t('projectManagement.versions.pageRank')}
              <Tooltip title={t('projectManagement.versions.pageRankTip')}>
                <InfoCircleOutlined style={{ marginLeft: 4, color: '#999' }} />
              </Tooltip>
            </span>
          }
        >
          <Row gutter={12} align="middle">
            <Col flex="auto">
              <Form.Item name="pagerank" noStyle>
                <Slider min={0} max={100} />
              </Form.Item>
            </Col>
            <Col>
              <Form.Item name="pagerank" noStyle>
                <InputNumber min={0} max={100} style={{ width: 70 }} />
              </Form.Item>
            </Col>
          </Row>
        </Form.Item>

        {/* Ingestion pipeline section */}
        <Divider orientation="left" plain>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {t('projectManagement.versions.pipelineSection')}
          </Text>
        </Divider>

        {/* Parse type radio toggle */}
        <Form.Item label={t('projectManagement.versions.parseType')}>
          <Radio.Group
            value={parseMode}
            onChange={(e: RadioChangeEvent) => {
              setParseMode(e.target.value)
              if (e.target.value === 'builtin') {
                form.setFieldValue('pipeline_id', undefined)
                form.setFieldValue('parse_type', undefined)
              }
            }}
          >
            <Radio value="builtin">{t('projectManagement.versions.parseTypeBuiltIn')}</Radio>
            <Radio value="pipeline">{t('projectManagement.versions.parseTypeChoosePipeline')}</Radio>
          </Radio.Group>
        </Form.Item>

        {/* Built-in fields — pre-filled, user can override */}
        {parseMode === 'builtin' && (
          <>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 16 }}>
              {t('projectManagement.versions.builtInHint')}
            </Text>
            <BuiltInParserFields form={form} />
          </>
        )}

        {/* Pipeline fields */}
        {parseMode === 'pipeline' && (
          <>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 16 }}>
              {t('projectManagement.versions.pipelineSectionTip')}
            </Text>
            <Form.Item
              name="pipeline_id"
              label={t('projectManagement.versions.pipelineId')}
              rules={[{ required: true, message: t('projectManagement.versions.pipelineId') + ' is required' }]}
            >
              <Input placeholder={t('projectManagement.versions.pipelineIdPlaceholder')} />
            </Form.Item>
            <Form.Item
              name="parse_type"
              label={t('projectManagement.versions.parseTypeNum')}
            >
              <InputNumber
                min={1}
                style={{ width: '100%' }}
                placeholder={t('projectManagement.versions.parseTypePlaceholder') || ''}
              />
            </Form.Item>
          </>
        )}
      </Form>
    </Modal>
  )
}

export default EditVersionModal
