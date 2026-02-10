/**
 * @fileoverview Modal form for creating a new document category.
 * @module features/projects/components/CategoryModal
 */

import { useTranslation } from 'react-i18next'
import { Modal, Form, Input } from 'antd'
import type { FormInstance } from 'antd'

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
 *
 * @param {CategoryModalProps} props - Component props
 * @returns {JSX.Element} The rendered modal
 */
const CategoryModal = ({ open, form, saving, onOk, onCancel }: CategoryModalProps) => {
  const { t } = useTranslation()

  return (
    <Modal
      title={t('projectManagement.categories.add')}
      open={open}
      onOk={onOk}
      onCancel={onCancel}
      confirmLoading={saving}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" className="mt-4">
        <Form.Item
          name="name"
          label={t('projectManagement.categories.name')}
          rules={[{ required: true }]}
        >
          <Input placeholder={t('projectManagement.categories.namePlaceholder')} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default CategoryModal
