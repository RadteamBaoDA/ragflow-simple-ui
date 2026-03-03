/**
 * @fileoverview Converter Worker Service — background job processor.
 *
 * Provides a shared processing loop that both the manual trigger (Force Start)
 * and the scheduled interval use. Processes one job at a time, uploading files
 * to RAGFlow, then auto-starts the next pending job.
 *
 * Also starts a polling interval that checks isWithinSchedule() every 60s
 * and auto-processes pending jobs when inside the configured time window.
 *
 * @description Implements Singleton Pattern per coding guidelines.
 * @module modules/converter/converter-worker
 */
import { promises as fs } from "fs";
import path from "path";
import {
  converterQueueService,
  type FileTracking,
} from "@/modules/converter/converter-queue.service.js";
import { converterScheduleService } from "@/modules/converter/converter-schedule.service.js";
import { ragflowProxyService } from "@/shared/services/ragflow-proxy.service.js";
import { socketService } from "@/shared/services/socket.service.js";
import { log } from "@/shared/services/logger.service.js";
import { config } from "@/shared/config/index.js";

// ============================================================================
// Service
// ============================================================================

/**
 * ConverterWorkerService runs background job processing.
 * @description Singleton pattern — use getSharedInstance().
 */
export class ConverterWorkerService {
  /** Singleton instance */
  private static instance: ConverterWorkerService;

  /** Lock to prevent concurrent processing loops */
  private isProcessing = false;

  /** Scheduler interval handle */
  private schedulerInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Get the shared singleton instance.
   * @returns ConverterWorkerService singleton
   */
  static getSharedInstance(): ConverterWorkerService {
    if (!this.instance) {
      this.instance = new ConverterWorkerService();
    }
    return this.instance;
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Check if the worker is currently processing jobs.
   * @returns True if a processing loop is active
   */
  getIsProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * Start processing the queue in the background.
   * Safe to call multiple times — the internal lock prevents concurrent loops.
   * If a loop is already running, new pending jobs will be picked up naturally
   * since the loop keeps dequeuing until the queue is empty.
   */
  startProcessing(): void {
    // Fire and forget — don't await
    this.processQueueInBackground();
  }

  /**
   * Start the scheduled polling interval.
   * Checks every 60 seconds if we're within the schedule window,
   * and auto-starts processing if there are pending jobs.
   */
  startScheduler(): void {
    if (this.schedulerInterval) return; // Already running

    const POLL_INTERVAL_MS = 60_000; // 60 seconds

    log.info("Converter scheduler started — polling every 60s");

    this.schedulerInterval = setInterval(async () => {
      try {
        // Check if we're within the configured schedule window
        const withinSchedule =
          await converterScheduleService.isWithinSchedule();
        if (!withinSchedule) return;

        // Check if there are any pending jobs
        const stats = await converterQueueService.getQueueStats();
        if (stats.pending === 0) return;

        log.info(
          `Scheduler: within schedule window, ${stats.pending} pending job(s) — starting processing`,
        );
        this.startProcessing();
      } catch (err) {
        log.error("Scheduler poll error", { error: (err as Error).message });
      }
    }, POLL_INTERVAL_MS);
  }

  /**
   * Stop the scheduled polling interval.
   */
  stopScheduler(): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
      log.info("Converter scheduler stopped");
    }
  }

  // --------------------------------------------------------------------------
  // Internal Processing Loop
  // --------------------------------------------------------------------------

  /**
   * Background processing loop — processes one job at a time.
   * Dequeues a pending job (oldest first by createdAt), uploads its files
   * to RAGFlow, then auto-starts the next pending job.
   * Waits for the Python converter to complete file conversion first.
   * Stops when no more pending jobs remain.
   */
  private async processQueueInBackground(): Promise<void> {
    // Prevent concurrent processing
    if (this.isProcessing) return;
    this.isProcessing = true;

    log.info("Background queue processing started");

    try {
      // Move all pending jobs to waiting queue before processing
      await converterQueueService.enqueuePendingJobs();

      // Process jobs one at a time until queue is empty
      let job = await converterQueueService.dequeueNextJob();
      while (job) {
        log.info(
          `Processing job ${job.id} for version ${job.versionId} (${job.fileCount} files)`,
        );

        // Wait for Python converter to finish processing all files
        const convertedFiles = await this.waitForConversion(job.id);

        // Upload each converted file to RAGFlow
        for (const file of convertedFiles) {
          try {
            if (!file.pdfPath) {
              // This should not happen after waitForConversion, but guard anyway
              const errMsg = `Converted PDF not found — file was not converted`;
              log.error(
                `File ${file.id} (${file.fileName}) has no pdfPath — marking as failed`,
              );
              await converterQueueService.updateFileStatus(file.id, "failed", {
                error: errMsg,
              });

              socketService.emit("converter:file:status", {
                jobId: job.id,
                fileId: file.id,
                fileName: file.fileName,
                status: "failed",
                error: errMsg,
              });
              continue;
            }

            // Resolve relative pdfPath from Redis against config.uploadDir
            const absolutePdfPath = path.resolve(
              config.uploadDir,
              file.pdfPath,
            );
            log.debug(
              `Uploading file ${file.id}: pdfPath=${file.pdfPath}, resolved=${absolutePdfPath}`,
            );

            const fileBuffer = await fs.readFile(absolutePdfPath);
            const fileName = path.basename(absolutePdfPath);

            // Capture upload response to extract RAGFlow document ID
            const uploadResult = await ragflowProxyService.uploadDocument(
              job.serverId,
              job.datasetId,
              fileBuffer,
              fileName,
            );

            // RAGFlow returns an array of doc objects: [{ id, name, ... }]
            const ragflowDocs = Array.isArray(uploadResult)
              ? uploadResult
              : [uploadResult];
            const ragflowDocId: string | undefined = ragflowDocs[0]?.id;

            if (!ragflowDocId) {
              log.warn(
                `No RAGFlow doc ID returned for file ${file.fileName} — parse/delete may not work`,
              );
            } else {
              log.info(
                `Saved RAGFlow doc ID ${ragflowDocId} for file ${file.fileName}`,
              );
            }

            // Mark file as finished and persist the RAGFlow doc ID
            // Use conditional spread to satisfy exactOptionalPropertyTypes
            await converterQueueService.updateFileStatus(file.id, "finished", {
              ...(ragflowDocId ? { ragflowDocId } : {}),
            });
            log.info(`Uploaded to RAGFlow: ${fileName} (file ${file.id})`);

            // Emit real-time status via WebSocket
            socketService.emit("converter:file:status", {
              jobId: job.id,
              fileId: file.id,
              fileName: file.fileName,
              status: "finished",
            });
          } catch (err) {
            // Mark file as failed
            await converterQueueService.updateFileStatus(file.id, "failed", {
              error: (err as Error).message,
            });
            log.error(
              `Failed to upload file ${file.id}: ${(err as Error).message}`,
            );

            // Emit real-time status via WebSocket
            socketService.emit("converter:file:status", {
              jobId: job.id,
              fileId: file.id,
              fileName: file.fileName,
              status: "failed",
            });
          }
        }

        // Check if all files are done → mark job finished or failed
        const updatedFiles = await converterQueueService.getJobFiles(job.id);
        const allDone = updatedFiles.every(
          (f) => f.status === "finished" || f.status === "failed",
        );
        if (allDone) {
          const finishedCount = updatedFiles.filter(
            (f) => f.status === "finished",
          ).length;
          const failedCount = updatedFiles.filter(
            (f) => f.status === "failed",
          ).length;

          // If ALL files failed → job is failed; otherwise finished
          const jobStatus = finishedCount === 0 ? "failed" : "finished";

          await converterQueueService.updateVersionJobStatus(job.id, jobStatus);

          if (jobStatus === "failed") {
            log.warn(
              `Job ${job.id}: all ${failedCount} file(s) failed — marking job as failed`,
            );
          }

          // Emit job completion via WebSocket
          socketService.emit("converter:job:status", {
            jobId: job.id,
            versionId: job.versionId,
            status: jobStatus,
            fileCount: updatedFiles.length,
            finishedCount,
            failedCount,
          });

          // ── Archive to Postgres then purge Redis ──────────────────────────
          // Write durable records to Postgres first, then clean up Redis keys.
          // This ensures ragflow_doc_id survives Redis restarts/flushes.
          try {
            await converterQueueService.archiveJobToPostgres(job.id);
            await converterQueueService.deleteJobFromRedis(job.id);
          } catch (archiveErr) {
            // Non-fatal: Redis keys will remain until next manual cleanup.
            // Postgres may be partially written — next run will upsert missing rows.
            log.error("Failed to archive/purge job from Redis", {
              jobId: job.id,
              error: (archiveErr as Error).message,
            });
          }
        }

        // Dequeue next waiting job immediately
        job = await converterQueueService.dequeueNextJob();
      }

      log.info("Background queue processing finished — no more pending jobs");
    } catch (err) {
      log.error("Background queue processing error", {
        error: (err as Error).message,
      });
    } finally {
      this.isProcessing = false;
    }
  }

  // --------------------------------------------------------------------------
  // Conversion Wait Helper
  // --------------------------------------------------------------------------

  /**
   * Wait for the Python converter to finish converting all files in a job.
   * Polls Redis every 10 seconds, checking file statuses.
   * A file is considered "done" by the converter when its status changes
   * from 'pending'/'processing' to 'completed' (with pdfPath) or 'failed'.
   *
   * @param jobId - Version job UUID
   * @returns Array of files ready for upload (status 'completed' with pdfPath)
   */
  private async waitForConversion(jobId: string): Promise<FileTracking[]> {
    const POLL_INTERVAL_MS = 10_000; // 10 seconds
    const MAX_WAIT_MS = 30 * 60 * 1000; // 30 minutes max
    const startTime = Date.now();

    log.info(
      `Waiting for Python converter to finish job ${jobId} (polling every 10s, max 30min)...`,
    );

    while (Date.now() - startTime < MAX_WAIT_MS) {
      const files = await converterQueueService.getJobFiles(jobId);

      // Check if all files have been processed by the converter
      // The Python converter sets status to 'completed' (success) or 'failed'
      const allConverterDone = files.every(
        (f) =>
          f.status === "completed" ||
          f.status === "failed" ||
          f.status === "finished",
      );

      if (allConverterDone) {
        const readyFiles = files.filter(
          (f) => f.status === "completed" && f.pdfPath,
        );
        const failedFiles = files.filter((f) => f.status === "failed");

        log.info(
          `Converter finished job ${jobId}: ${readyFiles.length} ready, ${failedFiles.length} failed`,
        );

        // Emit WebSocket for any files already failed by the converter
        for (const f of failedFiles) {
          socketService.emit("converter:file:status", {
            jobId,
            fileId: f.id,
            fileName: f.fileName,
            status: "failed",
            error: f.error || "Conversion failed",
          });
        }

        return readyFiles;
      }

      // Log progress
      const pending = files.filter(
        (f) => f.status === "pending" || f.status === "processing",
      ).length;
      const completed = files.filter((f) => f.status === "completed").length;
      const failed = files.filter((f) => f.status === "failed").length;
      const elapsed = Math.round((Date.now() - startTime) / 1000);

      log.debug(
        `Conversion progress for job ${jobId}: ${completed} completed, ${failed} failed, ${pending} still converting (${elapsed}s elapsed)`,
      );

      // Wait before polling again
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    // Timeout — return whatever is ready
    log.warn(
      `Conversion wait timed out for job ${jobId} after 30 minutes — uploading what's ready`,
    );
    const files = await converterQueueService.getJobFiles(jobId);
    const readyFiles = files.filter(
      (f) => f.status === "completed" && f.pdfPath,
    );

    // Mark remaining pending/processing files as timed out
    const timedOut = files.filter(
      (f) => f.status === "pending" || f.status === "processing",
    );
    for (const f of timedOut) {
      await converterQueueService.updateFileStatus(f.id, "failed", {
        error: "Conversion timed out after 30 minutes",
      });
      socketService.emit("converter:file:status", {
        jobId,
        fileId: f.id,
        fileName: f.fileName,
        status: "failed",
        error: "Conversion timed out after 30 minutes",
      });
    }

    return readyFiles;
  }
}

/** Exported singleton instance */
export const converterWorkerService =
  ConverterWorkerService.getSharedInstance();
