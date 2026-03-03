/**
 * @fileoverview Parser Poller Service — polls RAGFlow for document parser status.
 *
 * After parse is triggered (from converter upload or manual user action),
 * this service maintains a per-versionId background timer that fetches live
 * RAGFlow document status (RUNNING / DONE / FAIL) at a configurable interval
 * until all documents reach a terminal state or max duration is exceeded.
 *
 * @description Implements Singleton Pattern per coding guidelines.
 * @module modules/converter/parser-poller
 */
import { ragflowProxyService } from "@/shared/services/ragflow-proxy.service.js";
import { converterQueueService } from "@/modules/converter/converter-queue.service.js";
import { config } from "@/shared/config/index.js";
import { log } from "@/shared/services/logger.service.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Metadata for an active polling session per version.
 */
interface PollingSession {
  /** Node.js interval handle */
  timer: NodeJS.Timeout;
  /** RAGFlow server ID */
  serverId: string;
  /** RAGFlow dataset ID */
  datasetId: string;
  /** RAGFlow document IDs being tracked */
  ragflowDocIds: string[];
  /** ISO timestamp when polling started (to enforce max-lifetime) */
  startedAt: string;
}

/** Terminal RAGFlow parser statuses — polling stops when all docs reach these */
const TERMINAL_STATUSES = new Set(["DONE", "FAIL"]);

/** Maximum polling duration: 24 hours in ms */
const MAX_POLLING_DURATION_MS = 24 * 60 * 60 * 1000;

// ============================================================================
// Service
// ============================================================================

/**
 * ParserPollerService tracks RAGFlow document parsing progress per version.
 * Uses setInterval timers stored in memory — one timer per versionId.
 * @description Singleton pattern — use getSharedInstance().
 */
export class ParserPollerService {
  /** Singleton instance */
  private static instance: ParserPollerService;

  /** Map of versionId → active polling session */
  private readonly sessions = new Map<string, PollingSession>();

  /**
   * Get the shared singleton instance.
   * @returns ParserPollerService singleton
   */
  static getSharedInstance(): ParserPollerService {
    if (!this.instance) {
      this.instance = new ParserPollerService();
    }
    return this.instance;
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Start background polling for a version's parse progress.
   * If polling is already running for this version, does nothing.
   *
   * @param versionId - Version UUID (used as poll session key)
   * @param serverId - RAGFlow server UUID
   * @param datasetId - RAGFlow dataset ID
   * @param ragflowDocIds - Array of RAGFlow document IDs to watch
   */
  startPolling(
    versionId: string,
    serverId: string,
    datasetId: string,
    ragflowDocIds: string[],
  ): void {
    // Don't start a new session if one is already active
    if (this.sessions.has(versionId)) {
      log.debug("Parser poller already running for version", { versionId });
      return;
    }

    if (!ragflowDocIds.length) {
      log.warn("Parser poller: no RAGFlow doc IDs provided — skipping", {
        versionId,
      });
      return;
    }

    const intervalMs = config.converter.parserPollIntervalMs;
    log.info("Parser poller started", {
      versionId,
      docCount: ragflowDocIds.length,
      intervalMs,
    });

    // Run the first poll immediately (async, non-blocking)
    this.poll(versionId, serverId, datasetId, ragflowDocIds).catch((err) => {
      log.warn("Parser poll (initial) failed", {
        versionId,
        error: (err as Error).message,
      });
    });

    // Schedule recurring polls
    const timer = setInterval(() => {
      this.poll(versionId, serverId, datasetId, ragflowDocIds).catch((err) => {
        log.warn("Parser poll failed", {
          versionId,
          error: (err as Error).message,
        });
      });
    }, intervalMs);

    this.sessions.set(versionId, {
      timer,
      serverId,
      datasetId,
      ragflowDocIds,
      startedAt: new Date().toISOString(),
    });
  }

  /**
   * Stop background polling for a version.
   * @param versionId - Version UUID
   */
  stopPolling(versionId: string): void {
    const session = this.sessions.get(versionId);
    if (!session) return;
    clearInterval(session.timer);
    this.sessions.delete(versionId);
    log.info("Parser poller stopped", { versionId });
  }

  /**
   * Check if polling is currently active for a version.
   * @param versionId - Version UUID
   * @returns True if a polling session is running
   */
  isPolling(versionId: string): boolean {
    return this.sessions.has(versionId);
  }

  // --------------------------------------------------------------------------
  // Internal
  // --------------------------------------------------------------------------

  /**
   * Fetch live parser status from RAGFlow and update local converter tracking.
   * Stops polling automatically when all watched docs reach DONE/FAIL or
   * the session has exceeded MAX_POLLING_DURATION_MS.
   *
   * @param versionId - Version UUID
   * @param serverId - RAGFlow server UUID
   * @param datasetId - RAGFlow dataset ID
   * @param ragflowDocIds - Array of RAGFlow document IDs to watch
   */
  private async poll(
    versionId: string,
    serverId: string,
    datasetId: string,
    ragflowDocIds: string[],
  ): Promise<void> {
    const session = this.sessions.get(versionId);

    // Check max duration — auto-stop after 24 hrs
    if (session) {
      const elapsed = Date.now() - new Date(session.startedAt).getTime();
      if (elapsed > MAX_POLLING_DURATION_MS) {
        log.warn("Parser poller exceeded max duration — stopping", {
          versionId,
        });
        this.stopPolling(versionId);
        return;
      }
    }

    // Fetch all docs from the RAGFlow dataset
    const ragflowDocs: any[] = [];
    let page = 1;
    const pageSize = 100;
    while (true) {
      const batch = await ragflowProxyService.listDocuments(
        serverId,
        datasetId,
        {
          page,
          page_size: pageSize,
        },
      );
      if (!batch || batch.length === 0) break;
      ragflowDocs.push(...batch);
      if (batch.length < pageSize) break;
      page++;
      if (ragflowDocs.length >= 2000) break; // safety cap
    }

    // Build ragflowDocId → doc map for quick lookup
    const ragflowDocMap: Record<string, any> = {};
    for (const doc of ragflowDocs) {
      if (doc.id) ragflowDocMap[doc.id] = doc;
    }

    // Track whether all watched docs are done
    let allTerminal = true;
    const watchedSet = new Set(ragflowDocIds);

    for (const docId of ragflowDocIds) {
      const doc = ragflowDocMap[docId];
      if (!doc) {
        // Doc not found in RAGFlow — maybe deleted; skip
        continue;
      }

      const ragflowRun: string = doc.run ?? "UNSTART";
      const isTerminal = TERMINAL_STATUSES.has(ragflowRun);
      if (!isTerminal) allTerminal = false;

      // Try to update the file tracking record if run status has changed
      try {
        await this.updateFileTrackingByRagflowId(
          versionId,
          docId,
          ragflowRun,
          doc.progress ?? 0,
          doc.progress_msg ?? "",
          doc.chunk_num ?? doc.chunk_count ?? 0,
        );
      } catch (err) {
        log.debug("Could not update file tracking for ragflowDocId", {
          docId,
          error: (err as Error).message,
        });
      }
    }

    log.debug("Parser poll completed", {
      versionId,
      watchedDocs: watchedSet.size,
      ragflowDocsFound: ragflowDocs.length,
      allTerminal,
    });

    // Auto-stop when all watched docs have finished
    if (allTerminal) {
      log.info("Parser poller: all documents reached terminal state", {
        versionId,
      });
      this.stopPolling(versionId);
    }
  }

  /**
   * Find the FileTracking record for a ragflowDocId within a version and
   * update its metadata fields to reflect live RAGFlow parser status.
   *
   * @param versionId - Version UUID (used to find correct job)
   * @param ragflowDocId - RAGFlow document ID
   * @param ragflowRun - RAGFlow `run` status string (UNSTART / RUNNING / DONE / FAIL)
   * @param progress - Parsing progress as decimal 0–1
   * @param progressMsg - Human-readable progress message
   * @param chunkCount - Number of chunks created so far
   */
  private async updateFileTrackingByRagflowId(
    versionId: string,
    ragflowDocId: string,
    ragflowRun: string,
    progress: number,
    progressMsg: string,
    chunkCount: number,
  ): Promise<void> {
    // Load all version jobs to find files with this ragflowDocId
    const { jobs } = await converterQueueService.listVersionJobs({
      versionId,
      page: 1,
      pageSize: 1000,
    });

    for (const job of jobs) {
      const files = await converterQueueService.getJobFiles(job.id);
      for (const file of files) {
        if (file.ragflowDocId !== ragflowDocId) continue;

        // Update extra metadata stored in the file hash
        // We store ragflow_run / ragflow_progress / ragflow_chunk_count
        // in updateFileStatus via the `data` param (added to hash as-is)
        await converterQueueService.updateFileParserStatus(file.id, {
          ragflowRun,
          ragflowProgress: String(progress),
          ragflowProgressMsg: progressMsg,
          ragflowChunkCount: String(chunkCount),
        });
        return; // done — each ragflowDocId is unique
      }
    }
  }
}

/** Exported singleton instance */
export const parserPollerService = ParserPollerService.getSharedInstance();
