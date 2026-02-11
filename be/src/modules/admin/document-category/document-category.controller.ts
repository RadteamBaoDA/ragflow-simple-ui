
/**
 * DocumentCategoryController: Handles HTTP requests for document categories and versions.
 */
import { Request, Response } from 'express'
import { documentCategoryService } from '@/services/document-category.service.js'
import { ModelFactory } from '@/models/factory.js'

/**
 * Controller for document category and version API endpoints.
 */
export class DocumentCategoryController {
  // =========================================================================
  // Categories
  // =========================================================================

  /**
   * List categories for a project.
   * GET /api/projects/:projectId/categories
   */
  static async listCategories(req: Request, res: Response) {
    try {
      const categories = await documentCategoryService.listByProject(req.params.projectId)
      res.json(categories)
    } catch (error) {
      console.error('Error listing categories:', error)
      res.status(500).json({ error: 'Failed to list categories' })
    }
  }

  /**
   * Create a new category.
   * POST /api/projects/:projectId/categories
   */
  static async createCategory(req: Request, res: Response) {
    try {
      const { name, description, sort_order, dataset_config } = req.body
      if (!name) {
        res.status(400).json({ error: 'Category name is required' })
        return
      }
      // @ts-ignore
      const userId = req.user?.id
      const category = await documentCategoryService.createCategory({
        project_id: req.params.projectId,
        name,
        description,
        sort_order,
        dataset_config
      }, userId)
      res.status(201).json(category)
    } catch (error: any) {
      console.error('Error creating category:', error)
      if (error.message?.includes('unique')) {
        res.status(409).json({ error: 'Category name already exists in this project' })
        return
      }
      res.status(500).json({ error: 'Failed to create category' })
    }
  }

  /**
   * Update a category.
   * PUT /api/projects/:projectId/categories/:categoryId
   */
  static async updateCategory(req: Request, res: Response) {
    try {
      // @ts-ignore
      const userId = req.user?.id
      const category = await documentCategoryService.updateCategory(
        req.params.categoryId, req.body, userId
      )
      res.json(category)
    } catch (error: any) {
      console.error('Error updating category:', error)
      if (error.message === 'Category not found') {
        res.status(404).json({ error: 'Category not found' })
        return
      }
      res.status(500).json({ error: 'Failed to update category' })
    }
  }

  /**
   * Delete a category.
   * DELETE /api/projects/:projectId/categories/:categoryId
   */
  static async deleteCategory(req: Request, res: Response) {
    try {
      // Get project's ragflow server ID for cleanup
      const project = await ModelFactory.project.findById(req.params.projectId)
      await documentCategoryService.deleteCategory(
        req.params.categoryId,
        project?.ragflow_server_id || undefined
      )
      res.status(204).send()
    } catch (error: any) {
      console.error('Error deleting category:', error)
      if (error.message === 'Category not found') {
        res.status(404).json({ error: 'Category not found' })
        return
      }
      res.status(500).json({ error: 'Failed to delete category' })
    }
  }

  // =========================================================================
  // Versions
  // =========================================================================

  /**
   * List versions for a category.
   * GET /api/projects/:projectId/categories/:categoryId/versions
   */
  static async listVersions(req: Request, res: Response) {
    try {
      const versions = await documentCategoryService.listVersions(req.params.categoryId)
      res.json(versions)
    } catch (error) {
      console.error('Error listing versions:', error)
      res.status(500).json({ error: 'Failed to list versions' })
    }
  }

  /**
   * Create a new version (and its RAGFlow dataset).
   * POST /api/projects/:projectId/categories/:categoryId/versions
   */
  static async createVersion(req: Request, res: Response) {
    try {
      const { version_label } = req.body
      if (!version_label) {
        res.status(400).json({ error: 'version_label is required' })
        return
      }

      // Resolve project for server ID and defaults
      const project = await ModelFactory.project.findById(req.params.projectId)
      if (!project?.ragflow_server_id) {
        res.status(400).json({ error: 'Project must have a RAGFlow server assigned' })
        return
      }

      // @ts-ignore
      const userId = req.user?.id
      const version = await documentCategoryService.createVersion(
        { category_id: req.params.categoryId, version_label },
        project.ragflow_server_id,
        {
          embedding_model: project.default_embedding_model || undefined,
          chunk_method: project.default_chunk_method,
          parser_config: project.default_parser_config
        },
        userId
      )
      res.status(201).json(version)
    } catch (error: any) {
      console.error('Error creating version:', error)
      if (error.message?.includes('unique')) {
        res.status(409).json({ error: 'Version label already exists for this category' })
        return
      }
      res.status(500).json({ error: error.message || 'Failed to create version' })
    }
  }

  /**
   * Sync a version's metadata from RAGFlow.
   * POST /api/projects/:projectId/categories/:categoryId/versions/:versionId/sync
   */
  static async syncVersion(req: Request, res: Response) {
    try {
      const project = await ModelFactory.project.findById(req.params.projectId)
      if (!project?.ragflow_server_id) {
        res.status(400).json({ error: 'Project must have a RAGFlow server assigned' })
        return
      }
      const version = await documentCategoryService.syncVersion(
        req.params.versionId, project.ragflow_server_id
      )
      res.json(version)
    } catch (error: any) {
      console.error('Error syncing version:', error)
      res.status(500).json({ error: error.message || 'Failed to sync version' })
    }
  }

  /**
   * Archive a version.
   * PUT /api/projects/:projectId/categories/:categoryId/versions/:versionId/archive
   */
  static async archiveVersion(req: Request, res: Response) {
    try {
      // @ts-ignore
      const userId = req.user?.id
      const version = await documentCategoryService.archiveVersion(req.params.versionId, userId)
      res.json(version)
    } catch (error: any) {
      console.error('Error archiving version:', error)
      res.status(500).json({ error: error.message || 'Failed to archive version' })
    }
  }

  /**
   * Update a version's metadata (e.g. label).
   * PUT /api/projects/:projectId/categories/:categoryId/versions/:versionId
   */
  static async updateVersion(req: Request, res: Response) {
    try {
      // @ts-ignore
      const userId = req.user?.id
      const { version_label } = req.body
      const version = await documentCategoryService.updateVersion(
        req.params.versionId,
        { version_label },
        userId
      )
      res.json(version)
    } catch (error: any) {
      console.error('Error updating version:', error)
      if (error.message === 'Version not found') {
        res.status(404).json({ error: 'Version not found' })
        return
      }
      res.status(500).json({ error: error.message || 'Failed to update version' })
    }
  }

  /**
   * Delete a version.
   * DELETE /api/projects/:projectId/categories/:categoryId/versions/:versionId
   */
  static async deleteVersion(req: Request, res: Response) {
    try {
      const project = await ModelFactory.project.findById(req.params.projectId)
      await documentCategoryService.deleteVersion(
        req.params.versionId,
        project?.ragflow_server_id || undefined
      )
      res.status(204).send()
    } catch (error: any) {
      console.error('Error deleting version:', error)
      res.status(500).json({ error: error.message || 'Failed to delete version' })
    }
  }

  // =========================================================================
  // Documents (local file storage)
  // =========================================================================

  /**
   * Upload a document to local storage.
   * POST /api/projects/:projectId/categories/:categoryId/versions/:versionId/documents
   */
  static async uploadDocument(req: Request, res: Response) {
    try {
      // Handle multipart file upload
      if (!req.file) {
        res.status(400).json({ error: 'File is required' })
        return
      }

      const result = await documentCategoryService.uploadDocument(
        req.params.projectId,
        req.params.categoryId,
        req.params.versionId,
        req.file.buffer,
        req.file.originalname
      )
      res.json(result)
    } catch (error: any) {
      console.error('Error uploading document:', error)
      res.status(500).json({ error: error.message || 'Failed to upload document' })
    }
  }

  /**
   * List documents stored locally for a version.
   * GET /api/projects/:projectId/categories/:categoryId/versions/:versionId/documents
   */
  static async listDocuments(req: Request, res: Response) {
    try {
      const docs = await documentCategoryService.listDocuments(
        req.params.projectId,
        req.params.categoryId,
        req.params.versionId,
        {
          page: parseInt(req.query.page as string) || 1,
          page_size: parseInt(req.query.page_size as string) || 30,
          keywords: req.query.keywords as string
        }
      )
      res.json(docs)
    } catch (error) {
      console.error('Error listing documents:', error)
      res.status(500).json({ error: 'Failed to list documents' })
    }
  }
}
