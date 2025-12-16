/**
 * @fileoverview MinIO bucket model definitions.
 *
 * This module defines TypeScript interfaces for MinIO bucket
 * metadata stored in the database. Bucket configurations are
 * stored in database to manage which MinIO buckets are accessible.
 *
 * @module models/minio-bucket
 */

/**
 * Represents a MinIO bucket configuration from the database.
 * Contains metadata about buckets that are managed through the application.
 */
export interface MinioBucket {
  /** Unique identifier (UUID) */
  id: string;
  /** MinIO bucket name (must follow S3 naming conventions) */
  bucket_name: string;
  /** Human-readable display name for UI */
  display_name: string;
  /** Optional description of bucket purpose */
  description?: string;
  /** User ID who created this configuration */
  created_by: string;
  /** Creation timestamp (ISO string) */
  created_at: string;
  /** Whether bucket configuration is active (soft delete flag) */
  is_active: boolean | number;
}

/**
 * Data transfer object for adding a new MinIO bucket configuration.
 * Used as request body type for POST /api/minio/buckets.
 */
export interface CreateMinioBucketDto {
  /** MinIO bucket name (3-63 chars, lowercase, alphanumeric/hyphens/dots) - must exist in MinIO */
  bucket_name: string;
  /** Human-readable display name */
  display_name: string;
  /** Optional description */
  description?: string;
}
