/**
 * @fileoverview MinIO object storage service.
 * 
 * This module provides integration with MinIO for file storage operations.
 * MinIO is an S3-compatible object storage system used for:
 * - Document and file uploads
 * - Organized storage with buckets and folders
 * - Presigned URLs for secure file downloads
 * 
 * Features:
 * - Bucket management (create, delete, list)
 * - File operations (upload, download, delete)
 * - Folder simulation (MinIO uses flat object keys)
 * - Batch operations for efficiency
 * - Presigned URL generation for secure sharing
 * 
 * @module services/minio
 * @see https://min.io/docs/minio/linux/developers/javascript/minio-javascript.html
 */

import * as Minio from 'minio';
import { Readable } from 'stream';
import * as http from 'http';
import * as https from 'https';
import * as crypto from 'crypto';
import { log } from './logger.service.js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * MinIO connection configuration.
 */
interface MinioConfig {
    /** MinIO server hostname or IP */
    endPoint: string;
    /** MinIO server port (default: 9000) */
    port: number;
    /** Use SSL/TLS for connections */
    useSSL: boolean;
    /** MinIO access key (username) */
    accessKey: string;
    /** MinIO secret key (password) */
    secretKey: string;
    /** Public endpoint for download URLs (optional) */
    publicEndPoint?: string;
}


/**
 * Represents a Service Account (Access Key).
 */
export interface ServiceAccount {
    accessKey: string;
    parentUser: string;
    accountStatus: string;
    description?: string;
    name?: string;
    expiration?: string;
}

/**
 * Represents a file or folder in MinIO storage.
 */
interface FileObject {
    /** Object name (filename or folder name) */
    name: string;
    /** Object size in bytes */
    size: number;
    /** Last modification timestamp */
    lastModified: Date;
    /** Object ETag for change detection */
    etag: string;
    /** Whether this is a folder (virtual directory) */
    isFolder: boolean;
    /** Full prefix path (for folders) */
    prefix?: string;
}

// ============================================================================
// MINIO SERVICE CLASS
// ============================================================================

/**
 * MinIO storage service class.
 * Provides high-level methods for interacting with MinIO object storage.
 * 
 * The service is initialized as a singleton and automatically configured
 * from environment variables on import.
 * 
 * @example
 * import { minioService } from './services/minio.service.js';
 * 
 * // Create a bucket
 * await minioService.createBucket('my-bucket');
 * 
 * // Upload a file
 * await minioService.uploadFile('my-bucket', 'docs/file.pdf', buffer, size);
 * 
 * // Get download URL
 * const url = await minioService.getDownloadUrl('my-bucket', 'docs/file.pdf');
 */
class MinioService {
    /** MinIO client instance (null if not configured) */
    private client: Minio.Client | null = null;
    /** Configuration loaded from environment */
    private config: MinioConfig;

    /**
     * Creates a new MinIO service instance.
     * Configuration is loaded from environment variables.
     */
    constructor() {
        // Load configuration from environment variables
        this.config = {
            endPoint: process.env.MINIO_ENDPOINT || 'localhost',
            port: parseInt(process.env.MINIO_PORT || '9000'),
            useSSL: process.env.MINIO_USE_SSL === 'true',
            accessKey: process.env.MINIO_ACCESS_KEY || '',
            secretKey: process.env.MINIO_SECRET_KEY || '',
            ...(process.env.MINIO_PUBLIC_ENDPOINT ? { publicEndPoint: process.env.MINIO_PUBLIC_ENDPOINT } : {}),
        };

        this.initialize();
    }

    /**
     * Initialize the MinIO client connection.
     * If credentials are not configured, storage features will be disabled.
     */
    private initialize(): void {
        try {
            // Skip initialization if credentials are missing
            if (!this.config.accessKey || !this.config.secretKey) {
                log.warn('MinIO credentials not configured. Storage features will be disabled.');
                return;
            }

            // Create MinIO client with configured settings
            this.client = new Minio.Client({
                endPoint: this.config.endPoint,
                port: this.config.port,
                useSSL: this.config.useSSL,
                accessKey: this.config.accessKey,
                secretKey: this.config.secretKey,
            });

            log.info('MinIO client initialized', {
                endPoint: this.config.endPoint,
                port: this.config.port,
                useSSL: this.config.useSSL,
            });
        } catch (error) {
            log.error('Failed to initialize MinIO client', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Generic helper for MinIO Admin API requests using native http/https with AWS SigV4.
     * Note: minio-js SDK does not support Admin API, so we use direct HTTP requests.
     */
    private async adminRequest(method: string, path: string, query: any = {}, body: any = null): Promise<any> {
        if (!this.config) throw new Error('MinIO config not initialized');

        return new Promise((resolve, reject) => {
            const urlPath = `/${path}`;
            const queryString = Object.keys(query).length > 0
                ? '?' + Object.entries(query).map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`).join('&')
                : '';

            const fullPath = urlPath + queryString;
            const payload = body ? JSON.stringify(body) : '';
            const payloadHash = crypto.createHash('sha256').update(payload).digest('hex');

            const date = new Date();
            const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
            const dateStamp = amzDate.slice(0, 8);
            const host = `${this.config.endPoint}:${this.config.port}`;

            const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
            const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

            const canonicalRequest = [method, urlPath, queryString.replace('?', ''), canonicalHeaders, signedHeaders, payloadHash].join('\n');
            const credentialScope = `${dateStamp}/us-east-1/s3/aws4_request`;
            const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, crypto.createHash('sha256').update(canonicalRequest).digest('hex')].join('\n');

            const kDate = crypto.createHmac('sha256', 'AWS4' + this.config.secretKey).update(dateStamp).digest();
            const kRegion = crypto.createHmac('sha256', kDate).update('us-east-1').digest();
            const kService = crypto.createHmac('sha256', kRegion).update('s3').digest();
            const signingKey = crypto.createHmac('sha256', kService).update('aws4_request').digest();
            const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

            const authHeader = `AWS4-HMAC-SHA256 Credential=${this.config.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

            const reqHeaders: Record<string, string | number> = {
                'Host': host, 'X-Amz-Date': amzDate, 'X-Amz-Content-Sha256': payloadHash, 'Authorization': authHeader
            };
            if (payload) { reqHeaders['Content-Type'] = 'application/json'; reqHeaders['Content-Length'] = Buffer.byteLength(payload); }

            const protocol = this.config.useSSL ? https : http;
            const req = protocol.request({ hostname: this.config.endPoint, port: this.config.port, path: fullPath, method, headers: reqHeaders }, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk.toString(); });
                res.on('end', () => {
                    if (res.statusCode && res.statusCode >= 400) { log.error('Admin API Error', { statusCode: res.statusCode, data }); return reject(new Error(`Admin API Error ${res.statusCode}: ${data}`)); }
                    try { if (!data) return resolve(null); resolve(JSON.parse(data)); } catch { resolve(data); }
                });
            });
            req.on('error', (err) => { log.error('Admin request error', { message: err.message }); reject(err); });
            if (payload) req.write(payload);
            req.end();
        });
    }



    /**
     * Lists all Service Accounts (Access Keys).
     */
    async listServiceAccounts(): Promise<ServiceAccount[]> {
        const result = await this.adminRequest('GET', 'minio/admin/v3/list-service-accounts');
        return result?.accounts || [];
    }

    /**
     * Creates a new Service Account.
     */
    async createServiceAccount(policy: string = 'readwrite', name: string = '', description: string = ''): Promise<any> {
        // Simplified creation with canned policy if supported, otherwise just creates key
        const payload = {
            policy: policy === 'readonly' ? 'readonly' : 'readwrite',
            name,
            description,
            // accessKey, secretKey can be auto-generated
        };
        // Note: 'policy' field in add-service-account might need to be a full policy document 
        // or the API might support canned policy names. 
        // If this fails, we might need to separate policy assignment.
        return this.adminRequest('POST', 'minio/admin/v3/add-service-account', {}, payload);
    }

    /**
     * Deletes a Service Account.
     */
    async deleteServiceAccount(accessKey: string): Promise<void> {
        await this.adminRequest('POST', 'minio/admin/v3/delete-service-account', {}, { accessKey });
    }

    /**
     * Ensure the MinIO client is initialized before operations.
     * @throws Error if client is not initialized
     * @returns MinIO client instance
     */
    private ensureClient(): Minio.Client {
        if (!this.client) {
            throw new Error('MinIO client not initialized. Check configuration.');
        }
        return this.client;
    }

    // ========================================================================
    // BUCKET OPERATIONS
    // ========================================================================

    /**
     * List all buckets in the MinIO server.
     * @returns Array of bucket information
     */
    async listBuckets(): Promise<Minio.BucketItemFromList[]> {
        const client = this.ensureClient();
        try {
            return await client.listBuckets();
        } catch (error) {
            log.error('Failed to list buckets', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
            });
            throw error;
        }
    }

    /**
     * Check if a bucket exists.
     * @param bucketName - Name of the bucket to check
     * @returns True if bucket exists, false otherwise
     */
    async bucketExists(bucketName: string): Promise<boolean> {
        const client = this.ensureClient();
        try {
            return await client.bucketExists(bucketName);
        } catch (error) {
            log.error('Failed to check bucket existence', {
                bucketName,
                error: error instanceof Error ? error.message : String(error),
            });
            return false;
        }
    }

    /**
     * Create a new bucket.
     * @param bucketName - Name for the new bucket (must follow S3 naming rules)
     * @param region - Optional region for the bucket (default: us-east-1)
     * @throws Error if bucket already exists or creation fails
     */
    async createBucket(bucketName: string, region?: string): Promise<void> {
        const client = this.ensureClient();
        try {
            // Check if bucket already exists
            const exists = await client.bucketExists(bucketName);
            if (exists) {
                throw new Error(`Bucket '${bucketName}' already exists`);
            }

            await client.makeBucket(bucketName, region || 'us-east-1');
            log.debug('Bucket created', { bucketName });
        } catch (error) {
            log.error('Failed to create bucket', {
                bucketName,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    /**
     * Delete an empty bucket.
     * @param bucketName - Name of the bucket to delete
     * @throws Error if bucket is not empty or deletion fails
     */
    async deleteBucket(bucketName: string): Promise<void> {
        const client = this.ensureClient();
        try {
            await client.removeBucket(bucketName);
            log.debug('Bucket deleted', { bucketName });
        } catch (error) {
            log.error('Failed to delete bucket', {
                bucketName,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    // ========================================================================
    // OBJECT OPERATIONS
    // ========================================================================

    /**
     * List objects in a bucket with optional prefix filtering.
     * 
     * This method simulates folder navigation by:
     * - Grouping objects by path segments when not recursive
     * - Returning folder entries for directories
     * - Sorting folders before files alphabetically
     * 
     * @param bucketName - Name of the bucket to list
     * @param prefix - Optional prefix to filter objects (e.g., 'docs/')
     * @param recursive - If true, list all nested objects; if false, show folder structure
     * @returns Array of file/folder objects, sorted with folders first
     */
    async listObjects(
        bucketName: string,
        prefix: string = '',
        recursive: boolean = false
    ): Promise<FileObject[]> {
        const client = this.ensureClient();
        const objects: FileObject[] = [];
        const folders = new Set<string>();  // Track folders to avoid duplicates

        try {
            // Stream objects from MinIO using listObjectsV2 with delimiter for proper folder listing
            const stream = client.listObjectsV2(bucketName, prefix, recursive, '');

            for await (const obj of stream) {
                // Handle folder prefixes (virtual directories)
                if (obj.prefix) {
                    const folderName = obj.prefix.slice(prefix.length).replace(/\/$/, '');
                    if (folderName && !folders.has(folderName)) {
                        folders.add(folderName);
                        objects.push({
                            name: folderName,
                            size: 0,
                            lastModified: new Date(),
                            etag: '',
                            isFolder: true,
                            prefix: obj.prefix,
                        });
                    }
                }
                // Handle regular objects (files and folder markers)
                else if (obj.name) {
                    // Check if this is a folder marker (ends with /)
                    if (obj.name.endsWith('/')) {
                        const folderName = obj.name.slice(prefix.length).replace(/\/$/, '');
                        if (folderName && !folders.has(folderName)) {
                            folders.add(folderName);
                            objects.push({
                                name: folderName,
                                size: 0,
                                lastModified: obj.lastModified || new Date(),
                                etag: obj.etag || '',
                                isFolder: true,
                                prefix: obj.name,
                            });
                        }
                    } else {
                        // Regular file
                        const relativePath = obj.name.slice(prefix.length);

                        // If not recursive, check if this file is in a subfolder
                        if (!recursive) {
                            const parts = relativePath.split('/');
                            if (parts.length > 1) {
                                // This file is in a subfolder - add folder entry instead
                                const folderName = parts[0];
                                if (folderName && !folders.has(folderName)) {
                                    folders.add(folderName);
                                    const folderPath = prefix + folderName + '/';
                                    objects.push({
                                        name: folderName,
                                        size: 0,
                                        lastModified: new Date(),
                                        etag: '',
                                        isFolder: true,
                                        prefix: folderPath,
                                    });
                                }
                                continue;  // Skip the file, folder is shown instead
                            }
                        }

                        // Add file entry (only files at current level)
                        if (relativePath && !relativePath.includes('/')) {
                            objects.push({
                                name: relativePath,
                                size: obj.size || 0,
                                lastModified: obj.lastModified || new Date(),
                                etag: obj.etag || '',
                                isFolder: false,
                            });
                        }
                    }
                }
            }

            // Sort: folders first, then alphabetically by name
            return objects.sort((a, b) => {
                if (a.isFolder && !b.isFolder) return -1;
                if (!a.isFolder && b.isFolder) return 1;
                return a.name.localeCompare(b.name);
            });
        } catch (error) {
            log.error('Failed to list objects', {
                bucketName,
                prefix,
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
            });
            throw error;
        }
    }

    /**
     * Upload a file to MinIO.
     * 
     * @param bucketName - Target bucket name
     * @param objectName - Object key (path/filename) in the bucket
     * @param stream - File content as Buffer or Readable stream
     * @param size - File size in bytes
     * @param metadata - Optional metadata (e.g., Content-Type)
     * @returns Object with etag and optional versionId
     */
    async uploadFile(
        bucketName: string,
        objectName: string,
        stream: Buffer | Readable,
        size: number,
        metadata?: Record<string, string>
    ): Promise<{ etag: string; versionId?: string | null }> {
        const client = this.ensureClient();
        try {
            const result = await client.putObject(bucketName, objectName, stream, size, metadata);
            log.debug('File uploaded', { bucketName, objectName, size });
            return result;
        } catch (error) {
            log.error('Failed to upload file', {
                bucketName,
                objectName,
                size,
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
            });
            throw error;
        }
    }

    /**
     * Delete a single object from MinIO.
     * @param bucketName - Bucket containing the object
     * @param objectName - Object key to delete
     */
    async deleteObject(bucketName: string, objectName: string): Promise<void> {
        const client = this.ensureClient();
        try {
            await client.removeObject(bucketName, objectName);
            log.debug('Object deleted', { bucketName, objectName });
        } catch (error) {
            log.error('Failed to delete object', {
                bucketName,
                objectName,
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
            });
            throw error;
        }
    }

    /**
     * Delete multiple objects from MinIO in a single operation.
     * More efficient than calling deleteObject multiple times.
     * 
     * @param bucketName - Bucket containing the objects
     * @param objectNames - Array of object keys to delete
     */
    async deleteObjects(bucketName: string, objectNames: string[]): Promise<void> {
        const client = this.ensureClient();
        try {
            await client.removeObjects(bucketName, objectNames);
            log.debug('Objects deleted', { bucketName, count: objectNames.length });
        } catch (error) {
            log.error('Failed to delete objects', {
                bucketName,
                count: objectNames.length,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    /**
     * Delete a folder and all its contents recursively.
     * 
     * Since MinIO uses flat object keys, this method:
     * 1. Lists all objects with the folder prefix
     * 2. Deletes all found objects in batch
     * 
     * @param bucketName - Bucket containing the folder
     * @param folderPrefix - Folder path (e.g., 'docs/archive/')
     */
    async deleteFolder(bucketName: string, folderPrefix: string): Promise<void> {
        const client = this.ensureClient();
        try {
            // Ensure prefix ends with / for folder semantics
            const prefix = folderPrefix.endsWith('/') ? folderPrefix : folderPrefix + '/';

            // Collect all objects in the folder
            const objects: string[] = [];
            const stream = client.listObjects(bucketName, prefix, true);

            for await (const obj of stream) {
                if (obj.name) {
                    objects.push(obj.name);
                }
            }

            // Delete all objects in batch
            if (objects.length > 0) {
                await client.removeObjects(bucketName, objects);
                log.debug('Folder deleted', { bucketName, folderPrefix, objectCount: objects.length });
            }
        } catch (error) {
            log.error('Failed to delete folder', {
                bucketName,
                folderPrefix,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    /**
     * Create a folder (empty marker object) in MinIO.
     * 
     * MinIO doesn't have true folders, so we create an empty object
     * with a trailing slash to simulate folder creation.
     * 
     * @param bucketName - Target bucket
     * @param folderPath - Folder path to create
     */
    async createFolder(bucketName: string, folderPath: string): Promise<void> {
        const client = this.ensureClient();
        try {
            // Ensure folder path ends with /
            const folderName = folderPath.endsWith('/') ? folderPath : folderPath + '/';
            // Create empty object as folder marker
            await client.putObject(bucketName, folderName, Buffer.from(''), 0);
            log.debug('Folder created', { bucketName, folderPath: folderName });
        } catch (error) {
            log.error('Failed to create folder', {
                bucketName,
                folderPath,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    /**
     * Generate a presigned download URL for an object.
     * 
     * The URL allows temporary, secure access to the object
     * without requiring authentication.
     * 
     * @param bucketName - Bucket containing the object
     * @param objectName - Object key
     * @param expirySeconds - URL validity period in seconds (default: 1 hour)
     * @returns Presigned URL string
     */
    async getDownloadUrl(
        bucketName: string,
        objectName: string,
        expirySeconds: number = 3600,
        disposition?: string
    ): Promise<string> {
        const client = this.ensureClient();
        try {
            const respHeaders: {
                [key: string]: any
            } = {};
            if (disposition) {
                respHeaders['response-content-disposition'] = disposition;
            }

            let url = await client.presignedGetObject(bucketName, objectName, expirySeconds, respHeaders);

            // Replace endpoint with public endpoint if configured
            if (this.config.publicEndPoint) {
                const urlObj = new URL(url);
                const publicUrl = new URL(this.config.publicEndPoint);

                // If public endpoint has a protocol, use it
                if (publicUrl.protocol) {
                    urlObj.protocol = publicUrl.protocol;
                }

                // If public endpoint has a port, use it (or clear it if standard)
                if (publicUrl.port) {
                    urlObj.port = publicUrl.port;
                } else if (publicUrl.protocol === 'https:') {
                    urlObj.port = '';
                }

                urlObj.hostname = publicUrl.hostname;
                url = urlObj.toString();
            }

            log.debug('Generated download URL', { bucketName, objectName, url });
            return url;
        } catch (error) {
            log.error('Failed to generate download URL', {
                bucketName,
                objectName,
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
            });
            throw error;
        }
    }

    /**
     * Get metadata and statistics for an object.
     * 
     * @param bucketName - Bucket containing the object
     * @param objectName - Object key
     * @returns Object statistics (size, etag, content-type, etc.)
     */
    async getObjectStat(bucketName: string, objectName: string): Promise<Minio.BucketItemStat> {
        const client = this.ensureClient();
        try {
            return await client.statObject(bucketName, objectName);
        } catch (error) {
            log.error('Failed to get object stat', {
                bucketName,
                objectName,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    /**
     * Get bucket information with object count, total size, and size distribution.
     *
     * @param bucketName - Name of the bucket
     * @returns Bucket statistics
     */
    async getBucketStats(bucketName: string): Promise<{
        objectCount: number;
        totalSize: number;
        distribution: Record<string, number>;
        topFiles: { name: string; size: number; lastModified: Date; bucketName: string }[];
    }> {
        const client = this.ensureClient();
        try {
            let objectCount = 0;
            let totalSize = 0;
            const distribution: Record<string, number> = {
                '<1MB': 0, '1MB-10MB': 0, '10MB-100MB': 0, '100MB-1GB': 0, '1GB-5GB': 0, '5GB-10GB': 0, '>10GB': 0
            };
            const topFiles: { name: string; size: number; lastModified: Date; bucketName: string }[] = [];

            const stream = client.listObjects(bucketName, '', true);
            for await (const obj of stream) {
                if (obj.name && !obj.name.endsWith('/')) {
                    objectCount++;
                    const size = obj.size || 0;
                    totalSize += size;
                    const sizeMB = size / (1024 * 1024);

                    if (sizeMB < 1) distribution['<1MB']!++;
                    else if (sizeMB < 10) distribution['1MB-10MB']!++;
                    else if (sizeMB < 100) distribution['10MB-100MB']!++;
                    else if (sizeMB < 1024) distribution['100MB-1GB']!++;
                    else if (sizeMB < 5 * 1024) distribution['1GB-5GB']!++;
                    else if (sizeMB < 10 * 1024) distribution['5GB-10GB']!++;
                    else distribution['>10GB']!++;

                    topFiles.push({
                        name: obj.name,
                        size: size,
                        lastModified: obj.lastModified,
                        bucketName: bucketName
                    });
                    if (topFiles.length > 20) {
                        topFiles.sort((a, b) => b.size - a.size);
                        topFiles.length = 20;
                    }
                }
            }
            topFiles.sort((a, b) => b.size - a.size);

            return { objectCount, totalSize, distribution, topFiles };
        } catch (error) {
            log.error('Failed to get bucket stats', {
                bucketName,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
    /**
     * Get the MinIO client instance.
     * @returns Minio.Client or throws if not initialized
     */
    public getClient(): Minio.Client {
        return this.ensureClient();
    }
    /**
     * Check if a file exists in the bucket.
     * @param bucketName - Bucket name
     * @param objectName - Object name
     */
    async checkFileExists(bucketName: string, objectName: string): Promise<boolean> {
        try {
            await this.ensureClient().statObject(bucketName, objectName);
            return true;
        } catch (error: any) {
            if (error.code === 'NotFound') {
                return false;
            }
            throw error;
        }
    }

    /**
     * Get global statistics (total buckets, objects, size, distribution).
     * Aggregates stats from all buckets.
     */
    async getGlobalStats(): Promise<{
        totalBuckets: number;
        totalObjects: number;
        totalSize: number;
        distribution: Record<string, number>;
        topBuckets: { name: string; size: number; objectCount: number }[];
        topFiles: { name: string; size: number; lastModified: Date; bucketName: string }[];
    }> {
        const buckets = await this.listBuckets();
        let totalObjects = 0;
        let totalSize = 0;
        const totalDistribution: Record<string, number> = {
            '<1MB': 0, '1MB-10MB': 0, '10MB-100MB': 0, '100MB-1GB': 0, '1GB-5GB': 0, '5GB-10GB': 0, '>10GB': 0
        };
        let allTopFiles: { name: string; size: number; lastModified: Date; bucketName: string }[] = [];
        const bucketStatsList: { name: string; size: number; objectCount: number }[] = [];

        // Fetch bucket stats in parallel
        const statsPromises = buckets.map(async b => {
            try {
                const stats = await this.getBucketStats(b.name);
                return { name: b.name, ...stats };
            } catch (e) {
                return {
                    name: b.name,
                    objectCount: 0,
                    totalSize: 0,
                    distribution: { '<1MB': 0, '1MB-10MB': 0, '10MB-100MB': 0, '100MB-1GB': 0, '1GB-5GB': 0, '5GB-10GB': 0, '>10GB': 0 },
                    topFiles: []
                };
            }
        });
        const results = await Promise.all(statsPromises);

        results.forEach(r => {
            totalObjects += r.objectCount;
            totalSize += r.totalSize;
            if (r.distribution) {
                Object.keys(r.distribution).forEach(key => {
                    totalDistribution[key] = (totalDistribution[key] || 0) + (r.distribution[key] || 0);
                });
            }

            bucketStatsList.push({
                name: r.name,
                size: r.totalSize,
                objectCount: r.objectCount
            });
            if (r.topFiles) {
                allTopFiles = allTopFiles.concat(r.topFiles);
            }
        });

        // Sort and limit top buckets
        const topBuckets = bucketStatsList.sort((a, b) => b.size - a.size).slice(0, 10);

        // Sort and limit top files global
        const topFiles = allTopFiles.sort((a, b) => b.size - a.size).slice(0, 10);

        return {
            totalBuckets: buckets.length,
            totalObjects,
            totalSize,
            distribution: totalDistribution,
            topBuckets,
            topFiles
        };
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

/** Singleton MinIO service instance */
export const minioService = new MinioService();

/** Export FileObject type for use in other modules */
export type { FileObject };
