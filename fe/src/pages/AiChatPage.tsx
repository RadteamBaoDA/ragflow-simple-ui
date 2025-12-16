/**
 * @fileoverview AI Chat page component.
 * 
 * Simple wrapper that renders the RAGFlow iframe in chat mode.
 * The actual functionality is handled by the RagflowIframe component.
 * 
 * @module pages/AiChatPage
 */

import RagflowIframe from '../components/RagflowIframe';

/**
 * AI Chat page - displays the RAGFlow chat interface.
 * 
 * Renders the RagflowIframe component configured for chat mode.
 * Source selection is handled in the Layout header when multiple
 * chat sources are configured.
 */
function AiChatPage() {
  return <RagflowIframe path="chat" />;
}

export default AiChatPage;
