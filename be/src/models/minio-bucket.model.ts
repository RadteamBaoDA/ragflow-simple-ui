
/**
 * Managed MinIO bucket model: tracks application-owned buckets with metadata.
 */
import { BaseModel } from '@/models/base.model.js'
import { db } from '@/db/knex.js'
import { MinioBucket } from '@/models/types.js'

/**
 * MinioBucketModel
 * Tracks application-owned MinIO buckets with metadata.
 * Extends BaseModel with custom queries for bucket lookups.
 */
export class MinioBucketModel extends BaseModel<MinioBucket> {
  /** Database table name */
  protected tableName = 'minio_buckets'
  /** Shared Knex database instance */
  protected knex = db

  /**
   * Find a bucket by its MinIO bucket name.
   * @param bucketName - The actual MinIO bucket name
   * @returns Promise<MinioBucket | undefined> - Bucket metadata if found, undefined otherwise
   * @description Queries the database for a record matching the exact bucket name.
   */
  async findByName(bucketName: string): Promise<MinioBucket | undefined> {
    // Query by bucket_name column (MinIO bucket name)
    return this.knex(this.tableName).where({ bucket_name: bucketName }).first()
  }

  /**
   * Find multiple buckets by their database IDs.
   * Returns buckets sorted by creation date (newest first).
   * @param ids - Array of bucket UUIDs to look up
   * @returns Promise<MinioBucket[]> - Array of matching bucket metadata records
   * @description Filters buckets by a list of IDs and sorts them by creation date.
   */
  async findByIds(ids: string[]): Promise<MinioBucket[]> {
    // Query using IN clause and sort by creation date descending
    return this.knex(this.tableName).whereIn('id', ids).orderBy('created_at', 'desc')
  }
}

/**
 * Data Transfer Object for creating new MinIO buckets.
 * Used to validate and transport bucket creation data.
 */
export class CreateMinioBucketDto {
  /** Required bucket name */
  name: string
  /** Optional human-readable description */
  description?: string | undefined // Align with exactOptionalPropertyTypes

  /**
   * Constructor to initialize DTO values.
   * @param name - Bucket name (required)
   * @param description - Optional description
   * @description Initializes a new DTO instance.
   */
  constructor(name: string, description?: string) {
    this.name = name
    this.description = description
  }
}
