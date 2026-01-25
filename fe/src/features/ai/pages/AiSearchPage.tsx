import { useEffect, useState } from 'react';
import RagflowIframe from '@/features/ai/components/RagflowIframe';
import { useFirstVisit, GuidelineDialog } from '@/features/guideline';

/**
 * @description AI Search Page Component.
 * This component acts as a container for the RagflowIframe, initializing it in "search" mode.
 * It allows users to access the AI search capabilities provided by the backend.
 *
 * @returns {JSX.Element} The rendered AI Search page containing the Ragflow iframe.
 */
function AiSearchPage() {
  const { isFirstVisit } = useFirstVisit('ai-search');
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    if (isFirstVisit) {
      setShowGuide(true);
    }
  }, [isFirstVisit]);

  // Render the RagflowIframe component, passing "search" as the path to load the search interface.
  return (
    <>
      <RagflowIframe path="search" />
      <GuidelineDialog
        open={showGuide}
        onClose={() => setShowGuide(false)}
        featureId="ai-search"
      />
    </>
  );
}

export default AiSearchPage;
