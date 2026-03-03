/**
 * @fileoverview ConverterVersionJobModel — Postgres model for archived converter jobs.
 *
 * Active (pending/converting) jobs live in Redis.
 * Finished/failed jobs are archived here for long-term history.
 *
 * Implements Factory Pattern and Singleton Pattern per coding guidelines.
 * @module modules/converter/converter-version-job.model
 */
import { BaseModel } from "@/shared/models/base.model.js";
import { db } from "@/shared/db/knex.js";
import type { ConverterVersionJob } from "@/shared/models/types.js";

/** Valid terminal statuses stored in Postgres */
type TerminalStatus = "finished" | "failed";

/**
 * ConverterVersionJobModel
 * CRUD for the converter_version_jobs table.
 * @extends BaseModel<ConverterVersionJob>
 */
export class ConverterVersionJobModel extends BaseModel<ConverterVersionJob> {
  /** Database table name */
  protected tableName = "converter_version_jobs";
  /** Shared Knex instance */
  protected knex = db;

  /**
   * Upsert a converter job record.
   * Uses Postgres ON CONFLICT(id) to safely re-archive if called twice.
   *
   * @param job - Job data to insert or update
   */
  async upsert(job: {
    id: string;
    projectId: string;
    categoryId: string;
    versionId: string;
    serverId: string;
    datasetId: string;
    status: TerminalStatus;
    fileCount: number;
    finishedCount: number;
    failedCount: number;
    jobCreatedAt: Date;
    jobUpdatedAt: Date;
  }): Promise<void> {
    const now = new Date();

    // Insert and update on PK conflict to make archiving idempotent
    await this.knex(this.tableName)
      .insert({
        id: job.id,
        project_id: job.projectId,
        category_id: job.categoryId,
        version_id: job.versionId,
        server_id: job.serverId,
        dataset_id: job.datasetId,
        status: job.status,
        file_count: job.fileCount,
        finished_count: job.finishedCount,
        failed_count: job.failedCount,
        job_created_at: job.jobCreatedAt,
        job_updated_at: job.jobUpdatedAt,
        archived_at: now,
      })
      .onConflict("id")
      .merge({
        status: job.status,
        file_count: job.fileCount,
        finished_count: job.finishedCount,
        failed_count: job.failedCount,
        job_updated_at: job.jobUpdatedAt,
        archived_at: now,
      });
  }

  /**
   * Count jobs by status for dashboard statistics.
   * @returns Object with finished and failed counts
   */
  async countByStatus(): Promise<{ finished: number; failed: number }> {
    const rows = (await this.knex(this.tableName)
      .select("status")
      .count("* as count")
      .groupBy("status")) as { status: string; count: string }[];

    let finished = 0;
    let failed = 0;
    for (const row of rows) {
      if (row.status === "finished") finished = parseInt(row.count, 10);
      if (row.status === "failed") failed = parseInt(row.count, 10);
    }
    return { finished, failed };
  }

  /**
   * List archived jobs with optional filters and pagination.
   *
   * @param opts - Filter + pagination options
   * @returns { jobs, total }
   */
  async listWithFilters(opts: {
    status?: "finished" | "failed";
    projectId?: string;
    categoryId?: string;
    versionId?: string;
    page: number;
    pageSize: number;
  }): Promise<{ jobs: ConverterVersionJob[]; total: number }> {
    const query = this.knex(this.tableName);

    // Apply optional filters
    if (opts.status) query.where("status", opts.status);
    if (opts.projectId) query.where("project_id", opts.projectId);
    if (opts.categoryId) query.where("category_id", opts.categoryId);
    if (opts.versionId) query.where("version_id", opts.versionId);

    // Count total matching rows
    const countRows = (await query.clone().count("* as count")) as {
      count: string;
    }[];
    const total = parseInt(countRows[0]?.count ?? "0", 10);

    // Fetch page
    const rows = await query
      .clone()
      .orderBy("archived_at", "desc")
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize);

    return { jobs: rows, total };
  }

  /**
   * Find a single archived job by its ID.
   * @param id - Job UUID
   */
  async findById(id: string): Promise<ConverterVersionJob | undefined> {
    return this.knex(this.tableName).where({ id }).first();
  }

  /**
   * Find archived file records for a version job (delegated to files table).
   * @param versionId - Version ID linked to the job
   */
  async findFilesByVersionId(versionId: string): Promise<
    {
      fileName: string;
      status: string;
      ragflowDocId?: string;
      error?: string;
    }[]
  > {
    return this.knex("document_category_version_files")
      .where("version_id", versionId)
      .select(
        "file_name as fileName",
        "status",
        "ragflow_doc_id as ragflowDocId",
        "error",
      );
  }
}
