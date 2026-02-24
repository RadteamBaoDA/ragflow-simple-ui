/**
 * @fileoverview Modal form for creating a new category version.
 * Includes page rank slider and ingestion pipeline toggle (Built-in vs Choose pipeline).
 * When "Built-in" is selected, shows parser config fields pre-filled from category defaults.
 * @module features/projects/components/VersionModal
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Form, Input, InputNumber, Slider, Divider, Typography, Tooltip, Row, Col, Radio } from 'antd'
import type { RadioChangeEvent, FormInstance } from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons'
import BuiltInParserFields from './BuiltInParserFields'

const { Text } = Typography

// ============================================================================
// Types
// ============================================================================

interface VersionModalProps {
  /** Whether the modal is visible */
  open: boolean
  /** Form instance managed by parent */
  form: FormInstance
  /** Whether the submit action is in progress */
  saving: boolean
  /** Category-level dataset_config (used to pre-fill built-in fields) */
  categoryConfig?: Record<string, any> | undefined
  /** Callback when the user confirms */
  onOk: () => void
  /** Callback when the user cancels or closes */
  onCancel: () => void
}

// ============================================================================
// Component
// ============================================================================

/**
 * Modal dialog with a form for creating a new category version.
 *
 * @param {VersionModalProps} props - Component props
 * @returns {JSX.Element} The rendered modal
 */
const VersionModal = ({ open, form, saving, categoryConfig, onOk, onCancel }: VersionModalProps) => {
  const { t } = useTranslation()
  const [parseMode, setParseMode] = useState<'builtin' | 'pipeline'>('builtin')

  /** Pre-fill parser config from category defaults when modal opens */
  useEffect(() => {
    if (open && categoryConfig) {
      const pc = categoryConfig.parser_config || {}

      // RAGFlow stores overlapped_percent as decimal (0.04 = 4%), UI expects integer
      const rawOverlap = pc.overlapped_percent ?? 4
      const overlapped_percent = typeof rawOverlap === 'number' && rawOverlap > 0 && rawOverlap < 1
        ? Math.round(rawOverlap * 100)
        : rawOverlap

      form.setFieldsValue({
        chunk_method: categoryConfig.chunk_method || 'naive',
        parser_config: {
          layout_recognize: pc.layout_recognize || 'DeepDOC',
          chunk_token_num: pc.chunk_token_num ?? 512,
          delimiter: pc.delimiter ?? '\\n',
          child_chunk: pc.child_chunk ?? false,
          child_chunk_delimiter: pc.child_chunk_delimiter ?? '\\n',
          page_index: pc.page_index ?? false,
          image_context_size: pc.image_context_size ?? 128,
          auto_metadata: pc.auto_metadata ?? true,
          overlapped_percent,
          auto_keywords: pc.auto_keywords ?? 0,
          auto_questions: pc.auto_questions ?? 0,
          html4excel: pc.html4excel ?? false,
        },
      })
    }
  }, [open, categoryConfig, form])

  /** Reset parse mode when modal opens/closes */
  const handleCancel = () => {
    setParseMode('builtin')
    onCancel()
  }

  return (
    <Modal
      title={t('projectManagement.versions.add')}
      open={open}
      onOk={onOk}
      onCancel={handleCancel}
      confirmLoading={saving}
      destroyOnHidden
      width={600}
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto', overflowX: 'hidden' } }}
    >
      <Form form={form} layout="vertical" className="mt-4">
        {/* Version label */}
        <Form.Item
          name="version_label"
          label={t('projectManagement.versions.label')}
          rules={[{ required: true, message: `${t('projectManagement.versions.label')} is required` }]}
        >
          <Input placeholder={t('projectManagement.versions.labelPlaceholder') || 'e.g. v1.0'} />
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
              <Form.Item name="pagerank" noStyle initialValue={0}>
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

        {/* Built-in fields — pre-filled from category, user can override */}
        {parseMode === 'builtin' && (
          <>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 16 }}>
              {t('projectManagement.versions.builtInHint')}
            </Text>
            <BuiltInParserFields form={form} />
          </>
        )}

        {/* Pipeline fields — only visible when "Choose pipeline" is selected */}
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

export default VersionModal
