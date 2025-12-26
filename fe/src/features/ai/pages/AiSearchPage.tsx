import RagflowIframe from '@/features/ai/components/RagflowIframe';

/**
 * @description AI Search Page Component.
 * This component acts as a container for the RagflowIframe, initializing it in "search" mode.
 * It allows users to access the AI search capabilities provided by the backend.
 *
 * @returns {JSX.Element} The rendered AI Search page containing the Ragflow iframe.
 */
function AiSearchPage() {
  // Render the RagflowIframe component, passing "search" as the path to load the search interface.
  return <RagflowIframe path="search" />;
}

export default AiSearchPage;
