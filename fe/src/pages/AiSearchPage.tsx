/**
 * @fileoverview AI Search page component.
 * 
 * Simple wrapper that renders the RAGFlow iframe in search mode.
 * The actual functionality is handled by the RagflowIframe component.
 * 
 * @module pages/AiSearchPage
 */

import RagflowIframe from '../components/RagflowIframe';

/**
 * AI Search page - displays the RAGFlow search interface.
 * 
 * Renders the RagflowIframe component configured for search mode.
 * Source selection is handled in the Layout header when multiple
 * search sources are configured.
 */
function AiSearchPage() {
  return <RagflowIframe path="search" />;
}

export default AiSearchPage;
