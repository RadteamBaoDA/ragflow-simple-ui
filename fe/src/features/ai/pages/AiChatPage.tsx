import { useEffect, useState } from 'react';
import RagflowIframe from '@/features/ai/components/RagflowIframe';
import { useFirstVisit, GuidelineDialog } from '@/features/guideline';

/**
 * @description AI Chat Page Component.
 * This component serves as a wrapper for the RagflowIframe, configured specifically for the "chat" functionality.
 * It renders the chat interface within the application.
 *
 * @returns {JSX.Element} The rendered AI Chat page containing the Ragflow iframe.
 */
function AiChatPage() {
  const { isFirstVisit } = useFirstVisit('ai-chat');
  const [showGuide, setShowGuide] = useState(false);

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
    </>
  );
}

export default AiChatPage;
