/**
 * @fileoverview Service for managing RAGFlow configuration.
 * 
 * Provides API functions for:
 * - Fetching current configuration
 * - Updating system-wide URLs
 * - Managing chat/search sources (add, update, delete)
 * 
 * @module services/ragflowConfigService
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export interface RagflowSource {
    id: string;
    name: string;
    url: string;
    type?: 'chat' | 'search';
}

export interface RagflowConfig {
    defaultChatSourceId: string;
    defaultSearchSourceId: string;
    chatSources: RagflowSource[];
    searchSources: RagflowSource[];
}

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
}

/**
 * Fetch current RAGFlow configuration.
 */
export const getRagflowConfig = async (): Promise<RagflowConfig> => {
    const response = await fetch(`${API_BASE_URL}/api/ragflow/config`, {
        credentials: 'include',
    });

    if (!response.ok) {
        throw new Error('Failed to fetch RAGFlow configuration');
    }

    return response.json();
};

/**
 * Fetch paginated sources.
 */
export const getSourcesPaginated = async (type: 'chat' | 'search', page: number = 1, limit: number = 10): Promise<PaginatedResponse<RagflowSource>> => {
    const response = await fetch(`${API_BASE_URL}/api/ragflow/sources?type=${type}&page=${page}&limit=${limit}`, {
        credentials: 'include',
    });

    if (!response.ok) {
        throw new Error('Failed to fetch sources');
    }

    return response.json();
};

/**
 * Update system-wide configuration (Default Source IDs).
 */
export const updateSystemUrls = async (defaults: { defaultChatSourceId?: string, defaultSearchSourceId?: string }): Promise<{ success: boolean }> => {
    const response = await fetch(`${API_BASE_URL}/api/ragflow/config`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(defaults),
    });

    if (!response.ok) {
        throw new Error('Failed to update system configuration');
    }

    return response.json();
};

/**
 * Add a new source.
 */
export const addSource = async (type: 'chat' | 'search', name: string, url: string): Promise<{ success: boolean }> => {
    const response = await fetch(`${API_BASE_URL}/api/ragflow/sources`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ type, name, url }),
    });

    if (!response.ok) {
        throw new Error('Failed to add source');
    }

    return response.json();
};

/**
 * Update an existing source.
 */
export const updateSource = async (id: string, name: string, url: string): Promise<{ success: boolean }> => {
    const response = await fetch(`${API_BASE_URL}/api/ragflow/sources`, {
        method: 'POST', // Backend uses POST for both add and update
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ id, name, url }),
    });

    if (!response.ok) {
        throw new Error('Failed to update source');
    }
    return response.json();
};

/**
 * Delete a source.
 */
export const deleteSource = async (id: string): Promise<{ success: boolean }> => {
    const response = await fetch(`${API_BASE_URL}/api/ragflow/sources/${id}`, {
        method: 'DELETE',
        credentials: 'include',
    });

    if (!response.ok) {
        throw new Error('Failed to delete source');
    }
    return response.json();
};
