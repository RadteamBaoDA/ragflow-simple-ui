/**
 * @fileoverview Knowledge Base configuration context.
 * 
 * Manages Knowledge Base iframe configuration and source selection:
 * - Fetches iframe URLs from backend /api/knowledge-base/config
 * - Manages selected chat and search sources
 * - Persists source preferences per user via IndexedDB
 * 
 * @module contexts/KnowledgeBaseContext
 */

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useAuth } from '@/features/auth';
import { userPreferences } from '@/features/users/api/userPreferences';

// ============================================================================
// Types
// ============================================================================

/**
 * Knowledge Base data source configuration.
 * Represents a single chat or search source.
 */
interface KnowledgeBaseSource {
    /** Unique source identifier */
    id: string;
    /** Display name for the source */
    name: string;
    /** Iframe URL for the source */
    url: string;
}

/**
 * Complete Knowledge Base configuration from backend.
 */
interface KnowledgeBaseConfig {
    /** Default Chat Source ID */
    defaultChatSourceId: string;
    /** Default Search Source ID */
    defaultSearchSourceId: string;
    /** Available chat sources */
    chatSources: KnowledgeBaseSource[];
    /** Available search sources */
    searchSources: KnowledgeBaseSource[];
}

/**
 * Knowledge Base context value type.
 */
interface KnowledgeBaseContextType {
    /** Current configuration or null if loading */
    config: KnowledgeBaseConfig | null;
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

const KnowledgeBaseContext = createContext<KnowledgeBaseContextType | undefined>(undefined);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Fetch Knowledge Base configuration from backend.
 * @returns Knowledge Base configuration with source URLs
 */
async function fetchKnowledgeBaseConfig(): Promise<KnowledgeBaseConfig> {
    const response = await fetch('/api/knowledge-base/config', {
        credentials: 'include',
    });
    if (!response.ok) {
        throw new Error('Failed to fetch Knowledge Base config');
    }
    return response.json();
}

// ============================================================================
// Provider
// ============================================================================

interface KnowledgeBaseProviderProps {
    children: ReactNode;
}

/**
 * Knowledge Base provider component.
 * Fetches configuration and manages source selection.
 * 
 * @param children - Child components to wrap
 */
export function KnowledgeBaseProvider({ children }: KnowledgeBaseProviderProps) {
    const { user } = useAuth();
    const [config, setConfig] = useState<KnowledgeBaseConfig | null>(null);
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
                const data = await fetchKnowledgeBaseConfig();
                setConfig(data);

                // Initialize chat source with saved preference or default or first available
                if (data.chatSources.length > 0) {
                    let chatSourceId = data.defaultChatSourceId || data.chatSources[0]?.id || '';
                    if (user?.id && chatSourceId) {
                        const saved = await userPreferences.get<string>(user.id, 'knowledge_base_source_chat');
                        if (saved && data.chatSources.some(s => s.id === saved)) {
                            chatSourceId = saved;
                        }
                    }
                    setSelectedChatSourceId(chatSourceId);
                }

                // Initialize search source with saved preference or default or first available
                if (data.searchSources.length > 0) {
                    let searchSourceId = data.defaultSearchSourceId || data.searchSources[0]?.id || '';
                    if (user?.id && searchSourceId) {
                        const saved = await userPreferences.get<string>(user.id, 'knowledge_base_source_search');
                        if (saved && data.searchSources.some(s => s.id === saved)) {
                            searchSourceId = saved;
                        }
                    }
                    setSelectedSearchSourceId(searchSourceId);
                }
            } catch (err) {
                console.error('[KnowledgeBaseContext] Failed to fetch config:', err);
                setError('Failed to load Knowledge Base configuration');
            } finally {
                setIsLoading(false);
            }
        };

        init();
    }, [user?.id]);

    /**
     * Update selected chat source and persist preference.
     * @param id - The ID of the chat source to select.
     */
    const setSelectedChatSource = useCallback(async (id: string) => {
        setSelectedChatSourceId(id);
        if (user?.id) {
            await userPreferences.set(user.id, 'knowledge_base_source_chat', id);
        }
    }, [user?.id]);

    /**
     * Update selected search source and persist preference.
     * @param id - The ID of the search source to select.
     */
    const setSelectedSearchSource = useCallback(async (id: string) => {
        setSelectedSearchSourceId(id);
        if (user?.id) {
            await userPreferences.set(user.id, 'knowledge_base_source_search', id);
        }
    }, [user?.id]);

    return (
        <KnowledgeBaseContext
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
        </KnowledgeBaseContext>
    );
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access Knowledge Base configuration context.
 * Must be used within a KnowledgeBaseProvider.
 * 
 * @returns Knowledge Base context with config and source selection
 * @throws Error if used outside KnowledgeBaseProvider
 * 
 * @example
 * ```tsx
 * const { config, selectedChatSourceId, setSelectedChatSource } = useKnowledgeBase();
 * ```
 */
export function useKnowledgeBase(): KnowledgeBaseContextType {
    const context = useContext(KnowledgeBaseContext);
    if (context === undefined) {
        throw new Error('useKnowledgeBase must be used within a KnowledgeBaseProvider');
    }
    return context;
}
