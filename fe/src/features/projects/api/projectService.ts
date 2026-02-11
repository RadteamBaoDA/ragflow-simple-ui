/**
 * @fileoverview API service for project management.
 * Typed functions for project CRUD, permissions, categories, versions, chats.
 */
import { api, apiFetch } from '@/lib/api'

// ============================================================================
// Types
// ============================================================================

/**
 * Represents a project.
 */
export interface Project {
  id: string
  name: string
  description: string | null
  avatar: string | null
  ragflow_server_id: string | null
  default_embedding_model: string | null
  default_chunk_method: string
  default_parser_config: Record<string, unknown> | null
  status: string
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

/**
 * Represents a project permission.
 */
export interface ProjectPermission {
  id: string
  project_id: string
  grantee_type: 'user' | 'team'
  grantee_id: string
  tab_documents: 'none' | 'view' | 'manage'
  tab_chat: 'none' | 'view' | 'manage'
  tab_settings: 'none' | 'view' | 'manage'
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

/**
 * Represents a document category.
 */
export interface DocumentCategory {
  id: string
  project_id: string
  name: string
  description: string | null
  sort_order: number
  dataset_config: Record<string, any> | null
  created_by: string | null
  created_at: string
  updated_at: string
}

/**
 * Represents a version of a document category.
 */
export interface DocumentCategoryVersion {
  id: string
  category_id: string
  version_label: string
  ragflow_dataset_id: string | null
  ragflow_dataset_name: string | null
  status: string
  last_synced_at: string | null
  metadata: Record<string, unknown>
  created_by: string | null
  created_at: string
  updated_at: string
}

/**
 * Represents a project chat assistant.
 */
export interface ProjectChat {
  id: string
  project_id: string
  name: string
  ragflow_chat_id: string | null
  dataset_ids: string[]
  ragflow_dataset_ids: string[]
  llm_config: Record<string, unknown>
  prompt_config: Record<string, unknown>
  status: string
  last_synced_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// ============================================================================
// Project API
// ============================================================================

/**
 * List projects accessible to the current user.
 */
export const getProjects = (): Promise<Project[]> =>
  api.get('/api/projects')

/**
 * Get a project by ID.
 */
export const getProjectById = (id: string): Promise<Project> =>
  api.get(`/api/projects/${id}`)

/**
 * Create a new project.
 */
export const createProject = (data: {
  name: string
  description?: string
  avatar?: string
  ragflow_server_id?: string
  default_embedding_model?: string
  default_chunk_method?: string
  default_parser_config?: Record<string, unknown>
}): Promise<Project> =>
  api.post('/api/projects', data)

/**
 * Update a project.
 */
export const updateProject = (id: string, data: Partial<Project>): Promise<Project> =>
  api.put(`/api/projects/${id}`, data)

/**
 * Delete a project.
 */
export const deleteProject = (id: string): Promise<void> =>
  api.delete(`/api/projects/${id}`)

// ============================================================================
// Permissions API
// ============================================================================

/**
 * Get permissions for a project.
 */
export const getProjectPermissions = (projectId: string): Promise<ProjectPermission[]> =>
  api.get(`/api/projects/${projectId}/permissions`)

/**
 * Set a permission for a grantee on a project.
 */
export const setProjectPermission = (projectId: string, data: {
  grantee_type: string
  grantee_id: string
  tab_documents: string
  tab_chat: string
  tab_settings: string
}): Promise<ProjectPermission> =>
  api.post(`/api/projects/${projectId}/permissions`, data)

/**
 * Remove a permission.
 */
export const removeProjectPermission = (projectId: string, permissionId: string): Promise<void> =>
  api.delete(`/api/projects/${projectId}/permissions/${permissionId}`)

// ============================================================================
// Document Categories API
// ============================================================================

/**
 * List categories for a project.
 */
export const getDocumentCategories = (projectId: string): Promise<DocumentCategory[]> =>
  api.get(`/api/projects/${projectId}/categories`)

/**
 * Create a document category.
 */
export const createDocumentCategory = (projectId: string, data: {
  name: string
  description?: string
  sort_order?: number
  dataset_config?: Record<string, any>
}): Promise<DocumentCategory> =>
  api.post(`/api/projects/${projectId}/categories`, data)

/**
 * Update a document category.
 */
export const updateDocumentCategory = (projectId: string, categoryId: string, data: Partial<DocumentCategory>): Promise<DocumentCategory> =>
  api.put(`/api/projects/${projectId}/categories/${categoryId}`, data)

/**
 * Delete a document category.
 */
export const deleteDocumentCategory = (projectId: string, categoryId: string): Promise<void> =>
  api.delete(`/api/projects/${projectId}/categories/${categoryId}`)

// ============================================================================
// Document Category Versions API
// ============================================================================

/**
 * List versions for a category.
 */
export const getCategoryVersions = (projectId: string, categoryId: string): Promise<DocumentCategoryVersion[]> =>
  api.get(`/api/projects/${projectId}/categories/${categoryId}/versions`)

/**
 * Create a new version.
 */
export const createCategoryVersion = (projectId: string, categoryId: string, data: {
  version_label: string
}): Promise<DocumentCategoryVersion> =>
  api.post(`/api/projects/${projectId}/categories/${categoryId}/versions`, data)

/**
 * Sync a version from RAGFlow.
 */
export const syncCategoryVersion = (projectId: string, categoryId: string, versionId: string): Promise<DocumentCategoryVersion> =>
  api.post(`/api/projects/${projectId}/categories/${categoryId}/versions/${versionId}/sync`)

/**
 * Archive a version.
 */
export const archiveCategoryVersion = (projectId: string, categoryId: string, versionId: string): Promise<DocumentCategoryVersion> =>
  api.put(`/api/projects/${projectId}/categories/${categoryId}/versions/${versionId}/archive`)

/**
 * Update a version's metadata (e.g. label).
 */
export const updateCategoryVersion = (
  projectId: string,
  categoryId: string,
  versionId: string,
  data: { version_label?: string }
): Promise<DocumentCategoryVersion> =>
  api.put(`/api/projects/${projectId}/categories/${categoryId}/versions/${versionId}`, data)

/**
 * Delete a version.
 */
export const deleteCategoryVersion = (projectId: string, categoryId: string, versionId: string): Promise<void> =>
  api.delete(`/api/projects/${projectId}/categories/${categoryId}/versions/${versionId}`)

// ============================================================================
// Version Documents API
// ============================================================================

/**
 * Represents a document stored in a RAGFlow dataset.
 */
export interface VersionDocument {
  id: string
  name: string
  size: number
  type: string
  run: string
  status: string
  created_by: string
  create_time: number
  update_time: number
  chunk_count: number
  token_count: number
  progress: number
  progress_msg: string
}

/**
 * List documents in a version's dataset.
 */
export const getVersionDocuments = (projectId: string, categoryId: string, versionId: string, query?: {
  page?: number
  page_size?: number
  keywords?: string
}): Promise<VersionDocument[]> => {
  const params = new URLSearchParams()
  if (query?.page) params.set('page', String(query.page))
  if (query?.page_size) params.set('page_size', String(query.page_size))
  if (query?.keywords) params.set('keywords', query.keywords)
  const qs = params.toString()
  return api.get(`/api/projects/${projectId}/categories/${categoryId}/versions/${versionId}/documents${qs ? '?' + qs : ''}`)
}

/**
 * Upload a document to a version's dataset.
 * Uses FormData for multipart upload.
 */
export const uploadVersionDocument = (projectId: string, categoryId: string, versionId: string, file: File): Promise<unknown> => {
  const formData = new FormData()
  formData.append('file', file)
  return apiFetch(`/api/projects/${projectId}/categories/${categoryId}/versions/${versionId}/documents`, {
    method: 'POST',
    body: formData,
    headers: {} // Let browser set multipart content-type
  })
}

// ============================================================================
// Project Chats API
// ============================================================================

/**
 * List chat assistants for a project.
 */
export const getProjectChats = (projectId: string): Promise<ProjectChat[]> =>
  api.get(`/api/projects/${projectId}/chats`)

/**
 * Get a chat assistant by ID.
 */
export const getProjectChatById = (projectId: string, chatId: string): Promise<ProjectChat> =>
  api.get(`/api/projects/${projectId}/chats/${chatId}`)

/**
 * Create a chat assistant.
 */
export const createProjectChat = (projectId: string, data: {
  name: string
  dataset_ids?: string[]
  ragflow_dataset_ids?: string[]
  llm_config?: Record<string, unknown>
  prompt_config?: Record<string, unknown>
}): Promise<ProjectChat> =>
  api.post(`/api/projects/${projectId}/chats`, data)

/**
 * Update a chat assistant.
 */
export const updateProjectChat = (projectId: string, chatId: string, data: Partial<ProjectChat>): Promise<ProjectChat> =>
  api.put(`/api/projects/${projectId}/chats/${chatId}`, data)

/**
 * Delete a chat assistant.
 */
export const deleteProjectChat = (projectId: string, chatId: string): Promise<void> =>
  api.delete(`/api/projects/${projectId}/chats/${chatId}`)

/**
 * Sync a chat assistant from RAGFlow.
 */
export const syncProjectChat = (projectId: string, chatId: string): Promise<ProjectChat> =>
  api.post(`/api/projects/${projectId}/chats/${chatId}/sync`)
