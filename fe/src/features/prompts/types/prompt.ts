
export interface Prompt {
    id: string;
    prompt: string;
    description?: string;
    tags: string[];
    source: string;
    is_active: boolean;
    like_count?: number;
    dislike_count?: number;
    created_at: string;
    updated_at: string;
}

export interface PromptInteraction {
    id: string;
    prompt_id: string;
    user_id?: string;
    interaction_type: 'like' | 'dislike' | 'comment';
    comment?: string;
    created_at: string;
}

/**
 * PromptTag interface for reusable tags with colors.
 */
export interface PromptTag {
    id: string;
    name: string;
    color: string;
}

export interface CreatePromptDto {
    prompt: string;
    description?: string;
    tags?: string[];
    source?: string;
}


export interface UpdatePromptDto {
    prompt?: string;
    description?: string;
    tags?: string[];
    source?: string;
    is_active?: boolean;
}
