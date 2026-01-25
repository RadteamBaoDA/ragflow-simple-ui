import { useState, useCallback } from 'react';

export function useGuidedTour() {
    const [isTourRunning, setIsTourRunning] = useState(false);

    const startTour = useCallback(() => {
        setIsTourRunning(true);
    }, []);

    const stopTour = useCallback(() => {
        setIsTourRunning(false);
    }, []);

    return { isTourRunning, startTour, stopTour };
}
