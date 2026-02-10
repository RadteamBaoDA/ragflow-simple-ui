/**
 * @fileoverview Modal for editing a version's label.
 *
 * Pre-fills the form with the current version label and
 * calls updateCategoryVersion on submit.
 *
 * @module features/projects/components/EditVersionModal
 */

import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Form, Input, message } from 'antd'
import {
  updateCategoryVersion,
  type DocumentCategoryVersion,
} from '../api/projectService'

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
 * Modal for editing a version's label.
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
  onSavingChange,
  onSaved,
  onCancel,
}: EditVersionModalProps) => {
  const { t } = useTranslation()
  const [form] = Form.useForm()

  // Pre-fill form when version changes
  useEffect(() => {
    if (version && open) {
      form.setFieldsValue({ version_label: version.version_label })
    }
  }, [version, open, form])

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
      })
      message.success(t('projectManagement.versions.updateSuccess'))
      onSaved()
    } catch (err) {
      // If validation error (from antd form), just return silently
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
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="version_label"
          label={t('projectManagement.versions.label')}
          rules={[{ required: true, message: t('projectManagement.versions.labelPlaceholder') }]}
        >
          <Input placeholder={t('projectManagement.versions.labelPlaceholder')} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default EditVersionModal
