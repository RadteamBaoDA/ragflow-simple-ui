/**
 * @fileoverview Header Actions Context for passing action buttons to the layout header.
 * 
 * This provides a React 19 compatible alternative to createPortal for injecting
 * page-specific action buttons into the main layout header.
 * 
 * @module components/HeaderActions
 */

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

interface HeaderActionsContextType {
    /** Current header actions content */
    actions: ReactNode | null;
    /** Set header actions for the current page */
    setActions: (actions: ReactNode | null) => void;
}

// ============================================================================
// Context
// ============================================================================

const HeaderActionsContext = createContext<HeaderActionsContextType | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface HeaderActionsProviderProps {
    children: ReactNode;
}

/**
 * Provider component for header actions context.
 * Wrap this around your app to enable header actions injection.
 */
export function HeaderActionsProvider({ children }: HeaderActionsProviderProps) {
    const [actions, setActionsState] = useState<ReactNode | null>(null);

    const setActions = useCallback((newActions: ReactNode | null) => {
        setActionsState(newActions);
    }, []);

    return (
        <HeaderActionsContext.Provider value={{ actions, setActions }}>
            {children}
        </HeaderActionsContext.Provider>
    );
}

// ============================================================================
// Consumer Hook
// ============================================================================

/**
 * Hook to access the current header actions.
 * Use this in the layout to render the actions.
 */
export function useHeaderActionsContent() {
    const context = useContext(HeaderActionsContext);
    if (!context) {
        throw new Error('useHeaderActionsContent must be used within HeaderActionsProvider');
    }
    return context.actions;
}

/**
 * Hook to set header actions from a page component.
 * Actions are automatically cleared when the component unmounts.
 */
export function useHeaderActions() {
    const context = useContext(HeaderActionsContext);
    if (!context) {
        throw new Error('useHeaderActions must be used within HeaderActionsProvider');
    }
    return context.setActions;
}

// ============================================================================
// Component for setting actions
// ============================================================================

interface HeaderActionsProps {
    children: ReactNode;
}

/**
 * Component that sets its children as header actions.
 * Automatically cleans up on unmount to prevent stale actions.
 * 
 * Usage:
 * ```tsx
 * <HeaderActions>
 *   <Button onClick={handleAdd}>Add New</Button>
 * </HeaderActions>
 * ```
 */
export function HeaderActions({ children }: HeaderActionsProps) {
    const setActions = useHeaderActions();

    useEffect(() => {
        setActions(children);

        // Cleanup on unmount
        return () => {
            setActions(null);
        };
    }, [children, setActions]);

    // This component doesn't render anything itself
    return null;
}

export default HeaderActions;
