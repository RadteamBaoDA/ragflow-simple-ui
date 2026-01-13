/**
 * @fileoverview Service for managing Knowledge Base configuration.
 * 
 * Provides API functions for:
 * - Fetching current configuration
 * - Updating system-wide URLs
 * - Managing chat/search sources (add, update, delete)
 * - Fetching paginated sources
 * 
 * @module services/knowledgeBaseService
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/**
 * Represents a knowledge base source (chat or search).
 */
export interface KnowledgeBaseSource {
    /** Unique source ID */
    id: string;
    /** Display name of the source */
    name: string;
    /** URL of the source (iframe URL) */
    url: string;
    /** Description of the source */
    description?: string | null;
    /** Share ID extracted from URL (shared_id param) */
    share_id?: string | null;
    /** URL for embedded chat widget on search page */
    chat_widget_url?: string | null;
    /** Type of source: chat or search */
    type?: 'chat' | 'search';
    /** Access control settings */
    access_control?: AccessControl;
}

/**
 * Access control settings for a source.
 */
export interface AccessControl {
    /** Whether the source is public to all authenticated users */
    public: boolean;
    /** List of team IDs allowed access */
    team_ids: string[];
    /** List of user IDs allowed access */
    user_ids: string[];
}

/**
 * Global configuration for the Knowledge Base.
 */
export interface KnowledgeBaseConfig {
    /** ID of the default chat source */
    defaultChatSourceId: string;
    /** ID of the default search source */
    defaultSearchSourceId: string;
    /** List of all available chat sources */
    chatSources: KnowledgeBaseSource[];
    /** List of all available search sources */
    searchSources: KnowledgeBaseSource[];
}

/**
 * Generic paginated response structure.
 */
export interface PaginatedResponse<T> {
    /** Array of items on the current page */
    data: T[];
    /** Total number of items across all pages */
    total: number;
    /** Current page number */
    page: number;
    /** Number of items per page */
    limit: number;
}

/**
 * Fetch current Knowledge Base configuration.
 * 
 * @returns {Promise<KnowledgeBaseConfig>} The current configuration.
 * @throws {Error} If the fetch fails.
 */
export const getKnowledgeBaseConfig = async (): Promise<KnowledgeBaseConfig> => {
    const response = await fetch(`${API_BASE_URL}/api/knowledge-base/config`, {
        credentials: 'include',
    });

    if (response.status === 401) {
        window.location.href = '/login?error=session_expired';
        throw new Error('Unauthorized');
    }

    if (!response.ok) {
        throw new Error('Failed to fetch configuration');
    }

    return response.json();
};

/**
 * Update system configuration (default source IDs).
 * 
 * @param {object} config - The partial configuration to update.
 * @param {string} [config.defaultChatSourceId] - New default chat source ID.
 * @param {string} [config.defaultSearchSourceId] - New default search source ID.
 * @returns {Promise<void>}
 */
export const updateSystemConfig = async (config: { defaultChatSourceId?: string; defaultSearchSourceId?: string }): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/api/knowledge-base/config`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
        credentials: 'include',
    });

    if (!response.ok) {
        throw new Error('Failed to update configuration');
    }
};

/**
 * Get sources with pagination.
 * 
 * @param {'chat' | 'search'} type - The type of source to fetch.
 * @param {number} page - Page number.
 * @param {number} limit - Items per page.
 * @returns {Promise<PaginatedResponse<KnowledgeBaseSource>>} List of sources.
 */
export const getSources = async (type: 'chat' | 'search', page: number, limit: number): Promise<PaginatedResponse<KnowledgeBaseSource>> => {
    const response = await fetch(`${API_BASE_URL}/api/knowledge-base/sources?type=${type}&page=${page}&limit=${limit}`, {
        credentials: 'include',
    });

    if (response.status === 401) {
        window.location.href = '/login?error=session_expired';
        throw new Error('Unauthorized');
    }

    if (!response.ok) {
        throw new Error('Failed to fetch sources');
    }

    return response.json();
};

/**
 * Add a new source (with permissions).
 * 
 * @param {'chat' | 'search'} type - Source type.
 * @param {string} name - Display name.
 * @param {string} url - Functionality URL.
 * @param {AccessControl} [access_control] - Access control settings.
 * @returns {Promise<KnowledgeBaseSource>} The created source.
 */
export const addSource = async (
    type: 'chat' | 'search',
    name: string,
    url: string,
    access_control: AccessControl = { public: false, team_ids: [], user_ids: [] },
    share_id?: string,
    description?: string,
    chat_widget_url?: string
): Promise<KnowledgeBaseSource> => {
    const response = await fetch(`${API_BASE_URL}/api/knowledge-base/sources`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type, name, url, description, access_control, share_id, chat_widget_url }),
        credentials: 'include',
    });

    if (!response.ok) {
        throw new Error('Failed to add source');
    }

    return response.json();
};

/**
 * Update an existing source.
 * 
 * @param {string} id - Source ID to update.
 * @param {string} name - New name.
 * @param {string} url - New URL.
 * @param {AccessControl} [access_control] - New permissions.
 * @param {string} [share_id] - New share ID.
 * @returns {Promise<void>}
 */
export const updateSource = async (id: string, name: string, url: string, access_control?: AccessControl, share_id?: string, description?: string, chat_widget_url?: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/api/knowledge-base/sources/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, url, description, access_control, share_id, chat_widget_url }),
        credentials: 'include',
    });

    if (!response.ok) {
        throw new Error('Failed to update source');
    }
};

/**
 * Delete a source.
 * 
 * @param {string} id - ID of the source to delete.
 * @returns {Promise<void>}
 */
export const deleteSource = async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/api/knowledge-base/sources/${id}`, {
        method: 'DELETE',
        credentials: 'include',
    });

    if (!response.ok) {
        throw new Error('Failed to delete source');
    }
};
