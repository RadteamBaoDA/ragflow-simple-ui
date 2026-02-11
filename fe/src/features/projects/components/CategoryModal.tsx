/**
 * @fileoverview Modal form for creating a new document category with RAGFlow dataset config.
 * @module features/projects/components/CategoryModal
 */

import { useTranslation } from 'react-i18next'
import { Modal, Form, Input, Select, InputNumber, Switch, Divider, Typography } from 'antd'
import type { FormInstance } from 'antd'

const { Text } = Typography

// ============================================================================
// Constants
// ============================================================================

/** Available language options for RAGFlow datasets */
const LANGUAGE_OPTIONS = [
  { label: 'English', value: 'English' },
  { label: 'Chinese', value: 'Chinese' },
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
const CategoryModal = ({ open, form, saving, embeddingModels, onOk, onCancel }: CategoryModalProps) => {
  const { t } = useTranslation()

  return (
    <Modal
      title={t('projectManagement.categories.add')}
      open={open}
      onOk={onOk}
      onCancel={onCancel}
      confirmLoading={saving}
      destroyOnHidden
      width={600}
    >
      <Form form={form} layout="vertical" className="mt-4">
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
          initialValue="\\n"
        >
          <Input />
        </Form.Item>

        {/* Layout recognize */}
        <Form.Item
          name={['dataset_config', 'parser_config', 'layout_recognize']}
          label={t('projectManagement.categories.datasetConfig.layoutRecognize')}
          valuePropName="checked"
          initialValue={true}
        >
          <Switch />
        </Form.Item>

        {/* HTML for Excel */}
        <Form.Item
          name={['dataset_config', 'parser_config', 'html4excel']}
          label={t('projectManagement.categories.datasetConfig.html4excel')}
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
