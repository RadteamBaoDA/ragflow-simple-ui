/**
 * @fileoverview RAGFlow configuration context.
 * 
 * Manages RAGFlow iframe configuration and source selection:
 * - Fetches iframe URLs from backend /api/ragflow/config
 * - Manages selected chat and search sources
 * - Persists source preferences per user via IndexedDB
 * 
 * @module contexts/RagflowContext
 */

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { userPreferences } from '../services/userPreferences';

// ============================================================================
// Types
// ============================================================================

/**
 * RAGFlow data source configuration.
 * Represents a single chat or search source.
 */
interface RagflowSource {
    /** Unique source identifier */
    id: string;
    /** Display name for the source */
    name: string;
    /** Iframe URL for the source */
    url: string;
}

/**
 * Complete RAGFlow configuration from backend.
 */
interface RagflowConfig {
    /** Legacy AI Chat URL (fallback) */
    aiChatUrl: string;
    /** Legacy AI Search URL (fallback) */
    aiSearchUrl: string;
    /** Available chat sources */
    chatSources: RagflowSource[];
    /** Available search sources */
    searchSources: RagflowSource[];
}

/**
 * RAGFlow context value type.
 */
interface RagflowContextType {
    /** Current configuration or null if loading */
    config: RagflowConfig | null;
    /** Currently selected chat source ID */
    selectedChatSourceId: string;
    /** Currently selected search source ID */
    selectedSearchSourceId: string;
    /** Update selected chat source */
    setSelectedChatSource: (id: string) => void;
    /** Update selected search source */
    setSelectedSearchSource: (id: string) => void;
    /** Whether configuration is loading */
    isLoading: boolean;
    /** Error message if config fetch failed */
    error: string | null;
}

// ============================================================================
// Context
// ============================================================================

const RagflowContext = createContext<RagflowContextType | undefined>(undefined);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Fetch RAGFlow configuration from backend.
 * @returns RAGFlow configuration with source URLs
 */
async function fetchRagflowConfig(): Promise<RagflowConfig> {
    const response = await fetch('/api/ragflow/config', {
        credentials: 'include',
    });
    if (!response.ok) {
        throw new Error('Failed to fetch RAGFlow config');
    }
    return response.json();
}

// ============================================================================
// Provider
// ============================================================================

interface RagflowProviderProps {
    children: ReactNode;
}

/**
 * RAGFlow provider component.
 * Fetches configuration and manages source selection.
 * 
 * @param children - Child components to wrap
 */
export function RagflowProvider({ children }: RagflowProviderProps) {
    const { user } = useAuth();
    const [config, setConfig] = useState<RagflowConfig | null>(null);
    const [selectedChatSourceId, setSelectedChatSourceId] = useState<string>('');
    const [selectedSearchSourceId, setSelectedSearchSourceId] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    /**
     * Effect: Fetch config and restore saved preferences on mount.
     * Loads user's preferred sources from IndexedDB if available.
     */
    useEffect(() => {
        const init = async () => {
            try {
                const data = await fetchRagflowConfig();
                setConfig(data);

                // Initialize chat source with saved preference or first available
                if (data.chatSources.length > 0) {
                    let chatSourceId = data.chatSources[0]?.id || '';
                    if (user?.id && chatSourceId) {
                        const saved = await userPreferences.get<string>(user.id, 'ragflow_source_chat');
                        if (saved && data.chatSources.some(s => s.id === saved)) {
                            chatSourceId = saved;
                        }
                    }
                    setSelectedChatSourceId(chatSourceId);
                }

                // Initialize search source with saved preference or first available
                if (data.searchSources.length > 0) {
                    let searchSourceId = data.searchSources[0]?.id || '';
                    if (user?.id && searchSourceId) {
                        const saved = await userPreferences.get<string>(user.id, 'ragflow_source_search');
                        if (saved && data.searchSources.some(s => s.id === saved)) {
                            searchSourceId = saved;
                        }
                    }
                    setSelectedSearchSourceId(searchSourceId);
                }
            } catch (err) {
                console.error('[RagflowContext] Failed to fetch config:', err);
                setError('Failed to load RAGFlow configuration');
            } finally {
                setIsLoading(false);
            }
        };

        init();
    }, [user?.id]);

    /**
     * Update selected chat source and persist preference.
     */
    const setSelectedChatSource = useCallback(async (id: string) => {
        setSelectedChatSourceId(id);
        if (user?.id) {
            await userPreferences.set(user.id, 'ragflow_source_chat', id);
        }
    }, [user?.id]);

    /**
     * Update selected search source and persist preference.
     */
    const setSelectedSearchSource = useCallback(async (id: string) => {
        setSelectedSearchSourceId(id);
        if (user?.id) {
            await userPreferences.set(user.id, 'ragflow_source_search', id);
        }
    }, [user?.id]);

    return (
        <RagflowContext.Provider
            value={{
                config,
                selectedChatSourceId,
                selectedSearchSourceId,
                setSelectedChatSource,
                setSelectedSearchSource,
                isLoading,
                error,
            }}
        >
            {children}
        </RagflowContext.Provider>
    );
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access RAGFlow configuration context.
 * Must be used within a RagflowProvider.
 * 
 * @returns RAGFlow context with config and source selection
 * @throws Error if used outside RagflowProvider
 * 
 * @example
 * ```tsx
 * const { config, selectedChatSourceId, setSelectedChatSource } = useRagflow();
 * ```
 */
export function useRagflow(): RagflowContextType {
    const context = useContext(RagflowContext);
    if (context === undefined) {
        throw new Error('useRagflow must be used within a RagflowProvider');
    }
    return context;
}
