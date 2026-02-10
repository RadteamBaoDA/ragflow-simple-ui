
/**
 * DocumentCategoryService: Business logic for document categories and versions.
 * Handles category CRUD, version lifecycle, and local file storage.
 * Implements Singleton pattern.
 *
 * NOTE: Files are saved locally to {UPLOAD_DIR}/{projectId}/{categoryId}/{versionId}/.
 * A future task converter will transform and push them to RAGFlow.
 */
import { ModelFactory } from '@/models/factory.js'
import { DocumentCategory, DocumentCategoryVersion } from '@/models/types.js'
import { ragflowProxyService } from '@/services/ragflow-proxy.service.js'
import { config } from '@/config/index.js'
import { promises as fs } from 'fs'
import path from 'path'

/**
 * Service managing document categories and their versions.
 */
export class DocumentCategoryService {
  private static instance: DocumentCategoryService

  /**
   * Get the shared singleton instance.
   * @returns DocumentCategoryService singleton
   */
  static getSharedInstance(): DocumentCategoryService {
    if (!this.instance) {
      this.instance = new DocumentCategoryService()
    }
    return this.instance
  }

  // =========================================================================
  // Category CRUD
  // =========================================================================

  /**
   * List categories for a project.
   * @param projectId - Project UUID
   * @returns Sorted array of categories
   */
  async listByProject(projectId: string): Promise<DocumentCategory[]> {
    return ModelFactory.documentCategory.findByProject(projectId)
  }

  /**
   * Create a new category within a project.
   * @param data - Category data
   * @param userId - User performing the action
   * @returns Created category
   */
  async createCategory(data: {
    project_id: string
    name: string
    description?: string
    sort_order?: number
  }, userId?: string): Promise<DocumentCategory> {
    return ModelFactory.documentCategory.create({
      ...data,
      created_by: userId ?? null,
      updated_by: userId ?? null
    } as Partial<DocumentCategory>)
  }

  /**
   * Update a category.
   * @param id - Category UUID
   * @param data - Fields to update
   * @param userId - User performing the action
   * @returns Updated category
   */
  async updateCategory(id: string, data: Partial<DocumentCategory>, userId?: string): Promise<DocumentCategory> {
    const existing = await ModelFactory.documentCategory.findById(id)
    if (!existing) throw new Error('Category not found')
    const updated = await ModelFactory.documentCategory.update(id, { ...data, updated_by: userId ?? null })
    if (!updated) throw new Error('Category not found after update')
    return updated
  }

  /**
   * Delete a category and all its versions.
   * Also deletes corresponding RAGFlow datasets.
   * @param id - Category UUID
   * @param serverId - RAGFlow server ID for cleanup
   */
  async deleteCategory(id: string, serverId?: string): Promise<void> {
    const existing = await ModelFactory.documentCategory.findById(id)
    if (!existing) throw new Error('Category not found')

    // Clean up RAGFlow datasets for all versions
    if (serverId) {
      const versions = await ModelFactory.documentCategoryVersion.findByCategory(id)
      const ragflowIds = versions
        .map(v => v.ragflow_dataset_id)
        .filter((rid): rid is string => !!rid)
      if (ragflowIds.length > 0) {
        try {
          await ragflowProxyService.deleteDatasets(serverId, ragflowIds)
        } catch (err) {
          console.error('Failed to delete RAGFlow datasets during category cleanup:', err)
        }
      }
    }

    // Cascade delete handled by DB FK
    await ModelFactory.documentCategory.delete(id)
  }

  // =========================================================================
  // Version CRUD
  // =========================================================================

  /**
   * List versions for a category.
   * @param categoryId - Category UUID
   * @returns Array of versions
   */
  async listVersions(categoryId: string): Promise<DocumentCategoryVersion[]> {
    return ModelFactory.documentCategoryVersion.findByCategory(categoryId)
  }

  /**
   * Create a new version for a category.
   * Automatically creates a corresponding RAGFlow dataset.
   * @param data - Version data
   * @param serverId - RAGFlow server ID
   * @param projectDefaults - Default settings from the project
   * @param userId - User performing the action
   * @returns Created version with RAGFlow dataset info
   */
  async createVersion(data: {
    category_id: string
    version_label: string
  }, serverId: string, projectDefaults: {
    embedding_model?: string
    chunk_method?: string
    parser_config?: Record<string, any>
  }, userId?: string): Promise<DocumentCategoryVersion> {
    // Resolve category name for dataset naming
    const category = await ModelFactory.documentCategory.findById(data.category_id)
    if (!category) throw new Error('Category not found')

    // Build dataset name: "ProjectCategory - VersionLabel"
    const project = await ModelFactory.project.findById(category.project_id)
    const datasetName = `${project?.name || 'Project'}_${category.name}_${data.version_label}`

    // Create RAGFlow dataset
    let ragflowDataset: any = null
    try {
      ragflowDataset = await ragflowProxyService.createDataset(serverId, {
        name: datasetName,
        embedding_model: projectDefaults.embedding_model || 'bge-m3',
        chunk_method: projectDefaults.chunk_method || 'naive',
        parser_config: projectDefaults.parser_config || {}
      })
    } catch (err) {
      console.error('Failed to create RAGFlow dataset:', err)
      throw new Error('Failed to create RAGFlow dataset. Please verify server connection.')
    }

    // Create local version record
    return ModelFactory.documentCategoryVersion.create({
      category_id: data.category_id,
      version_label: data.version_label,
      ragflow_dataset_id: ragflowDataset?.id,
      ragflow_dataset_name: datasetName,
      status: 'active',
      last_synced_at: new Date(),
      metadata: ragflowDataset || {},
      created_by: userId ?? null,
      updated_by: userId ?? null
    } as Partial<DocumentCategoryVersion>)
  }

  /**
   * Update a version's metadata by syncing with RAGFlow.
   * @param versionId - Version UUID
   * @param serverId - RAGFlow server ID
   * @returns Updated version
   */
  async syncVersion(versionId: string, serverId: string): Promise<DocumentCategoryVersion> {
    const version = await ModelFactory.documentCategoryVersion.findById(versionId)
    if (!version) throw new Error('Version not found')
    if (!version.ragflow_dataset_id) throw new Error('Version has no RAGFlow dataset linked')

    // Fetch latest dataset info from RAGFlow
    const datasets = await ragflowProxyService.listDatasets(serverId, { id: version.ragflow_dataset_id })
    const dataset = datasets?.[0]

    const updated = await ModelFactory.documentCategoryVersion.update(versionId, {
      ragflow_dataset_name: dataset?.name || version.ragflow_dataset_name,
      metadata: dataset || version.metadata,
      last_synced_at: new Date()
    })
    if (!updated) throw new Error('Version not found after update')
    return updated
  }

  /**
   * Archive a version (soft delete).
   * @param versionId - Version UUID
   * @param userId - User performing the action
   * @returns Updated version
   */
  async archiveVersion(versionId: string, userId?: string): Promise<DocumentCategoryVersion> {
    const version = await ModelFactory.documentCategoryVersion.findById(versionId)
    if (!version) throw new Error('Version not found')
    const updated = await ModelFactory.documentCategoryVersion.update(versionId, {
      status: 'archived',
      updated_by: userId ?? null
    })
    if (!updated) throw new Error('Version not found after update')
    return updated
  }

  /**
   * Update a version's metadata (e.g. version_label).
   * @param versionId - Version UUID
   * @param data - Fields to update
   * @param userId - User performing the action
   * @returns Updated version
   */
  async updateVersion(
    versionId: string,
    data: { version_label?: string },
    userId?: string
  ): Promise<DocumentCategoryVersion> {
    const version = await ModelFactory.documentCategoryVersion.findById(versionId)
    if (!version) throw new Error('Version not found')
    const updated = await ModelFactory.documentCategoryVersion.update(versionId, {
      ...data,
      updated_by: userId ?? null
    })
    if (!updated) throw new Error('Version not found after update')
    return updated
  }

  /**
   * Delete a version and its RAGFlow dataset.
   * @param versionId - Version UUID
   * @param serverId - RAGFlow server ID
   */
  async deleteVersion(versionId: string, serverId?: string): Promise<void> {
    const version = await ModelFactory.documentCategoryVersion.findById(versionId)
    if (!version) throw new Error('Version not found')

    // Delete RAGFlow dataset if exists
    if (serverId && version.ragflow_dataset_id) {
      try {
        await ragflowProxyService.deleteDatasets(serverId, [version.ragflow_dataset_id])
      } catch (err) {
        console.error('Failed to delete RAGFlow dataset:', err)
      }
    }

    await ModelFactory.documentCategoryVersion.delete(versionId)
  }

  // =========================================================================
  // Document Operations (local file storage)
  // =========================================================================

  /**
   * Build the local storage directory path for a version's documents.
   * @param projectId - Project UUID
   * @param categoryId - Category UUID
   * @param versionId - Version UUID
   * @returns Absolute directory path
   */
  private getUploadDir(projectId: string, categoryId: string, versionId: string): string {
    return path.resolve(config.uploadDir, projectId, categoryId, versionId)
  }

  /**
   * Upload a document to local storage.
   * Files are saved to {UPLOAD_DIR}/{projectId}/{categoryId}/{versionId}/{filename}.
   * A future task converter will transform and push them to RAGFlow.
   *
   * @param projectId - Project UUID
   * @param categoryId - Category UUID
   * @param versionId - Version UUID
   * @param file - File buffer
   * @param fileName - Original file name
   * @returns Upload result with file info
   */
  async uploadDocument(
    projectId: string,
    categoryId: string,
    versionId: string,
    file: Buffer,
    fileName: string
  ): Promise<{ name: string; size: number; path: string }> {
    const version = await ModelFactory.documentCategoryVersion.findById(versionId)
    if (!version) throw new Error('Version not found')

    // Ensure upload directory exists
    const dir = this.getUploadDir(projectId, categoryId, versionId)
    await fs.mkdir(dir, { recursive: true })

    // Write file to disk
    const filePath = path.join(dir, fileName)
    await fs.writeFile(filePath, file)

    console.log(`Document saved locally: ${filePath} (${file.length} bytes)`)

    return {
      name: fileName,
      size: file.length,
      path: filePath,
    }
  }

  /**
   * List documents stored locally for a version.
   * Reads file metadata from the local upload directory.
   *
   * @param projectId - Project UUID
   * @param categoryId - Category UUID
   * @param versionId - Version UUID
   * @param query - Optional search/pagination parameters
   * @returns Array of document metadata objects
   */
  async listDocuments(
    projectId: string,
    categoryId: string,
    versionId: string,
    query?: { page?: number; page_size?: number; keywords?: string }
  ): Promise<any[]> {
    const dir = this.getUploadDir(projectId, categoryId, versionId)

    // If directory doesn't exist yet, return empty
    try {
      await fs.access(dir)
    } catch {
      return []
    }

    // Read directory entries with file stats
    const entries = await fs.readdir(dir)
    let files: any[] = (await Promise.all(
      entries.map(async (name) => {
        const filePath = path.join(dir, name)
        const stat = await fs.stat(filePath)
        if (!stat.isFile()) return null
        return {
          id: name,
          name,
          size: stat.size,
          type: path.extname(name).replace('.', ''),
          run: 'local',
          status: 'pending_conversion',
          created_by: '',
          create_time: Math.floor(stat.birthtimeMs / 1000),
          update_time: Math.floor(stat.mtimeMs / 1000),
          chunk_count: 0,
          token_count: 0,
          progress: 0,
          progress_msg: '',
        }
      })
    )).filter(Boolean)

    // Apply keyword filter
    if (query?.keywords) {
      const kw = query.keywords.toLowerCase()
      files = files.filter((f: any) => f.name.toLowerCase().includes(kw))
    }

    // Apply pagination
    const page = query?.page ?? 1
    const pageSize = query?.page_size ?? 100
    const start = (page - 1) * pageSize
    return files.slice(start, start + pageSize)
  }
}

export const documentCategoryService = DocumentCategoryService.getSharedInstance()
