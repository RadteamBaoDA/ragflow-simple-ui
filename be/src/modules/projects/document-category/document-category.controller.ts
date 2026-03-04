/**
 * DocumentCategoryController: Handles HTTP requests for document categories and versions.
 */
import { Request, Response } from "express";
import { documentCategoryService } from "@/modules/projects/document-category/document-category.service.js";
import { ModelFactory } from "@/shared/models/factory.js";
import {
  auditService,
  AuditAction,
  AuditResourceType,
} from "@/modules/audit/audit.service.js";

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
      const categories = await documentCategoryService.listByProject(
        req.params.projectId as string,
      );
      res.json(categories);
    } catch (error) {
      console.error("Error listing categories:", error);
      res.status(500).json({ error: "Failed to list categories" });
    }
  }

  /**
   * Create a new category.
   * POST /api/projects/:projectId/categories
   */
  static async createCategory(req: Request, res: Response) {
    try {
      const { name, description, sort_order, dataset_config } = req.body;
      if (!name) {
        res.status(400).json({ error: "Category name is required" });
        return;
      }
      // @ts-ignore
      const userId = req.user?.id;
      const userEmail = req.user?.email || "";
      const actor = userId
        ? { id: userId, email: userEmail, ip: req.ip }
        : undefined;
      const category = await documentCategoryService.createCategory(
        {
          project_id: req.params.projectId as string,
          name,
          description,
          sort_order,
          dataset_config,
        },
        actor,
      );
      res.status(201).json(category);
    } catch (error: any) {
      console.error("Error creating category:", error);
      if (error.message?.includes("unique")) {
        res
          .status(409)
          .json({ error: "Category name already exists in this project" });
        return;
      }
      res.status(500).json({ error: "Failed to create category" });
    }
  }

  /**
   * Update a category.
   * PUT /api/projects/:projectId/categories/:categoryId
   */
  static async updateCategory(req: Request, res: Response) {
    try {
      // @ts-ignore
      const userId = req.user?.id;
      const userEmail = req.user?.email || "";
      const actor = userId
        ? { id: userId, email: userEmail, ip: req.ip }
        : undefined;
      const category = await documentCategoryService.updateCategory(
        req.params.categoryId as string,
        req.body,
        actor,
      );
      res.json(category);
    } catch (error: any) {
      console.error("Error updating category:", error);
      if (error.message === "Category not found") {
        res.status(404).json({ error: "Category not found" });
        return;
      }
      res.status(500).json({ error: "Failed to update category" });
    }
  }

  /**
   * Delete a category.
   * DELETE /api/projects/:projectId/categories/:categoryId
   */
  static async deleteCategory(req: Request, res: Response) {
    try {
      // Get project's ragflow server ID for cleanup
      const project = await ModelFactory.project.findById(
        req.params.projectId as string,
      );
      // @ts-ignore
      const userId = req.user?.id;
      const userEmail = req.user?.email || "";
      const actor = userId
        ? { id: userId, email: userEmail, ip: req.ip }
        : undefined;
      await documentCategoryService.deleteCategory(
        req.params.categoryId as string,
        project?.ragflow_server_id || undefined,
        actor,
      );
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting category:", error);
      if (error.message === "Category not found") {
        res.status(404).json({ error: "Category not found" });
        return;
      }
      res.status(500).json({ error: "Failed to delete category" });
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
      const versions = await documentCategoryService.listVersions(
        req.params.categoryId as string,
      );
      res.json(versions);
    } catch (error) {
      console.error("Error listing versions:", error);
      res.status(500).json({ error: "Failed to list versions" });
    }
  }

  /**
   * Create a new version (and its RAGFlow dataset).
   * POST /api/projects/:projectId/categories/:categoryId/versions
   */
  static async createVersion(req: Request, res: Response) {
    try {
      const {
        version_label,
        pagerank,
        pipeline_id,
        parse_type,
        chunk_method,
        parser_config,
      } = req.body;
      if (!version_label) {
        res.status(400).json({ error: "version_label is required" });
        return;
      }

      // Resolve project for server ID and defaults
      const project = await ModelFactory.project.findById(
        req.params.projectId as string,
      );
      if (!project?.ragflow_server_id) {
        res
          .status(400)
          .json({ error: "Project must have a RAGFlow server assigned" });
        return;
      }

      // @ts-ignore
      const userId = req.user?.id;
      const userEmail = req.user?.email || "";
      const actor = userId
        ? { id: userId, email: userEmail, ip: req.ip }
        : undefined;
      const version = await documentCategoryService.createVersion(
        {
          category_id: req.params.categoryId as string,
          version_label,
          ...(pagerank !== undefined ? { pagerank: Number(pagerank) } : {}),
          ...(pipeline_id ? { pipeline_id } : {}),
          ...(parse_type !== undefined
            ? { parse_type: Number(parse_type) }
            : {}),
          ...(chunk_method ? { chunk_method } : {}),
          ...(parser_config ? { parser_config } : {}),
        },
        project.ragflow_server_id,
        {
          ...(project.default_embedding_model
            ? { embedding_model: project.default_embedding_model }
            : {}),
          chunk_method: project.default_chunk_method,
          parser_config: project.default_parser_config,
        },
        userId,
        actor,
      );
      res.status(201).json(version);
    } catch (error: any) {
      console.error("Error creating version:", error);
      if (error.message?.includes("unique")) {
        res
          .status(409)
          .json({ error: "Version label already exists for this category" });
        return;
      }
      // RAGFlow API or connectivity failures → 502 Bad Gateway with full detail
      if (
        error.message?.includes("RAGFlow") ||
        error.message?.includes("Connection check")
      ) {
        res.status(502).json({ error: error.message });
        return;
      }
      res
        .status(500)
        .json({ error: error.message || "Failed to create version" });
    }
  }

  /**
   * Sync a version's metadata from RAGFlow.
   * POST /api/projects/:projectId/categories/:categoryId/versions/:versionId/sync
   */
  static async syncVersion(req: Request, res: Response) {
    try {
      const project = await ModelFactory.project.findById(
        req.params.projectId as string,
      );
      if (!project?.ragflow_server_id) {
        res
          .status(400)
          .json({ error: "Project must have a RAGFlow server assigned" });
        return;
      }
      const version = await documentCategoryService.syncVersion(
        req.params.versionId as string,
        project.ragflow_server_id,
      );
      res.json(version);
    } catch (error: any) {
      console.error("Error syncing version:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to sync version" });
    }
  }

  /**
   * Archive a version.
   * PUT /api/projects/:projectId/categories/:categoryId/versions/:versionId/archive
   */
  static async archiveVersion(req: Request, res: Response) {
    try {
      // @ts-ignore
      const userId = req.user?.id;
      const userEmail = req.user?.email || "";
      const actor = userId
        ? { id: userId, email: userEmail, ip: req.ip }
        : undefined;
      const version = await documentCategoryService.archiveVersion(
        req.params.versionId as string,
        userId,
        actor,
      );
      res.json(version);
    } catch (error: any) {
      console.error("Error archiving version:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to archive version" });
    }
  }

  /**
   * Update a version's metadata (e.g. label).
   * PUT /api/projects/:projectId/categories/:categoryId/versions/:versionId
   */
  static async updateVersion(req: Request, res: Response) {
    try {
      // @ts-ignore
      const userId = req.user?.id;
      const userEmail = req.user?.email || "";
      const actor = userId
        ? { id: userId, email: userEmail, ip: req.ip }
        : undefined;
      const {
        version_label,
        pagerank,
        pipeline_id,
        parse_type,
        chunk_method,
        parser_config,
      } = req.body;

      // Resolve project for server ID (needed for RAGFlow sync)
      const project = await ModelFactory.project.findById(
        req.params.projectId as string,
      );

      const version = await documentCategoryService.updateVersion(
        req.params.versionId as string,
        {
          version_label,
          ...(pagerank !== undefined ? { pagerank: Number(pagerank) } : {}),
          ...(pipeline_id ? { pipeline_id } : {}),
          ...(parse_type !== undefined
            ? { parse_type: Number(parse_type) }
            : {}),
          ...(chunk_method ? { chunk_method } : {}),
          ...(parser_config ? { parser_config } : {}),
        },
        project?.ragflow_server_id || undefined,
        userId,
        actor,
      );
      res.json(version);
    } catch (error: any) {
      console.error("Error updating version:", error);
      if (error.message === "Version not found") {
        res.status(404).json({ error: "Version not found" });
        return;
      }
      res
        .status(500)
        .json({ error: error.message || "Failed to update version" });
    }
  }

  /**
   * Delete a version.
   * DELETE /api/projects/:projectId/categories/:categoryId/versions/:versionId
   */
  static async deleteVersion(req: Request, res: Response) {
    try {
      const project = await ModelFactory.project.findById(
        req.params.projectId as string,
      );
      // @ts-ignore
      const userId = req.user?.id;
      const userEmail = req.user?.email || "";
      const actor = userId
        ? { id: userId, email: userEmail, ip: req.ip }
        : undefined;
      await documentCategoryService.deleteVersion(
        req.params.versionId as string,
        project?.ragflow_server_id || undefined,
        actor,
      );
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting version:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to delete version" });
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
        res.status(400).json({ error: "File is required" });
        return;
      }

      // Resolve project to get RAGFlow server ID for conversion queue
      const project = await ModelFactory.project.findById(
        req.params.projectId as string,
      );
      const serverId = project?.ragflow_server_id || undefined;

      const result = await documentCategoryService.uploadDocument(
        req.params.projectId as string,
        req.params.categoryId as string,
        req.params.versionId as string,
        req.file.buffer,
        req.file.originalname,
        serverId,
      );

      // Log audit event for document upload
      // @ts-ignore
      const userId = req.user?.id;
      const userEmail = req.user?.email || "";
      if (userId) {
        await auditService.log({
          userId,
          userEmail,
          action: AuditAction.UPLOAD_DOCUMENT,
          resourceType: AuditResourceType.DOCUMENT_CATEGORY_VERSION,
          resourceId: req.params.versionId as string,
          details: { fileName: req.file.originalname, size: req.file.size },
          ipAddress: req.ip,
        });
      }

      res.json(result);
    } catch (error: any) {
      console.error("Error uploading document:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to upload document" });
    }
  }

  /**
   * List documents stored locally for a version.
   * GET /api/projects/:projectId/categories/:categoryId/versions/:versionId/documents
   */
  static async listDocuments(req: Request, res: Response) {
    try {
      const docs = await documentCategoryService.listDocuments(
        req.params.projectId as string,
        req.params.categoryId as string,
        req.params.versionId as string,
        {
          page: parseInt(req.query.page as string) || 1,
          page_size: parseInt(req.query.page_size as string) || 30,
          keywords: req.query.keywords as string,
        },
      );
      res.json(docs);
    } catch (error) {
      console.error("Error listing documents:", error);
      res.status(500).json({ error: "Failed to list documents" });
    }
  }

  /**
   * Delete multiple documents from local storage.
   * DELETE /api/projects/:projectId/categories/:categoryId/versions/:versionId/documents
   * Body: { fileNames: string[] }
   */
  static async deleteDocuments(req: Request, res: Response) {
    try {
      const { fileNames } = req.body;
      if (!Array.isArray(fileNames) || fileNames.length === 0) {
        res
          .status(400)
          .json({ error: "fileNames array is required and must not be empty" });
        return;
      }

      // Resolve project to get RAGFlow server ID for remote deletion
      const project = await ModelFactory.project.findById(
        req.params.projectId as string,
      );
      const serverId = project?.ragflow_server_id ?? undefined;

      const result = await documentCategoryService.deleteDocuments(
        req.params.projectId as string,
        req.params.categoryId as string,
        req.params.versionId as string,
        fileNames,
        serverId,
      );

      // Log audit event for document deletion
      // @ts-ignore
      const userId = req.user?.id;
      const userEmail = req.user?.email || "";
      if (userId && result.deleted.length > 0) {
        await auditService.log({
          userId,
          userEmail,
          action: AuditAction.DELETE_DOCUMENTS,
          resourceType: AuditResourceType.DOCUMENT_CATEGORY_VERSION,
          resourceId: req.params.versionId as string,
          details: { deleted: result.deleted, failed: result.failed },
          ipAddress: req.ip,
        });
      }

      res.json(result);
    } catch (error: any) {
      console.error("Error deleting documents:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to delete documents" });
    }
  }

  /**
   * Re-queue local files for conversion.
   * POST /api/projects/:projectId/categories/:categoryId/versions/:versionId/documents/requeue
   * Body: { fileNames: string[] }
   */
  static async requeueDocuments(req: Request, res: Response) {
    try {
      const { fileNames } = req.body;
      if (!Array.isArray(fileNames) || fileNames.length === 0) {
        res
          .status(400)
          .json({ error: "fileNames array is required and must not be empty" });
        return;
      }

      // Resolve project to get RAGFlow server ID
      const project = await ModelFactory.project.findById(
        req.params.projectId as string,
      );
      if (!project?.ragflow_server_id) {
        res
          .status(400)
          .json({ error: "Project must have a RAGFlow server assigned" });
        return;
      }

      const result = await documentCategoryService.requeueDocuments(
        req.params.projectId as string,
        req.params.categoryId as string,
        req.params.versionId as string,
        fileNames,
        project.ragflow_server_id,
      );
      res.json(result);
    } catch (error: any) {
      console.error("Error re-queuing documents:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to re-queue documents" });
    }
  }

  /**
   * Start parsing imported documents in RAGFlow.
   * POST /api/projects/:projectId/categories/:categoryId/versions/:versionId/documents/parse
   * Body: { fileNames: string[] }
   */
  static async parseDocuments(req: Request, res: Response) {
    try {
      const { fileNames } = req.body;
      if (!Array.isArray(fileNames) || fileNames.length === 0) {
        res
          .status(400)
          .json({ error: "fileNames array is required and must not be empty" });
        return;
      }

      // Resolve project to get RAGFlow server ID
      const project = await ModelFactory.project.findById(
        req.params.projectId as string,
      );
      if (!project?.ragflow_server_id) {
        res
          .status(400)
          .json({ error: "Project must have a RAGFlow server assigned" });
        return;
      }

      const result = await documentCategoryService.parseDocuments(
        req.params.projectId as string,
        req.params.categoryId as string,
        req.params.versionId as string,
        fileNames,
        project.ragflow_server_id,
      );
      res.json(result);
    } catch (error: any) {
      console.error("Error parsing documents:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to parse documents" });
    }
  }

  /**
   * Fetch live RAGFlow parser status for all documents in a version.
   * GET /api/projects/:projectId/categories/:categoryId/versions/:versionId/documents/parser-status
   */
  static async syncParserStatus(req: Request, res: Response) {
    try {
      const project = await ModelFactory.project.findById(
        req.params.projectId as string,
      );
      if (!project?.ragflow_server_id) {
        res
          .status(400)
          .json({ error: "Project must have a RAGFlow server assigned" });
        return;
      }

      const result = await documentCategoryService.syncParserStatus(
        req.params.projectId as string,
        req.params.categoryId as string,
        req.params.versionId as string,
        project.ragflow_server_id,
      );
      res.json(result);
    } catch (error: any) {
      console.error("Error syncing parser status:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to sync parser status" });
    }
  }
}
