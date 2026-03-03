/**
 * @fileoverview Converter API Service — client-side functions for the converter module.
 *
 * Provides TypeScript types and API functions for version-level conversion jobs
 * and per-file tracking. Communicates with the backend converter REST endpoints.
 *
 * @module features/system/api/converterService
 */
import { api } from "@/lib/api";

// ============================================================================
// Types
// ============================================================================

/** Possible statuses for a version job or file tracking record */
export type ConversionJobStatus =
  | "pending"
  | "waiting"
  | "converting"
  | "finished"
  | "failed";

/**
 * A version-level conversion job.
 * @description One job per version — covers all files uploaded to that version.
 */
export interface VersionJob {
  /** Unique job identifier */
  id: string;
  /** Project ID */
  projectId: string;
  /** Category ID */
  categoryId: string;
  /** Version ID */
  versionId: string;
  /** RAGFlow server ID */
  serverId: string;
  /** RAGFlow dataset ID */
  datasetId: string;
  /** Overall job status */
  status: ConversionJobStatus;
  /** Converter config JSON blob */
  config?: string;
  /** Total number of files in this job */
  fileCount: number;
  /** Number of finished files */
  finishedCount: number;
  /** Number of failed files */
  failedCount: number;
  /** ISO timestamp of job creation */
  createdAt: string;
  /** ISO timestamp of last update */
  updatedAt: string;
}

/**
 * Per-file tracking record within a version job.
 */
export interface FileTrackingRecord {
  /** Unique file tracking ID */
  id: string;
  /** Parent version job ID */
  jobId: string;
  /** Version ID */
  versionId: string;
  /** Original file name */
  fileName: string;
  /** Local disk path */
  filePath: string;
  /** File conversion status */
  status: ConversionJobStatus;
  /** Path to converted PDF */
  pdfPath?: string;
  /** Error message if failed */
  error?: string;
  /** ISO timestamp of creation */
  createdAt: string;
  /** ISO timestamp of last update */
  updatedAt: string;
}

/**
 * Aggregate statistics for the conversion queue.
 */
export interface QueueStats {
  /** Pending version jobs */
  pending: number;
  /** Waiting version jobs */
  waiting: number;
  /** Converting version jobs */
  converting: number;
  /** Finished version jobs */
  finished: number;
  /** Failed version jobs */
  failed: number;
  /** Total count */
  total: number;
}

/**
 * Converter schedule configuration.
 */
export interface ConverterScheduleConfig {
  /** Start hour (0-23) */
  startHour: number;
  /** End hour (0-23) */
  endHour: number;
  /** IANA timezone string */
  timezone: string;
  /** Whether scheduled conversion is enabled */
  enabled: boolean;
}

/**
 * Filters for listing version jobs.
 */
export interface JobListFilter {
  /** Filter by status */
  status?: ConversionJobStatus | undefined;
  /** Filter by project ID */
  projectId?: string | undefined;
  /** Filter by category ID */
  categoryId?: string | undefined;
  /** Filter by version ID */
  versionId?: string | undefined;
  /** Page number (1-based) */
  page?: number | undefined;
  /** Items per page */
  pageSize?: number | undefined;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Build query string from filter params.
 * @param params - Filter params object
 * @returns URL query string including leading '?'
 */
function toQueryString(params?: Record<string, unknown>): string {
  if (!params) return "";
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null,
  );
  if (entries.length === 0) return "";
  return (
    "?" +
    entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&")
  );
}

/**
 * Get aggregate queue statistics.
 * @returns Queue stats with counts by status
 */
export async function getConverterStats(): Promise<QueueStats> {
  return api.get<QueueStats>("/api/converter/stats");
}

/**
 * List version-level conversion jobs with optional filters.
 * @param filters - Optional filters and pagination
 * @returns Paginated list of version jobs
 */
export async function getConverterJobs(
  filters?: JobListFilter,
): Promise<{ jobs: VersionJob[]; total: number }> {
  const qs = toQueryString(filters as Record<string, unknown>);
  return api.get<{ jobs: VersionJob[]; total: number }>(
    `/api/converter/jobs${qs}`,
  );
}

/**
 * Get a single version job by ID.
 * @param jobId - Version job UUID
 * @returns Version job details
 */
export async function getConverterJobStatus(
  jobId: string,
): Promise<VersionJob> {
  return api.get<VersionJob>(`/api/converter/jobs/${jobId}`);
}

/**
 * Get file tracking records for a version job.
 * @param jobId - Version job UUID
 * @returns File tracking records
 */
export async function getVersionJobFiles(
  jobId: string,
): Promise<{ files: FileTrackingRecord[]; total: number }> {
  return api.get<{ files: FileTrackingRecord[]; total: number }>(
    `/api/converter/jobs/${jobId}/files`,
  );
}

/**
 * Get the current converter schedule config.
 * @returns Schedule configuration
 */
export async function getConverterConfig(): Promise<ConverterScheduleConfig> {
  return api.get<ConverterScheduleConfig>("/api/converter/config");
}

/**
 * Update the converter schedule config.
 * @param config - Partial config to update
 * @returns Updated schedule configuration
 */
export async function updateConverterConfig(
  config: Partial<ConverterScheduleConfig>,
): Promise<ConverterScheduleConfig> {
  return api.put<ConverterScheduleConfig>("/api/converter/config", config);
}

/**
 * Trigger manual conversion (start processing now).
 * @returns Trigger result message
 */
export async function triggerManualConversion(): Promise<{ message: string }> {
  return api.post<{ message: string }>("/api/converter/start");
}

/**
 * Upload completed conversions to RAGFlow.
 * @returns Upload results per version
 */
export async function uploadCompleted(): Promise<{
  message: string;
  results: Array<{
    jobId: string;
    versionId: string;
    totalFiles: number;
    uploaded: number;
    failed: number;
    errors: string[];
  }>;
}> {
  return api.post("/api/converter/upload");
}

/**
 * Trigger RAGFlow parsing for uploaded documents in a version.
 * Calls POST /api/projects/:projectId/categories/:categoryId/versions/:versionId/documents/parse
 *
 * @param projectId - Project UUID
 * @param categoryId - Category UUID
 * @param versionId - Version UUID
 * @param fileNames - List of file names to parse (all finished files)
 * @returns Parse result with count of triggered files
 */
export async function parseVersionDocuments(
  projectId: string,
  categoryId: string,
  versionId: string,
  fileNames: string[],
): Promise<{
  message: string;
  triggered: number;
  skipped: number;
  errors: string[];
}> {
  return api.post(
    `/api/projects/${projectId}/categories/${categoryId}/versions/${versionId}/documents/parse`,
    { fileNames },
  );
}

/**
 * Force-clear all stuck converter queue data from Redis.
 * Calls POST /api/converter/clear-queue.
 *
 * @returns Number of Redis keys deleted and a status message
 */
export async function clearConverterQueue(): Promise<{
  message: string;
  deleted: number;
}> {
  return api.post("/api/converter/clear-queue");
}
