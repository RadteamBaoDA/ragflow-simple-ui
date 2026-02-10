/**
 * @fileoverview Modal form for creating a new chat assistant.
 * @module features/projects/components/ChatModal
 */

import { useTranslation } from 'react-i18next'
import { Modal, Form, Input } from 'antd'
import type { FormInstance } from 'antd'

// ============================================================================
// Types
// ============================================================================

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
}

// ============================================================================
// Component
// ============================================================================

/**
 * Modal dialog with a form for creating a new chat assistant.
 *
 * @param {ChatModalProps} props - Component props
 * @returns {JSX.Element} The rendered modal
 */
const ChatModal = ({ open, form, saving, onOk, onCancel }: ChatModalProps) => {
  const { t } = useTranslation()

  return (
    <Modal
      title={t('projectManagement.chats.add')}
      open={open}
      onOk={onOk}
      onCancel={onCancel}
      confirmLoading={saving}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" className="mt-4">
        <Form.Item
          name="name"
          label={t('projectManagement.chats.name')}
          rules={[{ required: true }]}
        >
          <Input placeholder={t('projectManagement.chats.namePlaceholder')} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default ChatModal
