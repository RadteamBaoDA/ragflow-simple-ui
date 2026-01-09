/**
 * @fileoverview Shared types for storage providers.
 * @module services/storage/types
 */

import { Readable } from 'stream';

/**
 * @description Represents a storage bucket.
 */
export interface BucketInfo {
    /** Bucket name */
    name: string;
    /** Bucket creation date */
    creationDate: Date;
}

/**
 * @description File or folder object in storage.
 */
export interface FileObject {
    /** Object name/path */
    name: string;
    /** File size in bytes */
    size: number;
    /** Last modified timestamp */
    lastModified: Date;
    /** Object ETag (hash) */
    etag: string;
    /** Whether this is a folder */
    isFolder: boolean;
    /** Full path prefix for folders */
    prefix?: string;
}

/**
 * @description Statistics for a single bucket.
 */
export interface BucketStats {
    /** Number of objects in bucket */
    objectCount: number;
    /** Total size in bytes */
    totalSize: number;
}

/**
 * @description Global storage statistics.
 */
export interface GlobalStats {
    /** Total number of buckets */
    totalBuckets: number;
    /** Total number of objects */
    totalObjects: number;
    /** Total size in bytes */
    totalSize: number;
    /** Size distribution by range */
    distribution: Record<string, number>;
    /** Top buckets by size */
    topBuckets: { name: string; size: number; objectCount: number }[];
    /** Top files by size */
    topFiles: { name: string; size: number; lastModified: Date; bucketName: string }[];
}

/**
 * @description User context for audit logging.
 */
export interface UserContext {
    id: string;
    email: string;
    ip?: string;
}

/**
 * @description File upload input.
 */
export interface UploadFile {
    /** Original file name */
    originalname?: string;
    /** MIME type */
    mimetype?: string;
    /** File buffer */
    buffer?: Buffer;
    /** File path (for disk uploads) */
    path?: string;
    /** File size */
    size?: number;
}
