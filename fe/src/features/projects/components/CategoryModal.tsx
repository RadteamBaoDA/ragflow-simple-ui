/**
 * @fileoverview Modal form for creating a new document category with RAGFlow dataset config.
 * @module features/projects/components/CategoryModal
 */

import { useTranslation } from 'react-i18next'
import { Modal, Form, Input, Select, InputNumber, Switch, Slider, Divider, Typography, Tooltip, Row, Col } from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons'
import type { FormInstance } from 'antd'

const { Text } = Typography

// ============================================================================
// Constants
// ============================================================================

/** Available language options for RAGFlow datasets */
const LANGUAGE_OPTIONS = [
  { label: 'English', value: 'English' },
  { label: 'Vietnamese', value: 'Vietnamese' },
  { label: 'Japanese', value: 'Japanese' },
]

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

interface CategoryModalProps {
  /** Whether the modal is visible */
  open: boolean
  /** Form instance managed by parent */
  form: FormInstance
  /** Whether the submit action is in progress */
  saving: boolean
  /** Whether the modal is in edit mode (vs create mode) */
  editMode?: boolean
  /** Available embedding models from RAGFlow server config */
  embeddingModels?: string[] | undefined
  /** Callback when the user confirms */
  onOk: () => void
  /** Callback when the user cancels or closes */
  onCancel: () => void
}

// ============================================================================
// Component
// ============================================================================

/**
 * Modal dialog with a form for creating a new document category.
 * Includes RAGFlow dataset configuration fields.
 *
 * @param {CategoryModalProps} props - Component props
 * @returns {JSX.Element} The rendered modal
 */
const CategoryModal = ({ open, form, saving, editMode, embeddingModels, onOk, onCancel }: CategoryModalProps) => {
  const { t } = useTranslation()

  /** Watch child_chunk toggle to conditionally show delimiter input */
  const childChunkEnabled = Form.useWatch(['dataset_config', 'parser_config', 'child_chunk'], form)

  return (
    <Modal
      title={editMode ? t('projectManagement.categories.edit') : t('projectManagement.categories.add')}
      open={open}
      onOk={onOk}
      onCancel={onCancel}
      confirmLoading={saving}
      destroyOnHidden
      width="70vw"
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto', overflowX: 'hidden' } }}
    >
      <Form
        form={form}
        layout="vertical"
        className="mt-4"
        onValuesChange={(changedValues: Record<string, any>) => {
          // Sync all 3 context window fields when image_context_size slider changes
          // RAGFlow uses image_table_context_window, image_context_size, and table_context_size
          const imgCtx = changedValues?.dataset_config?.parser_config?.image_context_size
          if (imgCtx !== undefined) {
            form.setFieldValue(['dataset_config', 'parser_config', 'table_context_size'], imgCtx)
            form.setFieldValue(['dataset_config', 'parser_config', 'image_table_context_window'], imgCtx)
          }
        }}
      >
        {/* Category name */}
        <Form.Item
          name="name"
          label={t('projectManagement.categories.name')}
          rules={[{ required: true }]}
        >
          <Input placeholder={t('projectManagement.categories.namePlaceholder')} />
        </Form.Item>

        {/* Dataset configuration section */}
        <Divider orientation="left" plain>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {t('projectManagement.categories.datasetConfig.title')}
          </Text>
        </Divider>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 16 }}>
          {t('projectManagement.categories.datasetConfig.description')}
        </Text>

        {/* Language */}
        <Form.Item
          name={['dataset_config', 'language']}
          label={t('projectManagement.categories.datasetConfig.language')}
          initialValue="English"
        >
          <Select options={LANGUAGE_OPTIONS} />
        </Form.Item>

        {/* Embedding model */}
        <Form.Item
          name={['dataset_config', 'embedding_model']}
          label={t('projectManagement.categories.datasetConfig.embeddingModel')}
        >
          {embeddingModels && embeddingModels.length > 0 ? (
            <Select
              allowClear
              showSearch
              placeholder={t('projectManagement.categories.datasetConfig.embeddingModelPlaceholder')}
              options={embeddingModels.map(m => ({ label: m, value: m }))}
            />
          ) : (
            <Input placeholder={t('projectManagement.categories.datasetConfig.embeddingModelPlaceholder')} />
          )}
        </Form.Item>

        {/* Chunk method */}
        <Form.Item
          name={['dataset_config', 'chunk_method']}
          label={t('projectManagement.categories.datasetConfig.chunkMethod')}
          initialValue="naive"
        >
          <Select options={CHUNK_METHOD_OPTIONS} />
        </Form.Item>

        {/* Layout Recognize (PDF Parser) */}
        <Form.Item
          name={['dataset_config', 'parser_config', 'layout_recognize']}
          label={t('projectManagement.categories.datasetConfig.pdfParser')}
          initialValue="DeepDOC"
        >
          <Select options={PDF_PARSER_OPTIONS} />
        </Form.Item>

        {/* Chunk token number */}
        <Form.Item
          name={['dataset_config', 'parser_config', 'chunk_token_num']}
          label={t('projectManagement.categories.datasetConfig.chunkTokenNum')}
          initialValue={512}
        >
          <InputNumber min={1} max={2048} style={{ width: '100%' }} />
        </Form.Item>

        {/* Delimiter */}
        <Form.Item
          name={['dataset_config', 'parser_config', 'delimiter']}
          label={t('projectManagement.categories.datasetConfig.delimiter')}
          initialValue="\n"
        >
          <Input />
        </Form.Item>

        {/* Child chunk for retrieval */}
        <Form.Item
          name={['dataset_config', 'parser_config', 'child_chunk']}
          label={t('projectManagement.categories.datasetConfig.childChunk')}
          valuePropName="checked"
          initialValue={false}
        >
          <Switch />
        </Form.Item>

        {/* Child chunk delimiter — shown only when child_chunk is enabled */}
        {childChunkEnabled && (
          <Form.Item
            name={['dataset_config', 'parser_config', 'child_chunk_delimiter']}
            label={t('projectManagement.categories.datasetConfig.childChunkDelimiter')}
            initialValue="\n"
          >
            <Input />
          </Form.Item>
        )}

        {/* PageIndex */}
        <Form.Item
          name={['dataset_config', 'parser_config', 'page_index']}
          label={
            <span>
              {t('projectManagement.categories.datasetConfig.pageIndex')}
              <Tooltip title={t('projectManagement.categories.datasetConfig.pageIndexTip')}>
                <InfoCircleOutlined style={{ marginLeft: 4, color: '#999' }} />
              </Tooltip>
            </span>
          }
          valuePropName="checked"
          initialValue={false}
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
              <Form.Item
                name={['dataset_config', 'parser_config', 'image_context_size']}
                noStyle
                initialValue={128}
              >
                <Slider min={0} max={256} />
              </Form.Item>
            </Col>
            <Col>
              <Form.Item
                name={['dataset_config', 'parser_config', 'image_context_size']}
                noStyle
              >
                <InputNumber min={0} max={256} style={{ width: 70 }} />
              </Form.Item>
            </Col>
          </Row>
        </Form.Item>

        {/* Auto metadata */}
        <Form.Item
          name={['dataset_config', 'parser_config', 'auto_metadata']}
          label={
            <span>
              {t('projectManagement.categories.datasetConfig.autoMetadata')}
              <Tooltip title={t('projectManagement.categories.datasetConfig.autoMetadataTip')}>
                <InfoCircleOutlined style={{ marginLeft: 4, color: '#999' }} />
              </Tooltip>
            </span>
          }
          valuePropName="checked"
          initialValue={true}
        >
          <Switch />
        </Form.Item>

        {/* Overlapped percent */}
        <Form.Item
          label={t('projectManagement.categories.datasetConfig.overlappedPercent')}
        >
          <Row gutter={12} align="middle">
            <Col flex="auto">
              <Form.Item
                name={['dataset_config', 'parser_config', 'overlapped_percent']}
                noStyle
                initialValue={4}
              >
                <Slider min={0} max={100} />
              </Form.Item>
            </Col>
            <Col>
              <Form.Item
                name={['dataset_config', 'parser_config', 'overlapped_percent']}
                noStyle
              >
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
              <Form.Item
                name={['dataset_config', 'parser_config', 'auto_keywords']}
                noStyle
                initialValue={0}
              >
                <Slider min={0} max={32} />
              </Form.Item>
            </Col>
            <Col>
              <Form.Item
                name={['dataset_config', 'parser_config', 'auto_keywords']}
                noStyle
              >
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
              <Form.Item
                name={['dataset_config', 'parser_config', 'auto_questions']}
                noStyle
                initialValue={0}
              >
                <Slider min={0} max={10} />
              </Form.Item>
            </Col>
            <Col>
              <Form.Item
                name={['dataset_config', 'parser_config', 'auto_questions']}
                noStyle
              >
                <InputNumber min={0} max={10} style={{ width: 70 }} />
              </Form.Item>
            </Col>
          </Row>
        </Form.Item>

        {/* HTML for Excel */}
        <Form.Item
          name={['dataset_config', 'parser_config', 'html4excel']}
          label={
            <span>
              {t('projectManagement.categories.datasetConfig.html4excel')}
              <Tooltip title={t('projectManagement.categories.datasetConfig.html4excelTip')}>
                <InfoCircleOutlined style={{ marginLeft: 4, color: '#999' }} />
              </Tooltip>
            </span>
          }
          valuePropName="checked"
          initialValue={false}
        >
          <Switch />
        </Form.Item>

      </Form>
    </Modal>
  )
}

export default CategoryModal
