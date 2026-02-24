/**
 * @fileoverview Shared built-in parser config fields.
 *
 * Extracted from CategoryModal so the same fields can be reused
 * in version create/edit modals to allow per-version overrides.
 *
 * @module features/projects/components/BuiltInParserFields
 */

import { useTranslation } from 'react-i18next'
import { Form, Select, Input, InputNumber, Switch, Slider, Tooltip, Row, Col } from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons'
import type { FormInstance } from 'antd'

// ============================================================================
// Constants
// ============================================================================

/** Available chunk method options for RAGFlow datasets */
const CHUNK_METHOD_OPTIONS = [
  { label: 'General', value: 'naive' },
  { label: 'Book', value: 'book' },
  { label: 'Email', value: 'email' },
  { label: 'Laws', value: 'laws' },
  { label: 'Manual', value: 'manual' },
  { label: 'One', value: 'one' },
  { label: 'Paper', value: 'paper' },
  { label: 'Picture', value: 'picture' },
  { label: 'Presentation', value: 'presentation' },
  { label: 'Q&A', value: 'qa' },
  { label: 'Table', value: 'table' },
  { label: 'Tag', value: 'tag' },
]

/** Available PDF parser options for RAGFlow datasets */
const PDF_PARSER_OPTIONS = [
  { label: 'DeepDOC', value: 'DeepDOC' },
  { label: 'PlainText', value: 'PlainText' },
]

// ============================================================================
// Types
// ============================================================================

interface BuiltInParserFieldsProps {
  /** Form instance from parent */
  form: FormInstance
  /**
   * Field name prefix. In CategoryModal this is ['dataset_config'],
   * in version modals it is ['parser_config'] (flat).
   */
  prefix?: (string | number)[]
}

// ============================================================================
// Component
// ============================================================================

/**
 * Renders all built-in ingestion pipeline fields (chunk method, PDF parser,
 * chunk size, delimiter, child chunk, page index, image context, etc.).
 *
 * @param {BuiltInParserFieldsProps} props - Component props
 * @returns {JSX.Element} The rendered form fields
 */
const BuiltInParserFields = ({ form, prefix = [] }: BuiltInParserFieldsProps) => {
  const { t } = useTranslation()

  /** Helper to build nested field name */
  const n = (field: string) => [...prefix, field]
  const p = (field: string) => [...prefix, 'parser_config', field]

  /** Watch child_chunk toggle to conditionally show delimiter input */
  const childChunkEnabled = Form.useWatch(p('child_chunk'), form)

  return (
    <>
      {/* Chunk method */}
      <Form.Item
        name={n('chunk_method')}
        label={t('projectManagement.categories.datasetConfig.chunkMethod')}
      >
        <Select options={CHUNK_METHOD_OPTIONS} allowClear placeholder="Inherit from category" />
      </Form.Item>

      {/* Layout Recognize (PDF Parser) */}
      <Form.Item
        name={p('layout_recognize')}
        label={t('projectManagement.categories.datasetConfig.pdfParser')}
      >
        <Select options={PDF_PARSER_OPTIONS} allowClear placeholder="Inherit from category" />
      </Form.Item>

      {/* Chunk token number */}
      <Form.Item
        name={p('chunk_token_num')}
        label={t('projectManagement.categories.datasetConfig.chunkTokenNum')}
      >
        <InputNumber min={1} max={2048} style={{ width: '100%' }} placeholder="Inherit from category" />
      </Form.Item>

      {/* Delimiter */}
      <Form.Item
        name={p('delimiter')}
        label={t('projectManagement.categories.datasetConfig.delimiter')}
      >
        <Input placeholder="Inherit from category" />
      </Form.Item>

      {/* Child chunk for retrieval */}
      <Form.Item
        name={p('child_chunk')}
        label={t('projectManagement.categories.datasetConfig.childChunk')}
        valuePropName="checked"
      >
        <Switch />
      </Form.Item>

      {/* Child chunk delimiter — shown only when child_chunk is enabled */}
      {childChunkEnabled && (
        <Form.Item
          name={p('child_chunk_delimiter')}
          label={t('projectManagement.categories.datasetConfig.childChunkDelimiter')}
        >
          <Input placeholder="\n" />
        </Form.Item>
      )}

      {/* PageIndex */}
      <Form.Item
        name={p('page_index')}
        label={
          <span>
            {t('projectManagement.categories.datasetConfig.pageIndex')}
            <Tooltip title={t('projectManagement.categories.datasetConfig.pageIndexTip')}>
              <InfoCircleOutlined style={{ marginLeft: 4, color: '#999' }} />
            </Tooltip>
          </span>
        }
        valuePropName="checked"
      >
        <Switch />
      </Form.Item>

      {/* Image & table context window */}
      <Form.Item
        label={
          <span>
            {t('projectManagement.categories.datasetConfig.imageContextSize')}
            <Tooltip title={t('projectManagement.categories.datasetConfig.imageContextSizeTip')}>
              <InfoCircleOutlined style={{ marginLeft: 4, color: '#999' }} />
            </Tooltip>
          </span>
        }
      >
        <Row gutter={12} align="middle">
          <Col flex="auto">
            <Form.Item name={p('image_context_size')} noStyle>
              <Slider min={0} max={256} />
            </Form.Item>
          </Col>
          <Col>
            <Form.Item name={p('image_context_size')} noStyle>
              <InputNumber min={0} max={256} style={{ width: 70 }} />
            </Form.Item>
          </Col>
        </Row>
      </Form.Item>

      {/* Auto metadata */}
      <Form.Item
        name={p('auto_metadata')}
        label={
          <span>
            {t('projectManagement.categories.datasetConfig.autoMetadata')}
            <Tooltip title={t('projectManagement.categories.datasetConfig.autoMetadataTip')}>
              <InfoCircleOutlined style={{ marginLeft: 4, color: '#999' }} />
            </Tooltip>
          </span>
        }
        valuePropName="checked"
      >
        <Switch />
      </Form.Item>

      {/* Overlapped percent */}
      <Form.Item
        label={t('projectManagement.categories.datasetConfig.overlappedPercent')}
      >
        <Row gutter={12} align="middle">
          <Col flex="auto">
            <Form.Item name={p('overlapped_percent')} noStyle>
              <Slider min={0} max={100} />
            </Form.Item>
          </Col>
          <Col>
            <Form.Item name={p('overlapped_percent')} noStyle>
              <InputNumber min={0} max={100} style={{ width: 70 }} />
            </Form.Item>
          </Col>
        </Row>
      </Form.Item>

      {/* Auto-keywords */}
      <Form.Item
        label={
          <span>
            {t('projectManagement.categories.datasetConfig.autoKeyword')}
            <Tooltip title={t('projectManagement.categories.datasetConfig.autoKeywordTip')}>
              <InfoCircleOutlined style={{ marginLeft: 4, color: '#999' }} />
            </Tooltip>
          </span>
        }
      >
        <Row gutter={12} align="middle">
          <Col flex="auto">
            <Form.Item name={p('auto_keywords')} noStyle>
              <Slider min={0} max={32} />
            </Form.Item>
          </Col>
          <Col>
            <Form.Item name={p('auto_keywords')} noStyle>
              <InputNumber min={0} max={32} style={{ width: 70 }} />
            </Form.Item>
          </Col>
        </Row>
      </Form.Item>

      {/* Auto-questions */}
      <Form.Item
        label={
          <span>
            {t('projectManagement.categories.datasetConfig.autoQuestion')}
            <Tooltip title={t('projectManagement.categories.datasetConfig.autoQuestionTip')}>
              <InfoCircleOutlined style={{ marginLeft: 4, color: '#999' }} />
            </Tooltip>
          </span>
        }
      >
        <Row gutter={12} align="middle">
          <Col flex="auto">
            <Form.Item name={p('auto_questions')} noStyle>
              <Slider min={0} max={10} />
            </Form.Item>
          </Col>
          <Col>
            <Form.Item name={p('auto_questions')} noStyle>
              <InputNumber min={0} max={10} style={{ width: 70 }} />
            </Form.Item>
          </Col>
        </Row>
      </Form.Item>

      {/* HTML for Excel */}
      <Form.Item
        name={p('html4excel')}
        label={
          <span>
            {t('projectManagement.categories.datasetConfig.html4excel')}
            <Tooltip title={t('projectManagement.categories.datasetConfig.html4excelTip')}>
              <InfoCircleOutlined style={{ marginLeft: 4, color: '#999' }} />
            </Tooltip>
          </span>
        }
        valuePropName="checked"
      >
        <Switch />
      </Form.Item>
    </>
  )
}

export default BuiltInParserFields
