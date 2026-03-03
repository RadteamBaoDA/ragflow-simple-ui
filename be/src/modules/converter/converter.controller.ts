/**
 * @fileoverview Converter controller — handles HTTP endpoints for conversion queue.
 *
 * Provides endpoints for listing version jobs, getting job status, file tracking,
 * queue stats, schedule config CRUD, and manual trigger.
 *
 * @module modules/converter/converter.controller
 */
import { Request, Response } from "express";
import {
  converterQueueService,
  type ConversionJobStatus,
} from "@/modules/converter/converter-queue.service.js";
import { converterScheduleService } from "@/modules/converter/converter-schedule.service.js";
import { converterUploadService } from "@/modules/converter/converter-upload.service.js";
import { converterWorkerService } from "@/modules/converter/converter-worker.service.js";
import { log } from "@/shared/services/logger.service.js";

/**
 * ConverterController handles all converter-related HTTP requests.
 */
export class ConverterController {
  // --------------------------------------------------------------------------
  // Version Job Endpoints
  // --------------------------------------------------------------------------

  /**
   * List version-level conversion jobs with optional filters.
   * GET /api/converter/jobs?status=pending&projectId=xxx&versionId=yyy&page=1&pageSize=20
   */
  static async listVersionJobs(req: Request, res: Response) {
    try {
      const { status, projectId, categoryId, versionId, page, pageSize } =
        req.query;

      const result = await converterQueueService.listVersionJobs({
        status: status ? (status as ConversionJobStatus) : undefined,
        projectId: projectId ? String(projectId) : undefined,
        categoryId: categoryId ? String(categoryId) : undefined,
        versionId: versionId ? String(versionId) : undefined,
        page: page ? parseInt(page as string, 10) : 1,
        pageSize: pageSize ? parseInt(pageSize as string, 10) : 20,
      });

      res.json(result);
    } catch (error: any) {
      log.error("Error listing version jobs", { error: error.message });
      res.status(500).json({ error: error.message || "Failed to list jobs" });
    }
  }

  /**
   * Get a single version job status.
   * GET /api/converter/jobs/:jobId
   */
  static async getVersionJobStatus(req: Request, res: Response) {
    try {
      const jobId = req.params.jobId ?? "";
      const job = await converterQueueService.getVersionJob(jobId);

      if (!job) {
        res.status(404).json({ error: "Job not found" });
        return;
      }

      res.json(job);
    } catch (error: any) {
      log.error("Error getting job status", { error: error.message });
      res
        .status(500)
        .json({ error: error.message || "Failed to get job status" });
    }
  }

  /**
   * Get file tracking records for a version job.
   * GET /api/converter/jobs/:jobId/files
   */
  static async getVersionJobFiles(req: Request, res: Response) {
    try {
      const jobId = req.params.jobId ?? "";
      const files = await converterQueueService.getJobFiles(jobId);
      res.json({ files, total: files.length });
    } catch (error: any) {
      log.error("Error getting job files", { error: error.message });
      res
        .status(500)
        .json({ error: error.message || "Failed to get job files" });
    }
  }

  // --------------------------------------------------------------------------
  // Stats
  // --------------------------------------------------------------------------

  /**
   * Get queue statistics (counts by status).
   * GET /api/converter/stats
   */
  static async getStats(_req: Request, res: Response) {
    try {
      const stats = await converterQueueService.getQueueStats();
      res.json(stats);
    } catch (error: any) {
      log.error("Error getting converter stats", { error: error.message });
      res.status(500).json({ error: error.message || "Failed to get stats" });
    }
  }

  // --------------------------------------------------------------------------
  // Schedule Config
  // --------------------------------------------------------------------------

  /**
   * Get the current converter schedule config.
   * GET /api/converter/config
   */
  static async getConfig(_req: Request, res: Response) {
    try {
      const scheduleConfig = await converterScheduleService.getConfig();
      res.json(scheduleConfig);
    } catch (error: any) {
      log.error("Error getting converter config", { error: error.message });
      res.status(500).json({ error: error.message || "Failed to get config" });
    }
  }

  /**
   * Update the converter schedule config.
   * PUT /api/converter/config
   * Body: { startHour?: number, endHour?: number, timezone?: string, enabled?: boolean }
   */
  static async updateConfig(req: Request, res: Response) {
    try {
      const { startHour, endHour, timezone, enabled } = req.body;
      const updated = await converterScheduleService.updateConfig({
        startHour,
        endHour,
        timezone,
        enabled,
      });
      res.json(updated);
    } catch (error: any) {
      log.error("Error updating converter config", { error: error.message });
      res
        .status(500)
        .json({ error: error.message || "Failed to update config" });
    }
  }

  // --------------------------------------------------------------------------
  // Manual Trigger
  // --------------------------------------------------------------------------

  /**
   * Manually trigger converter to start processing now.
   * Returns immediately — processing runs in the background via the worker.
   * POST /api/converter/start
   */
  static async startManual(_req: Request, res: Response) {
    try {
      const alreadyRunning = converterWorkerService.getIsProcessing();

      // Set the manual trigger key in Redis so the Python converter worker
      // wakes up even when outside its nightly schedule window
      await converterQueueService.setManualTrigger();

      // Move all pending jobs to waiting queue so the Python worker can
      // pick them up via dequeue_version_job()
      const enqueued = await converterQueueService.enqueuePendingJobs();
      log.info(
        `Force Start: set manual trigger, enqueued ${enqueued} pending job(s)`,
      );

      // Also start the Node.js upload loop (processes completed conversions)
      converterWorkerService.startProcessing();

      res.json({
        message: alreadyRunning
          ? "Job queued — will start after current job finishes"
          : "Conversion started — processing in background",
      });
    } catch (error: any) {
      log.error("Error triggering manual conversion", { error: error.message });
      res
        .status(500)
        .json({ error: error.message || "Failed to trigger conversion" });
    }
  }

  // --------------------------------------------------------------------------
  // Upload Completed Conversions to RAGFlow
  // --------------------------------------------------------------------------

  /**
   * Check for completed conversions and upload PDFs to RAGFlow.
   * POST /api/converter/upload
   */
  static async uploadCompleted(_req: Request, res: Response) {
    try {
      const results = await converterUploadService.processCompletedVersions();
      res.json({
        message: `Processed ${results.length} version(s)`,
        results,
      });
    } catch (error: any) {
      log.error("Error uploading completed conversions", {
        error: error.message,
      });
      res.status(500).json({
        error: error.message || "Failed to upload completed conversions",
      });
    }
  }

  // --------------------------------------------------------------------------
  // Queue Maintenance
  // --------------------------------------------------------------------------

  /**
   * Force-clear all stuck converter queue data from Redis.
   * Deletes all converter:* keys so stale waiting/converting jobs are wiped.
   * POST /api/converter/clear-queue
   */
  static async clearQueue(_req: Request, res: Response) {
    try {
      log.warn("clearQueue: Force clearing entire converter queue from Redis");
      const result = await converterQueueService.clearQueue();
      res.json({
        message: `Queue cleared — ${result.deleted} Redis key(s) removed`,
        deleted: result.deleted,
      });
    } catch (error: any) {
      log.error("Error clearing converter queue", { error: error.message });
      res.status(500).json({ error: error.message || "Failed to clear queue" });
    }
  }
}
