import RagflowIframe from '@/features/ai/components/RagflowIframe';

/**
 * @description AI Chat Page Component.
 * This component serves as a wrapper for the RagflowIframe, configured specifically for the "chat" functionality.
 * It renders the chat interface within the application.
 *
 * @returns {JSX.Element} The rendered AI Chat page containing the Ragflow iframe.
 */
function AiChatPage() {
  // Render the RagflowIframe component with the 'path' prop set to "chat" to display the chat interface.
  return <RagflowIframe path="chat" />;
}

export default AiChatPage;
