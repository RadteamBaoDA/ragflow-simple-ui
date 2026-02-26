/**
 * DocumentCategoryService: Business logic for document categories and versions.
 * Handles category CRUD, version lifecycle, and local file storage.
 * Implements Singleton pattern.
 *
 * NOTE: Files are saved locally to {UPLOAD_DIR}/{projectId}/{categoryId}/{versionId}/.
 * A future task converter will transform and push them to RAGFlow.
 */
import { ModelFactory } from "@/shared/models/factory.js";
import {
  DocumentCategory,
  DocumentCategoryVersion,
} from "@/shared/models/types.js";
import { ragflowProxyService } from "@/shared/services/ragflow-proxy.service.js";
import { converterQueueService } from "@/modules/converter/converter-queue.service.js";
import {
  auditService,
  AuditAction,
  AuditResourceType,
} from "@/modules/audit/audit.service.js";
import { ProjectActor } from "@/modules/projects/project.service.js";
import { config } from "@/shared/config/index.js";
import { log } from "@/shared/services/logger.service.js";
import { promises as fs } from "fs";
import path from "path";

// Office file extensions that require conversion to PDF
const OFFICE_EXTENSIONS = new Set([
  ".doc",
  ".docx",
  ".docm",
  ".xls",
  ".xlsx",
  ".xlsm",
  ".ppt",
  ".pptx",
  ".pptm",
]);

// PDF extension — uploaded directly, no conversion needed
const PDF_EXTENSION = ".pdf";

/**
 * Service managing document categories and their versions.
 */
export class DocumentCategoryService {
  private static instance: DocumentCategoryService;

  /**
   * Get the shared singleton instance.
   * @returns DocumentCategoryService singleton
   */
  static getSharedInstance(): DocumentCategoryService {
    if (!this.instance) {
      this.instance = new DocumentCategoryService();
    }
    return this.instance;
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
    return ModelFactory.documentCategory.findByProject(projectId);
  }

  /**
   * Create a new category within a project.
   * @param data - Category data
   * @param userId - User performing the action
   * @returns Created category
   */
  async createCategory(
    data: {
      project_id: string;
      name: string;
      description?: string;
      sort_order?: number;
      dataset_config?: Record<string, any>;
    },
    actor?: ProjectActor,
  ): Promise<DocumentCategory> {
    const category = await ModelFactory.documentCategory.create({
      ...data,
      dataset_config: data.dataset_config || {},
      created_by: actor?.id ?? null,
      updated_by: actor?.id ?? null,
    } as Partial<DocumentCategory>);

    // Log audit event
    if (actor) {
      await auditService.log({
        userId: actor.id,
        userEmail: actor.email,
        action: AuditAction.CREATE_CATEGORY,
        resourceType: AuditResourceType.DOCUMENT_CATEGORY,
        resourceId: category.id,
        details: { project_id: data.project_id, name: data.name },
        ipAddress: actor.ip,
      });
    }

    return category;
  }

  /**
   * Update a category.
   * @param id - Category UUID
   * @param data - Fields to update
   * @param userId - User performing the action
   * @returns Updated category
   */
  async updateCategory(
    id: string,
    data: Partial<DocumentCategory>,
    actor?: ProjectActor,
  ): Promise<DocumentCategory> {
    const existing = await ModelFactory.documentCategory.findById(id);
    if (!existing) throw new Error("Category not found");
    const updated = await ModelFactory.documentCategory.update(id, {
      ...data,
      updated_by: actor?.id ?? null,
    });
    if (!updated) throw new Error("Category not found after update");

    // Log audit event
    if (actor) {
      await auditService.log({
        userId: actor.id,
        userEmail: actor.email,
        action: AuditAction.UPDATE_CATEGORY,
        resourceType: AuditResourceType.DOCUMENT_CATEGORY,
        resourceId: id,
        details: { changes: data },
        ipAddress: actor.ip,
      });
    }

    return updated;
  }

  /**
   * Delete a category and all its versions.
   * Also deletes corresponding RAGFlow datasets.
   * @param id - Category UUID
   * @param serverId - RAGFlow server ID for cleanup
   */
  async deleteCategory(
    id: string,
    serverId?: string,
    actor?: ProjectActor,
  ): Promise<void> {
    const existing = await ModelFactory.documentCategory.findById(id);
    if (!existing) throw new Error("Category not found");

    // Clean up RAGFlow datasets for all versions
    if (serverId) {
      const versions =
        await ModelFactory.documentCategoryVersion.findByCategory(id);
      const ragflowIds = versions
        .map((v) => v.ragflow_dataset_id)
        .filter((rid): rid is string => !!rid);
      if (ragflowIds.length > 0) {
        try {
          await ragflowProxyService.deleteDatasets(serverId, ragflowIds);
        } catch (err) {
          console.error(
            "Failed to delete RAGFlow datasets during category cleanup:",
            err,
          );
        }
      }
    }

    // Cascade delete handled by DB FK
    await ModelFactory.documentCategory.delete(id);

    // Log audit event
    if (actor) {
      await auditService.log({
        userId: actor.id,
        userEmail: actor.email,
        action: AuditAction.DELETE_CATEGORY,
        resourceType: AuditResourceType.DOCUMENT_CATEGORY,
        resourceId: id,
        details: { name: existing.name, project_id: existing.project_id },
        ipAddress: actor.ip,
      });
    }
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
    return ModelFactory.documentCategoryVersion.findByCategory(categoryId);
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
  async createVersion(
    data: {
      category_id: string;
      version_label: string;
      pagerank?: number;
      pipeline_id?: string;
      parse_type?: number;
      chunk_method?: string;
      parser_config?: Record<string, any>;
    },
    serverId: string,
    projectDefaults: {
      embedding_model?: string;
      chunk_method?: string;
      parser_config?: Record<string, any>;
    },
    userId?: string,
    actor?: ProjectActor,
  ): Promise<DocumentCategoryVersion> {
    // Resolve category for naming and dataset_config
    const category = await ModelFactory.documentCategory.findById(
      data.category_id,
    );
    if (!category) throw new Error("Category not found");

    // Category-level config takes priority over project defaults
    const catCfg = (category.dataset_config || {}) as Record<string, any>;

    // Build dataset name: "ProjectCategory - VersionLabel"
    const project = await ModelFactory.project.findById(category.project_id);
    const datasetName = `${project?.name || "Project"}_${category.name}_${data.version_label}`;

    // Determine if using ingestion pipeline or built-in chunk method
    const usePipeline = !!(data.pipeline_id && data.parse_type);

    // Build dataset creation payload
    const createPayload: Record<string, any> = {
      name: datasetName,
      language: catCfg.language || undefined,
      embedding_model:
        catCfg.embedding_model || projectDefaults.embedding_model || "bge-m3",
    };

    if (usePipeline) {
      // Pipeline mode: send pipeline_id + parse_type, skip chunk_method + parser_config
      createPayload.pipeline_id = data.pipeline_id;
      createPayload.parse_type = data.parse_type;
    } else {
      // Built-in chunk mode: merge parser_config — version overrides > category > project
      const mergedParserConfig: Record<string, any> = {
        ...(projectDefaults.parser_config || {}),
        ...(catCfg.parser_config || {}),
        ...(data.parser_config || {}),
      };

      // Normalize values for RAGFlow API compatibility:
      // - overlapped_percent: UI sends integer (e.g. 4 = 4%), RAGFlow expects decimal [0, 1) (e.g. 0.04)
      if (
        typeof mergedParserConfig.overlapped_percent === "number" &&
        mergedParserConfig.overlapped_percent > 1
      ) {
        mergedParserConfig.overlapped_percent =
          mergedParserConfig.overlapped_percent / 100;
      }

      // Map image_context_size to image_table_context_window for RAGFlow API
      if (typeof mergedParserConfig.image_context_size === "number") {
        mergedParserConfig.image_table_context_window =
          mergedParserConfig.image_context_size;
      }

      // Remap FE field names to RAGFlow API field names
      if (mergedParserConfig.child_chunk !== undefined) {
        mergedParserConfig.enable_children = mergedParserConfig.child_chunk;
        delete mergedParserConfig.child_chunk;
      }
      if (mergedParserConfig.child_chunk_delimiter !== undefined) {
        mergedParserConfig.children_delimiter =
          mergedParserConfig.child_chunk_delimiter;
        delete mergedParserConfig.child_chunk_delimiter;
      }
      if (mergedParserConfig.page_index !== undefined) {
        mergedParserConfig.toc_extraction = mergedParserConfig.page_index;
        delete mergedParserConfig.page_index;
      }

      // Version-level chunk_method overrides category > project
      createPayload.chunk_method =
        data.chunk_method ||
        catCfg.chunk_method ||
        projectDefaults.chunk_method ||
        "naive";
      createPayload.parser_config = mergedParserConfig;
    }

    // Create RAGFlow dataset
    let ragflowDataset: any = null;
    try {
      ragflowDataset = await ragflowProxyService.createDataset(
        serverId,
        createPayload as Parameters<
          typeof ragflowProxyService.createDataset
        >[1],
      );
    } catch (err) {
      console.error("Failed to create RAGFlow dataset:", err);
      throw new Error(
        "Failed to create RAGFlow dataset. Please verify server connection.",
      );
    }

    // Set pagerank via update API (not supported in create API)
    const pagerank = data.pagerank ?? 0;
    if (pagerank > 0 && ragflowDataset?.id) {
      try {
        await ragflowProxyService.updateDataset(serverId, ragflowDataset.id, {
          pagerank,
        });
      } catch (err) {
        console.error("Failed to set pagerank on RAGFlow dataset:", err);
        // Non-fatal: dataset was created, just pagerank wasn't set
      }
    }

    // Create local version record
    const version = await ModelFactory.documentCategoryVersion.create({
      category_id: data.category_id,
      version_label: data.version_label,
      ragflow_dataset_id: ragflowDataset?.id,
      ragflow_dataset_name: datasetName,
      status: "active",
      last_synced_at: new Date(),
      metadata: {
        ...ragflowDataset,
        pagerank,
        pipeline_id: data.pipeline_id,
        parse_type: data.parse_type,
      },
      created_by: actor?.id ?? userId ?? null,
      updated_by: actor?.id ?? userId ?? null,
    } as Partial<DocumentCategoryVersion>);

    // Log audit event
    if (actor) {
      await auditService.log({
        userId: actor.id,
        userEmail: actor.email,
        action: AuditAction.CREATE_VERSION,
        resourceType: AuditResourceType.DOCUMENT_CATEGORY_VERSION,
        resourceId: version.id,
        details: {
          category_id: data.category_id,
          version_label: data.version_label,
        },
        ipAddress: actor.ip,
      });
    }

    return version;
  }

  /**
   * Update a version's metadata by syncing with RAGFlow.
   * @param versionId - Version UUID
   * @param serverId - RAGFlow server ID
   * @returns Updated version
   */
  async syncVersion(
    versionId: string,
    serverId: string,
  ): Promise<DocumentCategoryVersion> {
    const version =
      await ModelFactory.documentCategoryVersion.findById(versionId);
    if (!version) throw new Error("Version not found");
    if (!version.ragflow_dataset_id)
      throw new Error("Version has no RAGFlow dataset linked");

    // Fetch latest dataset info from RAGFlow
    const datasets = await ragflowProxyService.listDatasets(serverId, {
      id: version.ragflow_dataset_id,
    });
    const dataset = datasets?.[0];

    const updated = await ModelFactory.documentCategoryVersion.update(
      versionId,
      {
        ragflow_dataset_name: dataset?.name || version.ragflow_dataset_name,
        metadata: dataset || version.metadata,
        last_synced_at: new Date(),
      },
    );
    if (!updated) throw new Error("Version not found after update");
    return updated;
  }

  /**
   * Archive a version (soft delete).
   * @param versionId - Version UUID
   * @param userId - User performing the action
   * @returns Updated version
   */
  async archiveVersion(
    versionId: string,
    userId?: string,
    actor?: ProjectActor,
  ): Promise<DocumentCategoryVersion> {
    const version =
      await ModelFactory.documentCategoryVersion.findById(versionId);
    if (!version) throw new Error("Version not found");
    const updated = await ModelFactory.documentCategoryVersion.update(
      versionId,
      {
        status: "archived",
        updated_by: actor?.id ?? userId ?? null,
      },
    );
    if (!updated) throw new Error("Version not found after update");

    // Log audit event
    if (actor) {
      await auditService.log({
        userId: actor.id,
        userEmail: actor.email,
        action: AuditAction.ARCHIVE_VERSION,
        resourceType: AuditResourceType.DOCUMENT_CATEGORY_VERSION,
        resourceId: versionId,
        details: { version_label: version.version_label },
        ipAddress: actor.ip,
      });
    }

    return updated;
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
    data: {
      version_label?: string;
      pagerank?: number;
      pipeline_id?: string;
      parse_type?: number;
      chunk_method?: string;
      parser_config?: Record<string, any>;
    },
    serverId?: string,
    userId?: string,
    actor?: ProjectActor,
  ): Promise<DocumentCategoryVersion> {
    const version =
      await ModelFactory.documentCategoryVersion.findById(versionId);
    if (!version) throw new Error("Version not found");

    // Sync dataset config changes to RAGFlow if a server is available
    if (serverId && version.ragflow_dataset_id) {
      const ragflowUpdate: Record<string, any> = {};
      if (data.pagerank !== undefined) ragflowUpdate.pagerank = data.pagerank;
      if (data.pipeline_id) ragflowUpdate.pipeline_id = data.pipeline_id;
      if (data.parse_type !== undefined)
        ragflowUpdate.parse_type = data.parse_type;
      if (data.chunk_method) ragflowUpdate.chunk_method = data.chunk_method;
      if (data.parser_config) {
        // Normalize parser_config before sending to RAGFlow
        const pc = { ...data.parser_config };

        // overlapped_percent: UI sends integer (e.g. 4 = 4%), RAGFlow expects decimal [0, 1)
        if (
          typeof pc.overlapped_percent === "number" &&
          pc.overlapped_percent > 1
        ) {
          pc.overlapped_percent = pc.overlapped_percent / 100;
        }

        // Map image_context_size to image_table_context_window for RAGFlow API
        if (typeof pc.image_context_size === "number") {
          pc.image_table_context_window = pc.image_context_size;
        }

        // Remap FE field names to RAGFlow API field names
        if (pc.child_chunk !== undefined) {
          pc.enable_children = pc.child_chunk;
          delete pc.child_chunk;
        }
        if (pc.child_chunk_delimiter !== undefined) {
          pc.children_delimiter = pc.child_chunk_delimiter;
          delete pc.child_chunk_delimiter;
        }
        if (pc.page_index !== undefined) {
          pc.toc_extraction = pc.page_index;
          delete pc.page_index;
        }

        ragflowUpdate.parser_config = pc;
      }

      if (Object.keys(ragflowUpdate).length > 0) {
        try {
          await ragflowProxyService.updateDataset(
            serverId,
            version.ragflow_dataset_id,
            ragflowUpdate,
          );
        } catch (err) {
          console.error("Failed to update RAGFlow dataset:", err);
          throw new Error(
            "Failed to update RAGFlow dataset. Please verify server connection.",
          );
        }
      }
    }

    // Update local version record
    const existingMeta = (version.metadata || {}) as Record<string, any>;
    const updatePayload: Record<string, any> = {
      metadata: {
        ...existingMeta,
        ...(data.pagerank !== undefined ? { pagerank: data.pagerank } : {}),
        ...(data.pipeline_id ? { pipeline_id: data.pipeline_id } : {}),
        ...(data.parse_type !== undefined
          ? { parse_type: data.parse_type }
          : {}),
        ...(data.chunk_method ? { chunk_method: data.chunk_method } : {}),
        ...(data.parser_config ? { parser_config: data.parser_config } : {}),
      },
      updated_by: actor?.id ?? userId ?? null,
    };
    if (data.version_label !== undefined) {
      updatePayload.version_label = data.version_label;
    }
    const updated = await ModelFactory.documentCategoryVersion.update(
      versionId,
      updatePayload,
    );
    if (!updated) throw new Error("Version not found after update");

    // Log audit event
    if (actor) {
      await auditService.log({
        userId: actor.id,
        userEmail: actor.email,
        action: AuditAction.UPDATE_VERSION,
        resourceType: AuditResourceType.DOCUMENT_CATEGORY_VERSION,
        resourceId: versionId,
        details: { changes: data },
        ipAddress: actor.ip,
      });
    }

    return updated;
  }

  /**
   * Delete a version and its RAGFlow dataset.
   * @param versionId - Version UUID
   * @param serverId - RAGFlow server ID
   */
  async deleteVersion(
    versionId: string,
    serverId?: string,
    actor?: ProjectActor,
  ): Promise<void> {
    const version =
      await ModelFactory.documentCategoryVersion.findById(versionId);
    if (!version) throw new Error("Version not found");

    // Delete RAGFlow dataset if exists
    if (serverId && version.ragflow_dataset_id) {
      try {
        await ragflowProxyService.deleteDatasets(serverId, [
          version.ragflow_dataset_id,
        ]);
      } catch (err) {
        console.error("Failed to delete RAGFlow dataset:", err);
      }
    }

    await ModelFactory.documentCategoryVersion.delete(versionId);

    // Log audit event
    if (actor) {
      await auditService.log({
        userId: actor.id,
        userEmail: actor.email,
        action: AuditAction.DELETE_VERSION,
        resourceType: AuditResourceType.DOCUMENT_CATEGORY_VERSION,
        resourceId: versionId,
        details: {
          version_label: version.version_label,
          category_id: version.category_id,
        },
        ipAddress: actor.ip,
      });
    }
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
  private getUploadDir(
    projectId: string,
    categoryId: string,
    versionId: string,
  ): string {
    return path.resolve(config.uploadDir, projectId, categoryId, versionId);
  }

  /**
   * Upload a document to local storage and enqueue for conversion.
   * Office files (.doc, .docx, .xlsx, etc.) are queued for PDF conversion.
   * PDF files are queued for direct upload to RAGFlow.
   *
   * @param projectId - Project UUID
   * @param categoryId - Category UUID
   * @param versionId - Version UUID
   * @param file - File buffer
   * @param fileName - Original file name
   * @param serverId - RAGFlow server ID (optional, for conversion queue)
   * @returns Upload result with file info and optional jobId
   */
  async uploadDocument(
    projectId: string,
    categoryId: string,
    versionId: string,
    file: Buffer,
    fileName: string,
    serverId?: string,
  ): Promise<{
    name: string;
    size: number;
    path: string;
    jobId?: string | undefined;
  }> {
    const version =
      await ModelFactory.documentCategoryVersion.findById(versionId);
    if (!version) throw new Error("Version not found");

    // Ensure upload directory exists
    const dir = this.getUploadDir(projectId, categoryId, versionId);
    await fs.mkdir(dir, { recursive: true });

    // Write file to disk
    const filePath = path.join(dir, fileName);
    await fs.writeFile(filePath, file);

    log.info(`Document saved locally: ${filePath} (${file.length} bytes)`);

    // Add file to conversion queue if server + dataset are available
    let jobId: string | undefined;
    let fileId: string | undefined;
    const ext = path.extname(fileName).toLowerCase();
    const isOffice = OFFICE_EXTENSIONS.has(ext);
    const isPdf = ext === PDF_EXTENSION;

    if (serverId && version.ragflow_dataset_id && (isOffice || isPdf)) {
      try {
        const result = await converterQueueService.addFileToQueue({
          projectId,
          categoryId,
          versionId,
          serverId,
          datasetId: version.ragflow_dataset_id,
          fileName,
          filePath: path.join(projectId, categoryId, versionId, fileName),
        });
        jobId = result.jobId;
        fileId = result.fileId;
        log.info("File added to conversion queue", {
          jobId,
          fileId,
          fileName,
          isOffice,
          isPdf,
        });
      } catch (err) {
        // Non-fatal: file is saved, just queue failed
        log.error("Failed to add file to conversion queue", {
          fileName,
          error: (err as Error).message,
        });
      }
    }

    return {
      name: fileName,
      size: file.length,
      path: filePath,
      jobId,
    };
  }

  /**
   * List documents stored locally for a version.
   * Reads file metadata from the local upload directory and merges
   * converter pipeline status: local → converted → imported → Success.
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
    query?: { page?: number; page_size?: number; keywords?: string },
  ): Promise<any[]> {
    const dir = this.getUploadDir(projectId, categoryId, versionId);

    // If directory doesn't exist yet, return empty
    try {
      await fs.access(dir);
    } catch {
      return [];
    }

    // ── Build converter status map: fileName → latest FileTracking status ──
    const converterStatusMap: Record<
      string,
      { status: string; pdfPath?: string; error?: string }
    > = {};

    try {
      // Get all jobs for this version
      const { jobs } = await converterQueueService.listVersionJobs({
        versionId,
        page: 1,
        pageSize: 1000,
      });

      // Collect file tracking from all jobs, keep the latest per fileName
      for (const job of jobs) {
        const files = await converterQueueService.getJobFiles(job.id);
        for (const f of files) {
          const existing = converterStatusMap[f.fileName];
          // Keep the latest record (by updatedAt)
          if (
            !existing ||
            new Date(f.updatedAt) >
              new Date((existing as any)._updatedAt || "1970-01-01")
          ) {
            converterStatusMap[f.fileName] = {
              status: f.status,
              pdfPath: f.pdfPath,
              error: f.error,
              _updatedAt: f.updatedAt,
            } as any;
          }
        }
      }
    } catch (err) {
      // Non-fatal: if Redis is down, just show all as "local"
      log.warn("Failed to fetch converter status for documents", {
        error: (err as Error).message,
      });
    }

    // Read directory entries with file stats (exclude pdf/ subfolder)
    const entries = await fs.readdir(dir);
    let files: any[] = (
      await Promise.all(
        entries.map(async (name) => {
          const filePath = path.join(dir, name);
          const stat = await fs.stat(filePath);
          if (!stat.isFile()) return null;

          // Derive document status from converter tracking
          const conv = converterStatusMap[name];
          let docStatus = "local"; // default: not converted
          if (conv) {
            switch (conv.status) {
              case "pending":
              case "processing":
                // Still in conversion pipeline
                docStatus = "local";
                break;
              case "completed":
                // Converted but not yet uploaded to RAGFlow
                docStatus = "converted";
                break;
              case "finished":
                // Successfully uploaded to RAGFlow
                docStatus = "imported";
                break;
              case "failed":
                docStatus = "failed";
                break;
              default:
                docStatus = "local";
            }
          }

          return {
            id: name,
            name,
            size: stat.size,
            type: path.extname(name).replace(".", ""),
            run: docStatus,
            status: docStatus,
            created_by: "",
            create_time: Math.floor(stat.birthtimeMs / 1000),
            update_time: Math.floor(stat.mtimeMs / 1000),
            chunk_count: 0,
            token_count: 0,
            progress: 0,
            progress_msg: conv?.error || "",
          };
        }),
      )
    ).filter(Boolean);

    // Apply keyword filter
    if (query?.keywords) {
      const kw = query.keywords.toLowerCase();
      files = files.filter((f: any) => f.name.toLowerCase().includes(kw));
    }

    // Apply pagination
    const page = query?.page ?? 1;
    const pageSize = query?.page_size ?? 100;
    const start = (page - 1) * pageSize;
    return files.slice(start, start + pageSize);
  }

  /**
   * Delete multiple documents from local storage and RAGFlow.
   * Looks up RAGFlow document IDs from converter tracking,
   * deletes from RAGFlow first, then removes local files.
   *
   * @param projectId - Project UUID
   * @param categoryId - Category UUID
   * @param versionId - Version UUID
   * @param fileNames - Array of file names to delete
   * @param serverId - Optional RAGFlow server ID for remote deletion
   * @returns Object with arrays of deleted and failed file names
   */
  async deleteDocuments(
    projectId: string,
    categoryId: string,
    versionId: string,
    fileNames: string[],
    serverId?: string,
  ): Promise<{ deleted: string[]; failed: string[] }> {
    const dir = this.getUploadDir(projectId, categoryId, versionId);
    const deleted: string[] = [];
    const failed: string[] = [];

    // Build fileName → ragflowDocId map from converter tracking (if serverId available)
    const fileNameToRagflowId: Record<string, string> = {};
    let datasetId: string | undefined;

    if (serverId) {
      try {
        const version =
          await ModelFactory.documentCategoryVersion.findById(versionId);
        datasetId = version?.ragflow_dataset_id ?? undefined;

        const { jobs } = await converterQueueService.listVersionJobs({
          versionId,
          page: 1,
          pageSize: 1000,
        });

        for (const job of jobs) {
          const files = await converterQueueService.getJobFiles(job.id);
          for (const f of files) {
            if (f.ragflowDocId) {
              fileNameToRagflowId[f.fileName] = f.ragflowDocId;
            }
          }
        }
      } catch (err) {
        log.warn("Failed to read converter tracking for delete", {
          error: (err as Error).message,
        });
      }
    }

    // Batch delete from RAGFlow if we have doc IDs
    if (serverId && datasetId) {
      const ragflowIds = fileNames
        .map((name) => fileNameToRagflowId[path.basename(name)])
        .filter((id): id is string => !!id);

      if (ragflowIds.length > 0) {
        try {
          await ragflowProxyService.deleteDocuments(
            serverId,
            datasetId,
            ragflowIds,
          );
          log.info("Deleted documents from RAGFlow", {
            datasetId,
            count: ragflowIds.length,
          });
        } catch (err) {
          // Non-fatal: continue with local deletion even if RAGFlow fails
          log.error("Failed to delete from RAGFlow", {
            error: (err as Error).message,
          });
        }
      }
    }

    // Delete each file from local storage
    for (const name of fileNames) {
      // Prevent path traversal attacks
      const safeName = path.basename(name);
      const filePath = path.join(dir, safeName);
      try {
        await fs.unlink(filePath);
        deleted.push(safeName);
        log.info(`Document deleted: ${filePath}`);
      } catch (err) {
        log.error(`Failed to delete document: ${filePath}`, {
          error: (err as Error).message,
        });
        failed.push(safeName);
      }
    }

    return { deleted, failed };
  }

  /**
   * Re-queue existing local files for conversion.
   * Looks up each file on disk and adds it to the converter queue.
   *
   * @param projectId - Project UUID
   * @param categoryId - Category UUID
   * @param versionId - Version UUID
   * @param fileNames - Array of file names to re-queue
   * @param serverId - RAGFlow server ID
   * @returns Object with arrays of queued and failed file names
   */
  async requeueDocuments(
    projectId: string,
    categoryId: string,
    versionId: string,
    fileNames: string[],
    serverId: string,
  ): Promise<{ queued: string[]; failed: string[] }> {
    // Look up the version to get the RAGFlow dataset ID
    const version =
      await ModelFactory.documentCategoryVersion.findById(versionId);
    if (!version) throw new Error("Version not found");
    if (!version.ragflow_dataset_id)
      throw new Error("Version has no RAGFlow dataset linked");

    const dir = this.getUploadDir(projectId, categoryId, versionId);
    const queued: string[] = [];
    const failed: string[] = [];

    for (const name of fileNames) {
      // Prevent path traversal attacks
      const safeName = path.basename(name);
      const filePath = path.join(dir, safeName);

      // Verify file exists on disk
      try {
        await fs.access(filePath);
      } catch {
        log.warn(`Requeue skipped — file not found: ${filePath}`);
        failed.push(safeName);
        continue;
      }

      // Add to conversion queue
      try {
        const result = await converterQueueService.addFileToQueue({
          projectId,
          categoryId,
          versionId,
          serverId,
          datasetId: version.ragflow_dataset_id,
          fileName: safeName,
          filePath: path.join(projectId, categoryId, versionId, safeName),
        });
        log.info("File re-queued for conversion", {
          jobId: result.jobId,
          fileId: result.fileId,
          fileName: safeName,
        });
        queued.push(safeName);
      } catch (err) {
        log.error("Failed to re-queue file for conversion", {
          fileName: safeName,
          error: (err as Error).message,
        });
        failed.push(safeName);
      }
    }

    return { queued, failed };
  }

  /**
   * Start parsing selected documents in RAGFlow.
   * Looks up RAGFlow document IDs from converter file tracking records
   * (saved when PDFs were uploaded to RAGFlow), then triggers parsing.
   *
   * @param projectId - Project UUID
   * @param categoryId - Category UUID
   * @param versionId - Version UUID
   * @param fileNames - Array of file names to parse
   * @param serverId - RAGFlow server ID
   * @returns Object with arrays of parsed and failed file names
   */
  async parseDocuments(
    projectId: string,
    categoryId: string,
    versionId: string,
    fileNames: string[],
    serverId: string,
  ): Promise<{ parsed: string[]; failed: string[] }> {
    // Look up the version to get the RAGFlow dataset ID
    const version =
      await ModelFactory.documentCategoryVersion.findById(versionId);
    if (!version) throw new Error("Version not found");
    if (!version.ragflow_dataset_id)
      throw new Error("Version has no RAGFlow dataset linked");

    const datasetId = version.ragflow_dataset_id;

    // Build fileName → ragflowDocId map from converter tracking records
    const fileNameToRagflowId: Record<string, string> = {};
    try {
      const { jobs } = await converterQueueService.listVersionJobs({
        versionId,
        page: 1,
        pageSize: 1000,
      });

      for (const job of jobs) {
        const files = await converterQueueService.getJobFiles(job.id);
        for (const f of files) {
          // Keep the latest ragflowDocId per fileName
          if (f.ragflowDocId) {
            fileNameToRagflowId[f.fileName] = f.ragflowDocId;
          }
        }
      }
    } catch (err) {
      log.error("Failed to read converter tracking for parse", {
        error: (err as Error).message,
      });
    }

    const parsed: string[] = [];
    const failed: string[] = [];
    const idsToParse: string[] = [];

    for (const name of fileNames) {
      const safeName = path.basename(name);
      const ragflowId = fileNameToRagflowId[safeName];

      if (ragflowId) {
        idsToParse.push(ragflowId);
        parsed.push(safeName);
      } else {
        log.warn(`Parse skipped — no RAGFlow doc ID stored for: ${safeName}`);
        failed.push(safeName);
      }
    }

    // Call RAGFlow parse API with all matched IDs in one batch
    if (idsToParse.length > 0) {
      try {
        await ragflowProxyService.parseDocuments(
          serverId,
          datasetId,
          idsToParse,
        );
        log.info("RAGFlow parsing started", {
          datasetId,
          count: idsToParse.length,
          ids: idsToParse,
        });
      } catch (err) {
        log.error("Failed to start RAGFlow parsing", {
          error: (err as Error).message,
        });
        // Move all to failed if the API call fails
        failed.push(...parsed.splice(0));
      }
    }

    return { parsed, failed };
  }
}

export const documentCategoryService =
  DocumentCategoryService.getSharedInstance();
