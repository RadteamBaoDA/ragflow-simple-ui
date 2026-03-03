/**
 * @fileoverview Converter Queue Service — Redis-backed version-level job queue.
 *
 * Manages the lifecycle of **version-level** conversion jobs and per-file
 * tracking. Each version gets ONE job in Redis; individual files are tracked
 * via separate Redis hashes beneath that job.
 *
 * Redis Key Layout:
 *   converter:vjob:{jobId}                 — Hash: version job metadata
 *   converter:vjob:pending                 — Sorted Set: pending job IDs (score=ts)
 *   converter:vjob:status:{status}         — Set: job IDs by status
 *   converter:vjob:all                     — Set: all job IDs
 *   converter:version:active_job:{verId}   — String: active job ID for a version
 *   converter:files:{jobId}                — Set: file tracking IDs for a job
 *   converter:file:{fileId}                — Hash: per-file tracking record
 *
 * @description Implements Singleton Pattern per coding guidelines.
 * @module modules/converter/converter-queue
 */
import { v4 as uuidv4 } from "uuid";
import { getRedisClient } from "@/shared/services/redis.service.js";
import { ModelFactory } from "@/shared/models/factory.js";
import { log } from "@/shared/services/logger.service.js";

// ============================================================================
// Types
// ============================================================================

/** Possible statuses for a conversion job or file */
export type ConversionJobStatus =
  | "pending"
  | "waiting"
  | "converting"
  | "processing"
  | "completed"
  | "finished"
  | "failed";

/**
 * A version-level conversion job.
 * @description One job per version — covers all files uploaded to that version.
 */
export interface VersionJob {
  /** Unique job identifier */
  id: string;
  /** Project the version belongs to */
  projectId: string;
  /** Category within the project */
  categoryId: string;
  /** Version within the category */
  versionId: string;
  /** RAGFlow server ID for upload */
  serverId: string;
  /** RAGFlow dataset ID for upload */
  datasetId: string;
  /** Overall job status */
  status: ConversionJobStatus;
  /** JSON config blob with per-category/version converter settings */
  config?: string | undefined;
  /** Total number of files in this job */
  fileCount: number;
  /** Number of finished files */
  finishedCount: number;
  /** Number of failed files */
  failedCount: number;
  /** ISO timestamp of job creation */
  createdAt: string;
  /** ISO timestamp of last status update */
  updatedAt: string;
}

/**
 * Per-file tracking record stored in Redis.
 * @description Tracks individual file conversion status within a version job.
 */
export interface FileTracking {
  /** Unique file tracking ID */
  id: string;
  /** Parent version job ID */
  jobId: string;
  /** Version ID (for direct lookup) */
  versionId: string;
  /** Original file name */
  fileName: string;
  /** Local filesystem path to the original file */
  filePath: string;
  /** Current file conversion status */
  status: ConversionJobStatus;
  /** Path to converted PDF (set after conversion) */
  pdfPath?: string | undefined;
  /** RAGFlow document ID (set after upload to RAGFlow) */
  ragflowDocId?: string | undefined;
  /** RAGFlow parser run status: UNSTART | RUNNING | DONE | FAIL (set by poller) */
  ragflowRun?: string | undefined;
  /** RAGFlow parsing progress as decimal 0-1 (set by poller) */
  ragflowProgress?: string | undefined;
  /** RAGFlow parsing progress message (set by poller) */
  ragflowProgressMsg?: string | undefined;
  /** Number of chunks created in RAGFlow (set by poller) */
  ragflowChunkCount?: string | undefined;
  /** Error message if failed */
  error?: string | undefined;
  /** ISO timestamp of creation */
  createdAt: string;
  /** ISO timestamp of last update */
  updatedAt: string;
}

/**
 * Aggregate statistics for the version job queue.
 */
export interface QueueStats {
  /** Number of jobs not yet triggered */
  pending: number;
  /** Number of jobs in queue waiting to start */
  waiting: number;
  /** Number of jobs currently being processed */
  converting: number;
  /** Number of successfully finished jobs */
  finished: number;
  /** Number of failed jobs */
  failed: number;
  /** Total jobs across all statuses */
  total: number;
}

/**
 * Filter options for listing version jobs.
 */
export interface JobListFilter {
  /** Filter by job status */
  status?: ConversionJobStatus | undefined;
  /** Filter by project ID */
  projectId?: string | undefined;
  /** Filter by category ID */
  categoryId?: string | undefined;
  /** Filter by version ID */
  versionId?: string | undefined;
  /** Page number (1-based) */
  page?: number | undefined;
  /** Number of items per page */
  pageSize?: number | undefined;
}

// ============================================================================
// Redis Key Constants
// ============================================================================

/** Prefix for version job hashes */
const VJOB_KEY_PREFIX = "converter:vjob:";
/** Sorted set holding waiting version job IDs (score = timestamp) */
const WAITING_QUEUE_KEY = "converter:vjob:waiting";
/** Set holding job IDs by status */
const STATUS_SET_PREFIX = "converter:vjob:status:";
/** All version job IDs set */
const ALL_JOBS_KEY = "converter:vjob:all";
/** Active job pointer per version (String key) */
const ACTIVE_JOB_PREFIX = "converter:version:active_job:";
/** Set of file IDs per job */
const FILES_SET_PREFIX = "converter:files:";
/** Prefix for per-file tracking hashes */
const FILE_KEY_PREFIX = "converter:file:";
/** Manual trigger flag */
const MANUAL_TRIGGER_KEY = "converter:manual_trigger";
/** Schedule config key */
const SCHEDULE_CONFIG_KEY = "converter:schedule:config";

// ============================================================================
// Service
// ============================================================================

/**
 * ConverterQueueService manages version-level conversion jobs via Redis.
 * @description Singleton pattern — use getSharedInstance().
 */
export class ConverterQueueService {
  /** Singleton instance */
  private static instance: ConverterQueueService;

  /**
   * Get the shared singleton instance.
   * @returns ConverterQueueService singleton
   */
  static getSharedInstance(): ConverterQueueService {
    if (!this.instance) {
      this.instance = new ConverterQueueService();
    }
    return this.instance;
  }

  /**
   * Get the Redis client, throwing if not available.
   * @returns Active Redis client
   * @throws Error if Redis is not initialized
   */
  private getClient() {
    const client = getRedisClient();
    if (!client) {
      throw new Error(
        "Redis client not available — converter queue requires Redis",
      );
    }
    return client;
  }

  // --------------------------------------------------------------------------
  // File Enqueue (Main Entry Point)
  // --------------------------------------------------------------------------

  /**
   * Add a file to the conversion queue for a version.
   * Only joins an existing job if it is in "pending" status.
   * If the active job is waiting/converting, creates a NEW pending job.
   *
   * @param params - File and version metadata
   * @returns Object with the jobId and fileId
   */
  async addFileToQueue(params: {
    projectId: string;
    categoryId: string;
    versionId: string;
    serverId: string;
    datasetId: string;
    fileName: string;
    filePath: string;
    config?: string | undefined;
  }): Promise<{ jobId: string; fileId: string }> {
    const client = this.getClient();
    const now = new Date().toISOString();

    // 1. Check for an active job for this version
    const activeJobKey = `${ACTIVE_JOB_PREFIX}${params.versionId}`;
    let jobId = await client.get(activeJobKey);

    // 2. If active job exists, only join if it's still pending
    let shouldCreateNew = !jobId;
    if (jobId) {
      const currentStatus = await client.hGet(
        `${VJOB_KEY_PREFIX}${jobId}`,
        "status",
      );
      // If job is waiting/converting, don't add to it — create a new pending job
      if (currentStatus !== "pending") {
        shouldCreateNew = true;
      }
    }

    // 3. Create new pending job if needed
    if (shouldCreateNew) {
      jobId = uuidv4();
      const job: VersionJob = {
        id: jobId,
        projectId: params.projectId,
        categoryId: params.categoryId,
        versionId: params.versionId,
        serverId: params.serverId,
        datasetId: params.datasetId,
        status: "pending",
        config: params.config,
        fileCount: 0,
        finishedCount: 0,
        failedCount: 0,
        createdAt: now,
        updatedAt: now,
      };

      // Store version job hash
      await client.hSet(`${VJOB_KEY_PREFIX}${jobId}`, this.jobToHash(job));

      // Track in status and all-jobs sets
      await client.sAdd(`${STATUS_SET_PREFIX}pending`, jobId);
      await client.sAdd(ALL_JOBS_KEY, jobId);

      // Set active job pointer (overwrite previous)
      await client.set(activeJobKey, jobId);

      log.info("Version job created", {
        jobId,
        versionId: params.versionId,
      });
    }

    // 4. Create file tracking record
    const fileId = uuidv4();
    const file: FileTracking = {
      id: fileId,
      jobId: jobId!,
      versionId: params.versionId,
      fileName: params.fileName,
      filePath: params.filePath,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };

    // Store file hash
    await client.hSet(`${FILE_KEY_PREFIX}${fileId}`, this.fileToHash(file));

    // Add file ID to the job's file set
    await client.sAdd(`${FILES_SET_PREFIX}${jobId!}`, fileId);

    // Increment file count on the job
    await client.hIncrBy(`${VJOB_KEY_PREFIX}${jobId!}`, "fileCount", 1);

    log.info("File added to conversion queue", {
      fileId,
      jobId,
      fileName: params.fileName,
    });

    return { jobId: jobId!, fileId };
  }

  // --------------------------------------------------------------------------
  // Version Job Status
  // --------------------------------------------------------------------------

  /**
   * Get a single version job by ID.
   * @param jobId - Job UUID
   * @returns VersionJob or null if not found
   */
  async getVersionJob(jobId: string): Promise<VersionJob | null> {
    const client = this.getClient();
    const data = await client.hGetAll(`${VJOB_KEY_PREFIX}${jobId}`);
    if (!data || !data.id) return null;
    return this.hashToJob(data);
  }

  /**
   * Update a version job's status.
   * @param jobId - Job UUID
   * @param status - New status
   */
  async updateVersionJobStatus(
    jobId: string,
    status: ConversionJobStatus,
  ): Promise<void> {
    const client = this.getClient();
    const jobKey = `${VJOB_KEY_PREFIX}${jobId}`;

    // Get current status and versionId
    const [currentStatus, versionId] = await Promise.all([
      client.hGet(jobKey, "status"),
      client.hGet(jobKey, "versionId"),
    ]);
    if (!currentStatus) {
      throw new Error(`Version job not found: ${jobId}`);
    }

    // Update hash fields
    await client.hSet(jobKey, {
      status,
      updatedAt: new Date().toISOString(),
    });

    // Move between status sets
    if (currentStatus !== status) {
      await client.sRem(`${STATUS_SET_PREFIX}${currentStatus}`, jobId);
      await client.sAdd(`${STATUS_SET_PREFIX}${status}`, jobId);

      // Remove from waiting queue when no longer waiting
      if (currentStatus === "waiting") {
        await client.zRem(WAITING_QUEUE_KEY, jobId);
      }
    }

    // Clear active job pointer when job is finished or failed
    if ((status === "finished" || status === "failed") && versionId) {
      const activeJobKey = `${ACTIVE_JOB_PREFIX}${versionId}`;
      const activeJobId = await client.get(activeJobKey);
      if (activeJobId === jobId) {
        await client.del(activeJobKey);
      }
    }

    log.debug("Version job status updated", { jobId, status });
  }

  /**
   * List version jobs with optional filtering and pagination.
   *
   * Two-tier strategy:
   *  - pending / waiting / converting → query Redis
   *  - finished / failed              → query Postgres (converter_version_jobs)
   *  - no status filter               → merge both sources
   *
   * @param filters - Optional filters
   * @returns Paginated list of VersionJob objects
   */
  async listVersionJobs(
    filters?: JobListFilter,
  ): Promise<{ jobs: VersionJob[]; total: number }> {
    const page = filters?.page ?? 1;
    const pageSize = filters?.pageSize ?? 20;
    const status = filters?.status;

    // ── Helper: load active jobs from Redis ──────────────────────────────
    const loadFromRedis = async (
      statusToLoad?: ConversionJobStatus,
    ): Promise<VersionJob[]> => {
      const client = this.getClient();
      let ids: string[];
      if (statusToLoad) {
        ids = await client.sMembers(`${STATUS_SET_PREFIX}${statusToLoad}`);
      } else {
        // Active statuses only — terminal ones are in Postgres
        const [p, w, c] = await Promise.all([
          client.sMembers(`${STATUS_SET_PREFIX}pending`),
          client.sMembers(`${STATUS_SET_PREFIX}waiting`),
          client.sMembers(`${STATUS_SET_PREFIX}converting`),
        ]);
        ids = [...p, ...w, ...c];
      }

      const jobs: VersionJob[] = [];
      for (const id of ids) {
        const job = await this.getVersionJob(id);
        if (!job) continue;
        if (filters?.projectId && job.projectId !== filters.projectId) continue;
        if (filters?.categoryId && job.categoryId !== filters.categoryId)
          continue;
        if (filters?.versionId && job.versionId !== filters.versionId) continue;
        jobs.push(job);
      }
      return jobs;
    };

    // ── Helper: load archived jobs from Postgres ──────────────────────────
    const loadFromPostgres = async (
      pgStatus?: "finished" | "failed",
    ): Promise<{ jobs: VersionJob[]; total: number }> => {
      const result = await ModelFactory.converterVersionJob.listWithFilters({
        ...(pgStatus ? { status: pgStatus } : {}),
        ...(filters?.projectId ? { projectId: filters.projectId } : {}),
        ...(filters?.categoryId ? { categoryId: filters.categoryId } : {}),
        ...(filters?.versionId ? { versionId: filters.versionId } : {}),
        page,
        pageSize,
      });
      // Convert Postgres row shape to VersionJob shape
      const jobs: VersionJob[] = result.jobs.map((row) => ({
        id: row.id,
        projectId: row.project_id,
        categoryId: row.category_id,
        versionId: row.version_id,
        serverId: row.server_id,
        datasetId: row.dataset_id,
        status: row.status as ConversionJobStatus,
        fileCount: row.file_count,
        finishedCount: row.finished_count,
        failedCount: row.failed_count,
        createdAt: row.job_created_at.toISOString(),
        updatedAt: row.job_updated_at.toISOString(),
      }));
      return { jobs, total: result.total };
    };

    // ── Route to the right store based on status filter ──────────────────
    const activeStatuses: ConversionJobStatus[] = [
      "pending",
      "waiting",
      "converting",
    ];
    const terminalStatuses: ConversionJobStatus[] = ["finished", "failed"];

    if (status && activeStatuses.includes(status)) {
      // Only Redis
      const allJobs = await loadFromRedis(status);
      allJobs.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      const total = allJobs.length;
      const start = (page - 1) * pageSize;
      return { jobs: allJobs.slice(start, start + pageSize), total };
    }

    if (status && terminalStatuses.includes(status)) {
      // Only Postgres
      return loadFromPostgres(status as "finished" | "failed");
    }

    // No status filter → merge both: Redis (active) first, Postgres (history) paginated separately
    // Return Redis-active jobs + first page of Postgres history merged
    const [redisJobs, pgResult] = await Promise.all([
      loadFromRedis(),
      loadFromPostgres(),
    ]);
    redisJobs.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const allJobs = [...redisJobs, ...pgResult.jobs];
    return {
      jobs: allJobs.slice(0, pageSize),
      total: redisJobs.length + pgResult.total,
    };
  }

  /**
   * Get aggregate queue statistics.
   *
   * Active counts (pending/waiting/converting) from Redis.
   * Terminal counts (finished/failed) from Postgres — accurate even after Redis flush.
   *
   * @returns QueueStats with counts by status
   */
  async getQueueStats(): Promise<QueueStats> {
    const client = this.getClient();

    // Active counts from Redis
    const [pending, waiting, converting] = await Promise.all([
      client.sCard(`${STATUS_SET_PREFIX}pending`),
      client.sCard(`${STATUS_SET_PREFIX}waiting`),
      client.sCard(`${STATUS_SET_PREFIX}converting`),
    ]);

    // Terminal counts from Postgres
    const { finished, failed } =
      await ModelFactory.converterVersionJob.countByStatus();

    return {
      pending,
      waiting,
      converting,
      finished,
      failed,
      total: pending + waiting + converting + finished + failed,
    };
  }

  // --------------------------------------------------------------------------
  // File Tracking
  // --------------------------------------------------------------------------

  /**
   * Get all file tracking records for a version job.
   *
   * Two-tier: checks Redis first.
   * If the job is not in Redis (archived), falls back to Postgres
   * (document_category_version_files) via the version ID stored in the job.
   *
   * @param jobId - Version job UUID
   * @returns Array of FileTracking records
   */
  async getJobFiles(jobId: string): Promise<FileTracking[]> {
    const client = this.getClient();

    // Check if the job's file set exists in Redis
    const fileIds = await client.sMembers(`${FILES_SET_PREFIX}${jobId}`);

    if (fileIds && fileIds.length > 0) {
      // Job is still in Redis — return files from Redis
      const files: FileTracking[] = [];
      for (const fileId of fileIds) {
        const data = await client.hGetAll(`${FILE_KEY_PREFIX}${fileId}`);
        if (data && data.id) files.push(this.hashToFile(data));
      }
      files.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      return files;
    }

    // Job not in Redis — look it up in Postgres to get the versionId
    const archivedJob = await ModelFactory.converterVersionJob.findById(jobId);
    if (!archivedJob) return [];

    // Load file records from Postgres document_category_version_files
    const pgFiles = await ModelFactory.converterVersionJob.findFilesByVersionId(
      archivedJob.version_id,
    );

    // Shape into FileTracking (without Redis-only fields like filePath/pdfPath)
    const now = new Date().toISOString();
    return pgFiles.map((f, idx) => ({
      id: `archived-${archivedJob.id}-${idx}`,
      jobId,
      versionId: archivedJob.version_id,
      fileName: f.fileName,
      filePath: "",
      status: f.status as ConversionJobStatus,
      ragflowDocId: f.ragflowDocId ?? undefined,
      error: f.error ?? undefined,
      createdAt: now,
      updatedAt: now,
    }));
  }

  /**
   * Update a file tracking record's status.
   * Also updates the parent job's completed/failed counters.
   *
   * @param fileId - File tracking UUID
   * @param status - New status
   * @param data - Optional pdfPath or error
   */
  async updateFileStatus(
    fileId: string,
    status: ConversionJobStatus,
    data?: { pdfPath?: string; error?: string; ragflowDocId?: string },
  ): Promise<void> {
    const client = this.getClient();
    const fileKey = `${FILE_KEY_PREFIX}${fileId}`;

    // Get current file data
    const currentStatus = await client.hGet(fileKey, "status");
    const jobId = await client.hGet(fileKey, "jobId");
    if (!currentStatus || !jobId) {
      throw new Error(`File tracking record not found: ${fileId}`);
    }

    // Update file hash
    const updates: Record<string, string> = {
      status,
      updatedAt: new Date().toISOString(),
    };
    if (data?.pdfPath) updates.pdfPath = data.pdfPath;
    if (data?.error) updates.error = data.error;
    if (data?.ragflowDocId) updates.ragflowDocId = data.ragflowDocId;

    await client.hSet(fileKey, updates);

    // Update job counters if status changed
    if (currentStatus !== status) {
      const jobKey = `${VJOB_KEY_PREFIX}${jobId}`;

      // Decrement old counter if it was finished/failed
      if (currentStatus === "finished") {
        await client.hIncrBy(jobKey, "finishedCount", -1);
      } else if (currentStatus === "failed") {
        await client.hIncrBy(jobKey, "failedCount", -1);
      }

      // Increment new counter
      if (status === "finished") {
        await client.hIncrBy(jobKey, "finishedCount", 1);
      } else if (status === "failed") {
        await client.hIncrBy(jobKey, "failedCount", 1);
      }

      // Update job's updatedAt
      await client.hSet(jobKey, { updatedAt: new Date().toISOString() });
    }
  }

  /**
   * Update live RAGFlow parser status fields for a file tracking record.
   * Writes ragflowRun, ragflowProgress, ragflowProgressMsg, ragflowChunkCount
   * into the Redis hash without touching job counters.
   * Called by the ParserPollerService during background polling.
   *
   * @param fileId - File tracking UUID
   * @param data - Live parser status data from RAGFlow
   */
  async updateFileParserStatus(
    fileId: string,
    data: {
      ragflowRun: string;
      ragflowProgress: string;
      ragflowProgressMsg: string;
      ragflowChunkCount: string;
    },
  ): Promise<void> {
    const client = this.getClient();
    const fileKey = `${FILE_KEY_PREFIX}${fileId}`;

    // Verify the record exists
    const exists = await client.hGet(fileKey, "id");
    if (!exists) return; // silently skip if file record is gone

    // Write parser status fields to hash
    await client.hSet(fileKey, {
      ragflowRun: data.ragflowRun,
      ragflowProgress: data.ragflowProgress,
      ragflowProgressMsg: data.ragflowProgressMsg,
      ragflowChunkCount: data.ragflowChunkCount,
      updatedAt: new Date().toISOString(),
    });
  }

  // --------------------------------------------------------------------------

  /**
   * Dequeue the next waiting version job (oldest first).
   * Marks it as converting and returns the job.
   * @returns VersionJob or null if waiting queue is empty
   */
  async dequeueNextJob(): Promise<VersionJob | null> {
    const client = this.getClient();

    // Pop the oldest waiting job
    const result = await client.zRange(WAITING_QUEUE_KEY, 0, 0);
    if (!result || result.length === 0) return null;

    const jobId = result[0]!;
    const job = await this.getVersionJob(jobId);
    if (!job) return null;

    // Mark as converting
    await this.updateVersionJobStatus(jobId, "converting");
    return { ...job, status: "converting" };
  }

  /**
   * Move all pending jobs to the waiting queue.
   * Called by Force Start or the scheduler before processing begins.
   * @returns Number of jobs moved to waiting
   */
  async enqueuePendingJobs(): Promise<number> {
    const client = this.getClient();

    // Get all pending job IDs
    const pendingIds = await client.sMembers(`${STATUS_SET_PREFIX}pending`);
    if (!pendingIds || pendingIds.length === 0) return 0;

    let moved = 0;
    for (const jobId of pendingIds) {
      const job = await this.getVersionJob(jobId);
      if (!job || job.status !== "pending") continue;

      // Move to waiting status
      await this.updateVersionJobStatus(jobId, "waiting");

      // Add to waiting sorted set (score = original createdAt timestamp)
      await client.zAdd(WAITING_QUEUE_KEY, {
        score: new Date(job.createdAt).getTime(),
        value: jobId,
      });

      moved++;
    }

    if (moved > 0) {
      log.info(`Enqueued ${moved} pending job(s) to waiting queue`);
    }
    return moved;
  }

  // --------------------------------------------------------------------------
  // Manual Trigger
  // --------------------------------------------------------------------------

  /**
   * Set the manual trigger flag so the converter starts processing now.
   */
  async setManualTrigger(): Promise<void> {
    const client = this.getClient();
    await client.set(MANUAL_TRIGGER_KEY, "1", { EX: 86400 });
    log.info("Manual conversion trigger activated");
  }

  /**
   * Check if manual trigger is active.
   * @returns True if manual trigger flag is set
   */
  async isManualTriggerActive(): Promise<boolean> {
    const client = this.getClient();
    const value = await client.get(MANUAL_TRIGGER_KEY);
    return value === "1";
  }

  /**
   * Clear the manual trigger flag.
   */
  async clearManualTrigger(): Promise<void> {
    const client = this.getClient();
    await client.del(MANUAL_TRIGGER_KEY);
  }

  // --------------------------------------------------------------------------
  // Startup Cleanup
  // --------------------------------------------------------------------------

  /**
   * Clean up stuck jobs on server startup.
   * Finds jobs in "converting" or "waiting" status where all files have
   * already reached a terminal state (finished/failed), and forces the
   * correct job status. This handles the case where the server restarted
   * mid-processing or a previous run left orphaned jobs.
   *
   * @returns Number of jobs cleaned up
   */
  async cleanupStuckJobs(): Promise<number> {
    const client = this.getClient();
    let cleaned = 0;

    // Check both "converting" and "waiting" status sets
    for (const stuckStatus of ["converting", "waiting"] as const) {
      const jobIds = await client.sMembers(
        `${STATUS_SET_PREFIX}${stuckStatus}`,
      );
      if (!jobIds || jobIds.length === 0) continue;

      for (const jobId of jobIds) {
        const job = await this.getVersionJob(jobId);
        if (!job) continue;

        // Get all files for this job
        const files = await this.getJobFiles(jobId);
        if (files.length === 0) continue;

        // Check if all files have reached a terminal state
        const allDone = files.every(
          (f) =>
            f.status === "finished" ||
            f.status === "failed" ||
            f.status === "completed",
        );

        if (!allDone) continue;

        // Determine correct job status
        const finishedCount = files.filter(
          (f) => f.status === "finished" || f.status === "completed",
        ).length;
        const newStatus = finishedCount === 0 ? "failed" : "finished";

        await this.updateVersionJobStatus(jobId, newStatus);
        cleaned++;

        log.warn(
          `Startup cleanup: job ${jobId} was stuck in "${stuckStatus}" — forced to "${newStatus}" (${finishedCount} finished, ${files.length - finishedCount} failed)`,
        );
      }
    }

    if (cleaned > 0) {
      log.info(`Startup cleanup: fixed ${cleaned} stuck job(s)`);
    }

    return cleaned;
  }

  // --------------------------------------------------------------------------
  // Serialization Helpers
  // --------------------------------------------------------------------------

  /**
   * Convert VersionJob to a flat string record for Redis hSet.
   * @param job - Job object
   * @returns Flat key-value pairs
   */
  private jobToHash(job: VersionJob): Record<string, string> {
    return {
      id: job.id,
      projectId: job.projectId,
      categoryId: job.categoryId,
      versionId: job.versionId,
      serverId: job.serverId,
      datasetId: job.datasetId,
      status: job.status,
      config: job.config ?? "",
      fileCount: String(job.fileCount),
      finishedCount: String(job.finishedCount),
      failedCount: String(job.failedCount),
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }

  /**
   * Convert a Redis hash record back to a VersionJob object.
   * @param data - Flat key-value pairs from Redis
   * @returns VersionJob object
   */
  private hashToJob(data: Record<string, string>): VersionJob {
    return {
      id: data.id ?? "",
      projectId: data.projectId ?? "",
      categoryId: data.categoryId ?? "",
      versionId: data.versionId ?? "",
      serverId: data.serverId ?? "",
      datasetId: data.datasetId ?? "",
      status: (data.status as ConversionJobStatus) ?? "pending",
      config: data.config || undefined,
      fileCount: parseInt(data.fileCount ?? "0", 10),
      finishedCount: parseInt(data.finishedCount ?? "0", 10),
      failedCount: parseInt(data.failedCount ?? "0", 10),
      createdAt: data.createdAt ?? "",
      updatedAt: data.updatedAt ?? "",
    };
  }

  /**
   * Convert FileTracking to a flat string record for Redis hSet.
   * @param file - File tracking object
   * @returns Flat key-value pairs
   */
  private fileToHash(file: FileTracking): Record<string, string> {
    return {
      id: file.id,
      jobId: file.jobId,
      versionId: file.versionId,
      fileName: file.fileName,
      filePath: file.filePath,
      status: file.status,
      pdfPath: file.pdfPath ?? "",
      ragflowDocId: file.ragflowDocId ?? "",
      error: file.error ?? "",
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    };
  }

  /**
   * Convert a Redis hash record back to a FileTracking object.
   * @param data - Flat key-value pairs from Redis
   * @returns FileTracking object
   */
  private hashToFile(data: Record<string, string>): FileTracking {
    return {
      id: data.id ?? "",
      jobId: data.jobId ?? "",
      versionId: data.versionId ?? "",
      fileName: data.fileName ?? "",
      filePath: data.filePath ?? "",
      status: (data.status as ConversionJobStatus) ?? "pending",
      pdfPath: data.pdfPath || undefined,
      ragflowDocId: data.ragflowDocId || undefined,
      ragflowRun: data.ragflowRun || undefined,
      ragflowProgress: data.ragflowProgress || undefined,
      ragflowProgressMsg: data.ragflowProgressMsg || undefined,
      ragflowChunkCount: data.ragflowChunkCount || undefined,
      error: data.error || undefined,
      createdAt: data.createdAt ?? "",
      updatedAt: data.updatedAt ?? "",
    };
  }

  // --------------------------------------------------------------------------
  // Archive & Purge (Two-Tier Persistence)
  // --------------------------------------------------------------------------

  /**
   * Archive a finished/failed job from Redis to Postgres.
   *
   * Reads the job metadata and all file tracking records from Redis,
   * writes them to:
   *   - converter_version_jobs (job-level summary)
   *   - document_category_version_files (per-file ragflow_doc_id + status)
   *
   * Idempotent: safe to call twice (uses ON CONFLICT ... DO UPDATE).
   *
   * @param jobId - Version job UUID
   */
  async archiveJobToPostgres(jobId: string): Promise<void> {
    const job = await this.getVersionJob(jobId);
    if (!job) {
      log.warn(
        `archiveJobToPostgres: job ${jobId} not found in Redis — skipping`,
      );
      return;
    }

    // Collect file records
    const files = await this.getJobFiles(jobId);

    // 1. Upsert job-level row in Postgres
    await ModelFactory.converterVersionJob.upsert({
      id: job.id,
      projectId: job.projectId,
      categoryId: job.categoryId,
      versionId: job.versionId,
      serverId: job.serverId,
      datasetId: job.datasetId,
      status: job.status as "finished" | "failed",
      fileCount: job.fileCount,
      finishedCount: job.finishedCount,
      failedCount: job.failedCount,
      jobCreatedAt: new Date(job.createdAt),
      jobUpdatedAt: new Date(job.updatedAt),
    });

    // 2. Bulk-upsert file records (preserves ragflow_doc_id for delete/parse)
    if (files.length > 0) {
      await ModelFactory.documentVersionFile.bulkUpsert(
        files.map((f) => ({
          versionId: f.versionId,
          fileName: f.fileName,
          ragflowDocId: f.ragflowDocId ?? null,
          status: f.status,
          error: f.error ?? null,
        })),
      );
    }

    log.info(
      `archiveJobToPostgres: archived job ${jobId} with ${files.length} file(s) to Postgres`,
    );
  }

  /**
   * Delete all Redis keys associated with a version job.
   *
   * Keys removed:
   *   converter:vjob:{jobId}               — job metadata hash
   *   converter:vjob:status:{status}        — status set membership
   *   converter:vjob:all                    — global job ID set
   *   converter:version:active_job:{verId}  — active job pointer
   *   converter:files:{jobId}               — file ID set
   *   converter:file:{fileId}               — per-file hash (one per file)
   *
   * @param jobId - Version job UUID
   */
  async deleteJobFromRedis(jobId: string): Promise<void> {
    const client = this.getClient();
    const jobKey = `${VJOB_KEY_PREFIX}${jobId}`;

    // Read job metadata before deleting (need status + versionId)
    const jobData = await client.hGetAll(jobKey);
    if (!jobData || !jobData.id) {
      log.debug(
        `deleteJobFromRedis: job ${jobId} not in Redis — nothing to remove`,
      );
      return;
    }

    const status = jobData.status ?? "pending";
    const versionId = jobData.versionId ?? "";

    // 1. Remove per-file hashes and the file-set
    const fileIds = await client.sMembers(`${FILES_SET_PREFIX}${jobId}`);
    if (fileIds.length > 0) {
      const fileKeys = fileIds.map((fid) => `${FILE_KEY_PREFIX}${fid}`);
      // Delete file hashes in one batch
      await client.del([`${FILES_SET_PREFIX}${jobId}`, ...fileKeys] as [
        string,
        ...string[],
      ]);
    } else {
      await client.del(`${FILES_SET_PREFIX}${jobId}`);
    }

    // 2. Remove from status set
    await client.sRem(`${STATUS_SET_PREFIX}${status}`, jobId);

    // 3. Remove from global all-jobs set
    await client.sRem(ALL_JOBS_KEY, jobId);

    // 4. Clear active_job pointer if it points to this job
    if (versionId) {
      const activeKey = `${ACTIVE_JOB_PREFIX}${versionId}`;
      const activeJobId = await client.get(activeKey);
      if (activeJobId === jobId) {
        await client.del(activeKey);
      }
    }

    // 5. Remove job hash itself
    await client.del(jobKey);

    log.info(
      `deleteJobFromRedis: purged job ${jobId} (${fileIds.length} files) from Redis`,
    );
  }

  // --------------------------------------------------------------------------
  // Queue Maintenance
  // --------------------------------------------------------------------------

  /**
   * Clear all stuck converter queue data from Redis.
   *
   * Removes all Redis keys matching converter key patterns so stale/stuck
   * waiting or converting jobs are fully reset. Safe to call while no
   * Python worker or Node upload worker is actively processing.
   *
   * Key patterns deleted:
   *   converter:vjob:*  converter:file:*  converter:files:*
   *   converter:version:active_job:*  converter:manual_trigger
   *
   * @returns Number of Redis keys deleted
   */
  async clearQueue(): Promise<{ deleted: number }> {
    const redis = getRedisClient();
    if (!redis) throw new Error("Redis client is not available");

    /** Scan and delete keys matching a glob pattern, returns count deleted */
    const deleteByPattern = async (pattern: string): Promise<number> => {
      const keys = await redis.keys(pattern);
      if (keys.length === 0) return 0;
      // Delete in batches of 100 to avoid blocking Redis
      for (let i = 0; i < keys.length; i += 100) {
        await redis.del(keys.slice(i, i + 100) as [string, ...string[]]);
      }
      return keys.length;
    };

    const patterns = [
      "converter:vjob:*",
      "converter:file:*",
      "converter:files:*",
      "converter:version:active_job:*",
      "converter:manual_trigger",
    ];

    let totalDeleted = 0;
    for (const pattern of patterns) {
      const count = await deleteByPattern(pattern);
      totalDeleted += count;
      if (count > 0) {
        log.info(`clearQueue: deleted ${count} key(s) matching ${pattern}`);
      }
    }

    log.info(`clearQueue: total ${totalDeleted} Redis key(s) removed`);
    return { deleted: totalDeleted };
  }
}

/** Exported singleton instance */
export const converterQueueService = ConverterQueueService.getSharedInstance();
