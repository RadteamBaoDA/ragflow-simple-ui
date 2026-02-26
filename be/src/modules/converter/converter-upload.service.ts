/**
 * @fileoverview Converter Upload Service — uploads converted PDFs to RAGFlow.
 *
 * After the converter worker finishes converting all files for a version job,
 * this service detects completed version jobs and batch-uploads the PDFs to RAGFlow.
 *
 * Called by the converter controller's manual trigger or scheduled check.
 *
 * @description Implements Singleton Pattern per coding guidelines.
 * @module modules/converter/converter-upload
 */
import { promises as fs } from "fs";
import path from "path";
import {
  converterQueueService,
  type VersionJob,
  type FileTracking,
} from "@/modules/converter/converter-queue.service.js";
import { ragflowProxyService } from "@/shared/services/ragflow-proxy.service.js";
import { log } from "@/shared/services/logger.service.js";
import { config } from "@/shared/config/index.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Result of a batch upload attempt for a single version job.
 */
export interface VersionUploadResult {
  /** Version job ID */
  jobId: string;
  /** Version ID */
  versionId: string;
  /** Total files in this job */
  totalFiles: number;
  /** Number of successfully uploaded files */
  uploaded: number;
  /** Number of files that failed to upload */
  failed: number;
  /** Error messages for failed uploads */
  errors: string[];
}

// ============================================================================
// Service
// ============================================================================

/**
 * ConverterUploadService handles uploading converted PDFs to RAGFlow.
 * Checks if all jobs for a version are complete, then batch uploads.
 * @description Singleton pattern — use getSharedInstance().
 */
export class ConverterUploadService {
  /** Singleton instance */
  private static instance: ConverterUploadService;

  /**
   * Get the shared singleton instance.
   * @returns ConverterUploadService singleton
   */
  static getSharedInstance(): ConverterUploadService {
    if (!this.instance) {
      this.instance = new ConverterUploadService();
    }
    return this.instance;
  }

  // --------------------------------------------------------------------------
  // Version Completion Check + Upload
  // --------------------------------------------------------------------------

  /**
   * Check all completed version jobs and upload PDFs to RAGFlow.
   *
   * @returns Array of upload results per version job
   */
  async processCompletedVersions(): Promise<VersionUploadResult[]> {
    // Get all completed version jobs
    const { jobs: completedJobs } = await converterQueueService.listVersionJobs(
      {
        status: "finished",
        page: 1,
        pageSize: 1000,
      },
    );

    if (completedJobs.length === 0) {
      log.debug("No completed version jobs to upload");
      return [];
    }

    // Process each completed version job
    const results: VersionUploadResult[] = [];
    for (const job of completedJobs) {
      // Get all completed files for this job
      const files = await converterQueueService.getJobFiles(job.id);
      const completedFiles = files.filter(
        (f) => f.status === "finished" && f.pdfPath,
      );

      if (completedFiles.length === 0) {
        log.debug(`Version job ${job.id} has no completed files to upload`);
        continue;
      }

      // Upload files to RAGFlow
      const result = await this.uploadJobPdfs(job, completedFiles);
      results.push(result);
    }

    return results;
  }

  /**
   * Upload all converted PDFs for a version job to RAGFlow.
   *
   * @param job - Completed version job
   * @param files - Completed file tracking records with pdfPath
   * @returns Upload result with success/failure counts
   */
  private async uploadJobPdfs(
    job: VersionJob,
    files: FileTracking[],
  ): Promise<VersionUploadResult> {
    const result: VersionUploadResult = {
      jobId: job.id,
      versionId: job.versionId,
      totalFiles: files.length,
      uploaded: 0,
      failed: 0,
      errors: [],
    };

    const { serverId, datasetId } = job;

    log.info(
      `Uploading ${files.length} converted PDFs for version job ${job.id}`,
    );

    for (const file of files) {
      // Skip files without a PDF path
      if (!file.pdfPath) {
        result.failed++;
        result.errors.push(`File ${file.id}: no PDF path`);
        continue;
      }

      try {
        // Resolve relative pdfPath against config.uploadDir
        const absolutePdfPath = path.resolve(config.uploadDir, file.pdfPath);
        const pdfBuffer = await fs.readFile(absolutePdfPath);
        const pdfFileName = path.basename(absolutePdfPath);

        // Upload to RAGFlow
        const uploadResult = await ragflowProxyService.uploadDocument(
          serverId,
          datasetId,
          pdfBuffer,
          pdfFileName,
        );

        // Extract RAGFlow document ID from upload response
        // RAGFlow returns an array of doc objects: [{ id, name, ... }]
        const ragflowDocs = Array.isArray(uploadResult)
          ? uploadResult
          : [uploadResult];
        const ragflowDocId = ragflowDocs[0]?.id;

        // Save RAGFlow doc ID to file tracking record
        if (ragflowDocId) {
          await converterQueueService.updateFileStatus(file.id, file.status, {
            ragflowDocId,
          });
          log.info(
            `Saved RAGFlow doc ID ${ragflowDocId} for file ${file.fileName}`,
          );
        }

        result.uploaded++;
        log.info(`Uploaded to RAGFlow: ${pdfFileName} (file ${file.id})`);
      } catch (err) {
        result.failed++;
        const errorMsg = `File ${file.id} (${file.fileName}): ${(err as Error).message}`;
        result.errors.push(errorMsg);
        log.error(`Failed to upload to RAGFlow: ${errorMsg}`);
      }
    }

    log.info(
      `Version job ${job.id} upload complete: ${result.uploaded}/${result.totalFiles} succeeded` +
        (result.failed > 0 ? `, ${result.failed} failed` : ""),
    );

    return result;
  }
}

/** Exported singleton instance */
export const converterUploadService =
  ConverterUploadService.getSharedInstance();
