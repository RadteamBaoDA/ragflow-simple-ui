import { useState, useCallback } from 'react';

// Keys kept for future reference if needed, but not used for auto-show currently
// const PERMANENT_KEY_PREFIX = 'kb-guideline-permanent-';
// const SESSION_KEY_PREFIX = 'kb-guideline-session-';

/**
 * @description Hook to manage guideline visibility.
 * Auto-show logic has been disabled as per user request.
 * Now only manages manual visibility indirectly via manual triggers.
 * 
 * @param {string} featureId - Unique identifier for the feature.
 * @returns {object} Visibility state and control functions.
 */
export function useFirstVisit(_featureId: string) {
    // Default to FALSE to disable auto-show
    const [shouldShowAuto] = useState(false);

    // Auto-show logic removed.
    // Ideally, we would check storage here, but requirement is to remove "login first display".

    /**
     * Mark as seen - No-op now as we don't track auto-show state
     */
    const markAsSessionSeen = useCallback(() => {
        // No-op
    }, []);

    /**
     * Mark as permanently seen - No-op
     */
    const markAsPermanentlySeen = useCallback(() => {
        // No-op
    }, []);

    /**
     * Reset seen state - No-op
     */
    const resetSeen = useCallback(() => {
        // No-op
    }, []);

    return {
        isFirstVisit: shouldShowAuto, // Always false now
        shouldShowAuto,
        markAsSessionSeen,
        markAsPermanentlySeen,
        resetSeen
    };
}
