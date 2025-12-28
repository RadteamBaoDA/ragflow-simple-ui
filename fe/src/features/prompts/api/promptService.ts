
import { api } from '@/lib/api';
import { Prompt, CreatePromptDto, UpdatePromptDto, PromptInteraction, PromptTag } from '../types/prompt';

const BASE_URL = '/api/prompts';
const TAGS_URL = '/api/prompt-tags';

export const promptService = {
    getPrompts: async (params?: { search?: string; tag?: string; tags?: string; source?: string; limit?: number; offset?: number }): Promise<{ data: Prompt[]; total: number }> => {
        const searchParams = new URLSearchParams();
        if (params) {
            if (params.search) searchParams.append('search', params.search);
            if (params.tag) searchParams.append('tag', params.tag);
            if (params.tags) searchParams.append('tags', params.tags);
            if (params.source) searchParams.append('source', params.source);
            if (params.limit !== undefined) searchParams.append('limit', params.limit.toString());
            if (params.offset !== undefined) searchParams.append('offset', params.offset.toString());
        }
        const queryString = searchParams.toString();
        const url = queryString ? `${BASE_URL}?${queryString}` : BASE_URL;
        return api.get<{ data: Prompt[]; total: number }>(url);
    },

    createPrompt: async (data: CreatePromptDto): Promise<Prompt> => {
        return api.post<Prompt>(BASE_URL, data);
    },

    updatePrompt: async (id: string, data: UpdatePromptDto): Promise<Prompt> => {
        return api.put<Prompt>(`${BASE_URL}/${id}`, data);
    },

    deletePrompt: async (id: string): Promise<void> => {
        return api.delete<void>(`${BASE_URL}/${id}`);
    },

    addInteraction: async (data: { prompt_id: string; interaction_type: 'like' | 'dislike' | 'comment'; comment?: string }): Promise<PromptInteraction> => {
        return api.post<PromptInteraction>(`${BASE_URL}/interactions`, data);
    },

    getTags: async (): Promise<string[]> => {
        return api.get<string[]>(`${BASE_URL}/tags`);
    },

    /**
     * Get all unique sources used in prompts.
     */
    getSources: async (): Promise<string[]> => {
        return api.get<string[]>(`${BASE_URL}/sources`);
    },

    /**
     * Get chat source names from knowledge_base_sources for tag dropdown.
     */
    getChatSources: async (): Promise<string[]> => {
        return api.get<string[]>(`${BASE_URL}/chat-sources`);
    },

    /**
     * Get feedback counts (like/dislike) for a prompt.
     */
    getFeedbackCounts: async (promptId: string): Promise<{ like_count: number; dislike_count: number }> => {
        return api.get<{ like_count: number; dislike_count: number }>(`${BASE_URL}/${promptId}/feedback-counts`);
    },

    /**
     * Get all interactions (feedback) for a prompt with optional date filter.
     */
    getInteractions: async (promptId: string, startDate?: string, endDate?: string): Promise<any[]> => {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        const queryString = params.toString();
        const url = queryString
            ? `${BASE_URL}/${promptId}/interactions?${queryString}`
            : `${BASE_URL}/${promptId}/interactions`;
        return api.get<any[]>(url);
    },

    // ========================================================================
    // Prompt Tags API
    // ========================================================================

    /**
     * Get newest tags (default 5).
     * @param limit - Maximum number of tags to return
     */
    getNewestTags: async (limit: number = 5): Promise<PromptTag[]> => {
        return api.get<PromptTag[]>(`${TAGS_URL}?limit=${limit}`);
    },

    /**
     * Search tags by name.
     * @param query - Search query string
     * @param limit - Maximum number of results
     */
    searchTags: async (query: string, limit: number = 10): Promise<PromptTag[]> => {
        const url = query.trim()
            ? `${TAGS_URL}/search?q=${encodeURIComponent(query)}&limit=${limit}`
            : `${TAGS_URL}?limit=${limit}`;
        return api.get<PromptTag[]>(url);
    },

    /**
     * Create a new tag.
     * @param name - Tag name
     * @param color - Tag color in hex format
     */
    createTag: async (name: string, color: string): Promise<PromptTag> => {
        return api.post<PromptTag>(TAGS_URL, { name, color });
    },

    /**
     * Get tags by IDs.
     * @param ids - Array of tag UUIDs
     */
    getTagsByIds: async (ids: string[]): Promise<PromptTag[]> => {
        return api.post<PromptTag[]>(`${TAGS_URL}/by-ids`, { ids });
    },

    // ========================================================================
    // Prompt Permissions API
    // ========================================================================

    getPermissions: async (): Promise<any[]> => {
        return api.get<any[]>(`${BASE_URL}/permissions`);
    },

    setPermission: async (entityType: string, entityId: string, level: number): Promise<void> => {
        return api.post<void>(`${BASE_URL}/permissions`, { entityType, entityId, level });
    },

    getMyPermission: async (): Promise<{ level: number }> => {
        return api.get<{ level: number }>(`${BASE_URL}/permissions/my`);
    }
};

