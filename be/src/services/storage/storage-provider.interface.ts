/**
 * @fileoverview Storage provider interface for multi-cloud abstraction.
 * @module services/storage/storage-provider.interface
 */

import { Readable } from 'stream';
import {
    BucketInfo,
    FileObject,
    BucketStats,
    GlobalStats,
    UserContext,
    UploadFile
} from './types.js';

/**
 * @description Abstract interface for storage providers.
 * Implementations exist for MinIO, AWS S3, Azure Blob, GCP Storage, etc.
 */
export interface StorageProvider {
    // =========================================================================
    // Bucket Operations
    // =========================================================================

    /**
     * List all buckets.
     * @returns Promise<BucketInfo[]> - Array of buckets.
     */
    listBuckets(): Promise<BucketInfo[]>;

    /**
     * Check if a bucket exists.
     * @param name - Bucket name.
     * @returns Promise<boolean>
     */
    bucketExists(name: string): Promise<boolean>;

    /**
     * Create a new bucket.
     * @param name - Bucket name.
     * @param user - Optional user context for audit.
     */
    createBucket(name: string, user?: UserContext): Promise<void>;

    /**
     * Delete a bucket.
     * @param name - Bucket name.
     * @param user - Optional user context for audit.
     */
    deleteBucket(name: string, user?: UserContext): Promise<void>;

    /**
     * Get statistics for a bucket.
     * @param name - Bucket name.
     * @returns Promise<BucketStats>
     */
    getBucketStats(name: string): Promise<BucketStats>;

    // =========================================================================
    // Object Operations
    // =========================================================================

    /**
     * List objects in a bucket.
     * @param bucket - Bucket name.
     * @param prefix - Optional path prefix.
     * @param recursive - Whether to list recursively.
     * @returns Promise<FileObject[]>
     */
    listObjects(bucket: string, prefix?: string, recursive?: boolean): Promise<FileObject[]>;

    /**
     * Convenience wrapper to list files (non-recursive).
     * @param bucket - Bucket name.
     * @param prefix - Optional path prefix.
     * @returns Promise<FileObject[]>
     */
    listFiles(bucket: string, prefix?: string): Promise<FileObject[]>;

    /**
     * Upload a file to a bucket.
     * @param bucket - Bucket name.
     * @param file - File to upload.
     * @returns Promise<any>
     */
    uploadFile(bucket: string, file: UploadFile): Promise<any>;

    /**
     * Get a file stream for download.
     * @param bucket - Bucket name.
     * @param objectName - Object path.
     * @returns Promise<Readable>
     */
    getFileStream(bucket: string, objectName: string): Promise<Readable>;

    /**
     * Delete a single object.
     * @param bucket - Bucket name.
     * @param objectName - Object path.
     */
    deleteObject(bucket: string, objectName: string): Promise<void>;

    /**
     * Alias for deleteObject.
     * @param bucket - Bucket name.
     * @param fileName - File path.
     * @param userId - Optional user ID (unused).
     */
    deleteFile(bucket: string, fileName: string, userId?: string): Promise<void>;

    /**
     * Delete multiple objects.
     * @param bucket - Bucket name.
     * @param objectNames - Array of object paths.
     */
    deleteObjects(bucket: string, objectNames: string[]): Promise<void>;

    /**
     * Check if a file exists.
     * @param bucket - Bucket name.
     * @param objectName - Object path.
     * @returns Promise<boolean>
     */
    checkFileExists(bucket: string, objectName: string): Promise<boolean>;

    // =========================================================================
    // Folder Operations
    // =========================================================================

    /**
     * Create a folder (placeholder object).
     * @param bucket - Bucket name.
     * @param folderPath - Folder path.
     */
    createFolder(bucket: string, folderPath: string): Promise<void>;

    /**
     * Delete a folder and all its contents.
     * @param bucket - Bucket name.
     * @param folderPath - Folder path.
     */
    deleteFolder(bucket: string, folderPath: string): Promise<void>;

    // =========================================================================
    // URL Generation
    // =========================================================================

    /**
     * Generate a presigned URL for download.
     * @param bucket - Bucket name.
     * @param objectName - Object path.
     * @param expiry - Expiry in seconds (default 3600).
     * @param disposition - Content-Disposition header value.
     * @returns Promise<string>
     */
    getPresignedUrl(bucket: string, objectName: string, expiry?: number, disposition?: string): Promise<string>;

    /**
     * Alias for getPresignedUrl.
     */
    getDownloadUrl(bucket: string, objectName: string, expiry?: number, disposition?: string): Promise<string>;

    // =========================================================================
    // Statistics
    // =========================================================================

    /**
     * Get global storage statistics across all buckets.
     * @returns Promise<GlobalStats>
     */
    getGlobalStats(): Promise<GlobalStats>;

    /**
     * Get object metadata.
     * @param bucket - Bucket name.
     * @param objectName - Object path.
     * @returns Promise<any>
     */
    /**
     * Get object metadata.
     * @param bucket - Bucket name.
     * @param objectName - Object path.
     * @returns Promise<any>
     */
    getObjectStat(bucket: string, objectName: string): Promise<any>;

    // =========================================================================
    // Admin / Access Token Operations
    // =========================================================================

    /**
     * List access keys (service accounts).
     * @returns Promise<any[]>
     */
    listAccessKeys(): Promise<any[]>;

    /**
     * Create a new access key.
     * @param policy - IAM policy.
     * @param name - Optional name.
     * @param description - Optional description.
     * @returns Promise<any>
     */
    createAccessKey(policy: string, name?: string, description?: string): Promise<any>;

    /**
     * Delete an access key.
     * @param accessKey - Key ID.
     */
    deleteAccessKey(accessKey: string): Promise<void>;
}
