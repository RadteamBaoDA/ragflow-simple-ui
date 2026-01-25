import { createContext, useContext, ReactNode } from 'react';

interface GuidelineContextType {
    // Placeholder for future global state
    // e.g., activeTourId, restartTour, etc.
}

const GuidelineContext = createContext<GuidelineContextType | undefined>(undefined);

export function GuidelineProvider({ children }: { children: ReactNode }) {
    const value = {};

    return <GuidelineContext.Provider value={value}>{children}</GuidelineContext.Provider>;
}

export function useGuidelineContext() {
    const context = useContext(GuidelineContext);
    if (context === undefined) {
        throw new Error('useGuidelineContext must be used within a GuidelineProvider');
    }
    return context;
}
