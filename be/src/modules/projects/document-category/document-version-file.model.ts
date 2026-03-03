/**
 * DocumentVersionFileModel: manages durable per-file records for document versions.
 *
 * Records are written to Postgres when a converter job finishes (success or fail).
 * This provides long-term storage of ragflow_doc_id for parse/delete operations,
 * surviving Redis flushes or key expiry.
 *
 * Implements Factory Pattern and Singleton Pattern per coding guidelines.
 */
import { BaseModel } from "@/shared/models/base.model.js";
import { db } from "@/shared/db/knex.js";
import { DocumentVersionFile } from "@/shared/models/types.js";

/**
 * DocumentVersionFileModel
 * CRUD operations for document_category_version_files records.
 * @extends BaseModel<DocumentVersionFile>
 */
export class DocumentVersionFileModel extends BaseModel<DocumentVersionFile> {
  /** Database table name */
  protected tableName = "document_category_version_files";
  /** Shared Knex database instance */
  protected knex = db;

  /**
   * Find all file records for a version.
   * @param versionId - Version UUID
   * @returns Array of file records
   */
  async findByVersion(versionId: string): Promise<DocumentVersionFile[]> {
    return this.knex(this.tableName)
      .where({ version_id: versionId })
      .orderBy("created_at", "asc");
  }

  /**
   * Find a single file record by version and filename.
   * @param versionId - Version UUID
   * @param fileName - Original filename
   * @returns File record or undefined
   */
  async findByVersionAndFileName(
    versionId: string,
    fileName: string,
  ): Promise<DocumentVersionFile | undefined> {
    return this.knex(this.tableName)
      .where({ version_id: versionId, file_name: fileName })
      .first();
  }

  /**
   * Upsert a file record by (version_id, file_name).
   * Inserts on first call; updates on subsequent calls (e.g. when ragflow_doc_id arrives).
   * Uses Postgres ON CONFLICT for atomic upsert.
   *
   * @param versionId - Version UUID
   * @param fileName - Original filename
   * @param data - Fields to set/update
   * @returns Upserted record
   */
  async upsertByVersionAndFileName(
    versionId: string,
    fileName: string,
    data: {
      ragflow_doc_id?: string | null;
      status?: string;
      error?: string | null;
    },
  ): Promise<DocumentVersionFile> {
    const now = new Date();

    // Insert or update on unique (version_id, file_name) conflict
    await this.knex(this.tableName)
      .insert({
        version_id: versionId,
        file_name: fileName,
        ragflow_doc_id: data.ragflow_doc_id ?? null,
        status: data.status ?? "pending",
        error: data.error ?? null,
        created_at: now,
        updated_at: now,
      })
      .onConflict(["version_id", "file_name"])
      .merge({
        ragflow_doc_id: data.ragflow_doc_id ?? null,
        status: data.status ?? "pending",
        error: data.error ?? null,
        updated_at: now,
      });

    // Return the upserted record
    const record = await this.findByVersionAndFileName(versionId, fileName);
    if (!record) throw new Error(`Failed to upsert file record: ${fileName}`);
    return record;
  }

  /**
   * Bulk upsert multiple file records for a version in a single transaction.
   * Used when archiving a completed job from Redis to Postgres.
   *
   * @param records - Array of file records to upsert
   */
  async bulkUpsert(
    records: Array<{
      versionId: string;
      fileName: string;
      ragflowDocId?: string | null;
      status: string;
      error?: string | null;
    }>,
  ): Promise<void> {
    if (records.length === 0) return;
    const now = new Date();

    // Batch upsert within a transaction for atomicity
    await this.knex.transaction(async (trx) => {
      for (const r of records) {
        await trx(this.tableName)
          .insert({
            version_id: r.versionId,
            file_name: r.fileName,
            ragflow_doc_id: r.ragflowDocId ?? null,
            status: r.status,
            error: r.error ?? null,
            created_at: now,
            updated_at: now,
          })
          .onConflict(["version_id", "file_name"])
          .merge({
            ragflow_doc_id: r.ragflowDocId ?? null,
            status: r.status,
            error: r.error ?? null,
            updated_at: now,
          });
      }
    });
  }
}
