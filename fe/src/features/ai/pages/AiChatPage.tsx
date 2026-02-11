import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { Button, Tooltip } from 'antd';
import RagflowIframe from '@/features/ai/components/RagflowIframe';
import { useFirstVisit, GuidelineDialog } from '@/features/guideline';
import { PromptBuilderModal } from '@/features/glossary/components/PromptBuilderModal';
import { useAuth } from '@/features/auth';

/**
 * @description AI Chat Page Component.
 * This component serves as a wrapper for the RagflowIframe, configured specifically for the "chat" functionality.
 * It renders the chat interface within the application.
 * Includes a floating Prompt Builder button for admin/leader users.
 *
 * @returns {JSX.Element} The rendered AI Chat page containing the Ragflow iframe.
 */
function AiChatPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isFirstVisit } = useFirstVisit('ai-chat');
  const [showGuide, setShowGuide] = useState(false);
  const [showPromptBuilder, setShowPromptBuilder] = useState(false);

  const isAdminOrLeader = user?.role === 'admin' || user?.role === 'leader';

  useEffect(() => {
    if (isFirstVisit) {
      setShowGuide(true);
    }
  }, [isFirstVisit]);

  // Render the RagflowIframe component with the 'path' prop set to "chat" to display the chat interface.
  return (
    <>
      <RagflowIframe path="chat" />
      <GuidelineDialog
        open={showGuide}
        onClose={() => setShowGuide(false)}
        featureId="ai-chat"
      />

      {/* Prompt Builder FAB — visible to admin/leader users */}
      {isAdminOrLeader && (
        <Tooltip title={t('glossary.promptBuilder.title')} placement="left">
          <Button
            type="primary"
            shape="circle"
            size="large"
            icon={<Sparkles size={20} />}
            onClick={() => setShowPromptBuilder(true)}
            style={{
              position: 'fixed',
              bottom: 24,
              right: 24,
              width: 48,
              height: 48,
              zIndex: 1000,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            }}
          />
        </Tooltip>
      )}

      {/* Prompt Builder Modal */}
      <PromptBuilderModal
        open={showPromptBuilder}
        onClose={() => setShowPromptBuilder(false)}
      />
    </>
  );
}

export default AiChatPage;
