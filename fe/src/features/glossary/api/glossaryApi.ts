
/**
 * Glossary API service — Frontend API calls for glossary management.
 * Uses the shared api client from @/lib/api.
 * @module features/glossary/api/glossaryApi
 */
import { api } from '@/lib/api'

const BASE_URL = '/api/glossary'

// ============================================================================
// TypeScript interfaces for glossary entities
// ============================================================================

/** Glossary task entity */
export interface GlossaryTask {
    id: string
    name: string
    description?: string | null
    task_instruction: string
    context_template: string
    sort_order: number
    is_active: boolean
    created_by?: string | null
    updated_by?: string | null
    created_at: string
    updated_at: string
}

/** Glossary keyword entity */
export interface GlossaryKeyword {
    id: string
    task_id: string
    name: string
    description?: string | null
    sort_order: number
    is_active: boolean
    created_by?: string | null
    updated_by?: string | null
    created_at: string
    updated_at: string
}

/** Task with nested keywords (tree node) */
export interface GlossaryTaskWithKeywords extends GlossaryTask {
    keywords: GlossaryKeyword[]
}

/** DTO for creating/updating a task */
export interface CreateTaskDto {
    name: string
    description?: string
    task_instruction: string
    context_template: string
    sort_order?: number
    is_active?: boolean
}

/** DTO for creating/updating a keyword */
export interface CreateKeywordDto {
    name: string
    description?: string
    sort_order?: number
    is_active?: boolean
}

/** Row structure for bulk import */
export interface BulkImportRow {
    task_name: string
    task_instruction: string
    context_template: string
    keyword: string
    keyword_description?: string | undefined
}

/** Result of bulk import */
export interface BulkImportResult {
    success: boolean
    tasksCreated: number
    keywordsCreated: number
    skipped: number
    errors: string[]
}

// ============================================================================
// API Service
// ============================================================================

export const glossaryApi = {

    // ========================================================================
    // Task CRUD
    // ========================================================================

    /** List all glossary tasks */
    listTasks: async (): Promise<GlossaryTask[]> => {
        return api.get<GlossaryTask[]>(`${BASE_URL}/tasks`)
    },

    /** Get a single task with its keywords */
    getTask: async (id: string): Promise<GlossaryTaskWithKeywords> => {
        return api.get<GlossaryTaskWithKeywords>(`${BASE_URL}/tasks/${id}`)
    },

    /** Create a new task */
    createTask: async (data: CreateTaskDto): Promise<GlossaryTask> => {
        return api.post<GlossaryTask>(`${BASE_URL}/tasks`, data)
    },

    /** Update a task */
    updateTask: async (id: string, data: Partial<CreateTaskDto>): Promise<GlossaryTask> => {
        return api.put<GlossaryTask>(`${BASE_URL}/tasks/${id}`, data)
    },

    /** Delete a task (cascades keywords) */
    deleteTask: async (id: string): Promise<void> => {
        return api.delete<void>(`${BASE_URL}/tasks/${id}`)
    },

    // ========================================================================
    // Keyword CRUD
    // ========================================================================

    /** List keywords for a task */
    listKeywords: async (taskId: string): Promise<GlossaryKeyword[]> => {
        return api.get<GlossaryKeyword[]>(`${BASE_URL}/tasks/${taskId}/keywords`)
    },

    /** Create a keyword under a task */
    createKeyword: async (taskId: string, data: CreateKeywordDto): Promise<GlossaryKeyword> => {
        return api.post<GlossaryKeyword>(`${BASE_URL}/tasks/${taskId}/keywords`, data)
    },

    /** Update a keyword */
    updateKeyword: async (id: string, data: Partial<CreateKeywordDto>): Promise<GlossaryKeyword> => {
        return api.put<GlossaryKeyword>(`${BASE_URL}/keywords/${id}`, data)
    },

    /** Delete a keyword */
    deleteKeyword: async (id: string): Promise<void> => {
        return api.delete<void>(`${BASE_URL}/keywords/${id}`)
    },

    // ========================================================================
    // Prompt Builder
    // ========================================================================

    /** Get the full glossary tree (active tasks + keywords) for Prompt Builder */
    getTree: async (): Promise<GlossaryTaskWithKeywords[]> => {
        return api.get<GlossaryTaskWithKeywords[]>(`${BASE_URL}/tree`)
    },

    /** Search tasks and keywords by name */
    search: async (query: string): Promise<{ tasks: GlossaryTask[]; keywords: GlossaryKeyword[] }> => {
        return api.get<{ tasks: GlossaryTask[]; keywords: GlossaryKeyword[] }>(
            `${BASE_URL}/search?q=${encodeURIComponent(query)}`
        )
    },

    /** Generate a prompt from task + selected keywords */
    generatePrompt: async (taskId: string, keywordIds: string[]): Promise<{ prompt: string }> => {
        return api.post<{ prompt: string }>(`${BASE_URL}/generate-prompt`, { taskId, keywordIds })
    },

    // ========================================================================
    // Bulk Import
    // ========================================================================

    /** Bulk import tasks and keywords from parsed Excel rows */
    bulkImport: async (rows: BulkImportRow[]): Promise<BulkImportResult> => {
        return api.post<BulkImportResult>(`${BASE_URL}/bulk-import`, { rows })
    },
}
