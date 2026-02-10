/**
 * @fileoverview Modal form for creating a new category version.
 * @module features/projects/components/VersionModal
 */

import { useTranslation } from 'react-i18next'
import { Modal, Form, Input } from 'antd'
import type { FormInstance } from 'antd'

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
const VersionModal = ({ open, form, saving, onOk, onCancel }: VersionModalProps) => {
  const { t } = useTranslation()

  return (
    <Modal
      title={t('projectManagement.versions.add')}
      open={open}
      onOk={onOk}
      onCancel={onCancel}
      confirmLoading={saving}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" className="mt-4">
        <Form.Item
          name="version_label"
          label={t('projectManagement.versions.label')}
          rules={[{ required: true, message: `${t('projectManagement.versions.label')} is required` }]}
        >
          <Input placeholder={t('projectManagement.versions.labelPlaceholder') || 'e.g. v1.0'} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default VersionModal
