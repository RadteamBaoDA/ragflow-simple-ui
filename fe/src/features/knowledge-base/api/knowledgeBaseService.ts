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

export interface KnowledgeBaseSource {
    id: string;
    name: string;
    url: string;
    type?: 'chat' | 'search';
    access_control?: AccessControl;
}

export interface AccessControl {
    public: boolean;
    team_ids: string[];
    user_ids: string[];
}

export interface KnowledgeBaseConfig {
    defaultChatSourceId: string;
    defaultSearchSourceId: string;
    chatSources: KnowledgeBaseSource[];
    searchSources: KnowledgeBaseSource[];
}

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
}

/**
 * Fetch current Knowledge Base configuration.
 */
export const getKnowledgeBaseConfig = async (): Promise<KnowledgeBaseConfig> => {
    const response = await fetch(`${API_BASE_URL}/api/knowledge-base/config`, {
        credentials: 'include',
    });

    if (!response.ok) {
        throw new Error('Failed to fetch configuration');
    }

    return response.json();
};

/**
 * Update system configuration (default source IDs).
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
 */
export const getSources = async (type: 'chat' | 'search', page: number, limit: number): Promise<PaginatedResponse<KnowledgeBaseSource>> => {
    const response = await fetch(`${API_BASE_URL}/api/knowledge-base/sources?type=${type}&page=${page}&limit=${limit}`, {
        credentials: 'include',
    });

    if (!response.ok) {
        throw new Error('Failed to fetch sources');
    }

    return response.json();
};

/**
 * Add a new source (with permissions).
 */
export const addSource = async (
    type: 'chat' | 'search',
    name: string,
    url: string,
    access_control: AccessControl = { public: false, team_ids: [], user_ids: [] }
): Promise<KnowledgeBaseSource> => {
    const response = await fetch(`${API_BASE_URL}/api/knowledge-base/sources`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type, name, url, access_control }),
        credentials: 'include',
    });

    if (!response.ok) {
        throw new Error('Failed to add source');
    }

    return response.json();
};

/**
 * Update an existing source.
 */
export const updateSource = async (id: string, name: string, url: string, access_control?: AccessControl): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/api/knowledge-base/sources/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, url, access_control }),
        credentials: 'include',
    });

    if (!response.ok) {
        throw new Error('Failed to update source');
    }
};

/**
 * Delete a source.
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
