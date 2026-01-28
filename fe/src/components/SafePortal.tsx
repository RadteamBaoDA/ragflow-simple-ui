/**
 * @fileoverview Safe portal component for React 19 compatibility.
 * 
 * This component wraps createPortal with proper lifecycle management
 * to prevent "removeChild" errors during navigation when the portal
 * target element may be unmounted before the portal content.
 * 
 * @module components/SafePortal
 */

import { useState, useEffect, ReactNode } from 'react';
import { createPortal } from 'react-dom';

// ============================================================================
// Types
// ============================================================================

interface SafePortalProps {
    /** Content to render in the portal */
    children: ReactNode;
    /** ID of the DOM element to portal into */
    targetId: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * A safe portal wrapper that handles React 19 compatibility.
 * 
 * Prevents "Failed to execute 'removeChild'" errors by:
 * 1. Only rendering when target element exists
 * 2. Tracking mounted state to prevent portal content after unmount
 * 3. Using useEffect cleanup to handle navigation properly
 * 
 * @param {SafePortalProps} props - Component properties
 * @returns {React.ReactPortal | null} Portal or null if target doesn't exist
 */
export function SafePortal({ children, targetId }: SafePortalProps) {
    const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        // Mark as mounted
        setIsMounted(true);

        // Find target element
        const element = document.getElementById(targetId);
        setTargetElement(element);

        // Cleanup on unmount - clear portal content first
        return () => {
            setIsMounted(false);
            setTargetElement(null);
        };
    }, [targetId]);

    // Don't render if not mounted or no target element
    if (!isMounted || !targetElement) {
        return null;
    }

    return createPortal(children, targetElement);
}

export default SafePortal;
