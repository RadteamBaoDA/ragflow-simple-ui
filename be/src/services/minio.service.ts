
// Wraps MinIO client operations plus admin API helpers for buckets/objects.
import * as Minio from 'minio';
import { Readable } from 'stream';
import * as http from 'http';
import * as https from 'https';
import * as crypto from 'crypto';
import { minioClient } from '@/models/external/minio.js';
import { ModelFactory } from '@/models/factory.js';
import { log } from '@/services/logger.service.js';
import { auditService, AuditAction, AuditResourceType } from '@/services/audit.service.js';

export interface FileObject {
    name: string;
    size: number;
    lastModified: Date;
    etag: string;
    isFolder: boolean;
    prefix?: string;
}

/**
 * MinioService
 * Wraps MinIO client operations plus admin API helpers for buckets and Objects.
 * Provides file upload, download, folder management, and storage statistics.
 * Uses AWS SigV4 signing for admin API calls.
 */
class MinioService {
    private client = minioClient;
    // Configuration for Admin API calls (manual signing required)
    private config = {
        endPoint: process.env.MINIO_ENDPOINT || 'localhost',
        port: parseInt(process.env.MINIO_PORT || '9000'),
        useSSL: process.env.MINIO_USE_SSL === 'true',
        accessKey: process.env.MINIO_ACCESS_KEY || '',
        secretKey: process.env.MINIO_SECRET_KEY || '',
        publicEndPoint: process.env.MINIO_PUBLIC_ENDPOINT,
    };

    /**
     * Execute an admin API request with AWS SigV4 authentication.
     * @param method - HTTP method (GET, POST, DELETE).
     * @param path - API endpoint path without leading slash.
     * @param query - Optional query parameters object.
     * @param body - Optional request body (will be JSON stringified).
     * @returns Promise<any> - Parsed JSON response or raw data string.
     * @throws Error if request fails or returns 4xx/5xx status.
     * @description internal helper to calculate signatures and make requests to MinIO Admin API.
     */
    private async adminRequest(method: string, path: string, query: any = {}, body: any = null): Promise<any> {
        return new Promise((resolve, reject) => {
            const urlPath = `/${path}`;
            // Construct query string
            const queryString = Object.keys(query).length > 0
                ? '?' + Object.entries(query).map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`).join('&')
                : '';

            const fullPath = urlPath + queryString;
            const payload = body ? JSON.stringify(body) : '';
            // Hash payload for signature
            const payloadHash = crypto.createHash('sha256').update(payload).digest('hex');

            // prepare timestamps
            const date = new Date();
            const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
            const dateStamp = amzDate.slice(0, 8);
            const host = `${this.config.endPoint}:${this.config.port}`;

            // Create canonical headers
            const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
            const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

            // create canonical request
            const canonicalRequest = [method, urlPath, queryString.replace('?', ''), canonicalHeaders, signedHeaders, payloadHash].join('\n');
            const credentialScope = `${dateStamp}/us-east-1/s3/aws4_request`;
            const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, crypto.createHash('sha256').update(canonicalRequest).digest('hex')].join('\n');

            // Calculate signing keys
            const kDate = crypto.createHmac('sha256', 'AWS4' + this.config.secretKey).update(dateStamp).digest();
            const kRegion = crypto.createHmac('sha256', kDate).update('us-east-1').digest();
            const kService = crypto.createHmac('sha256', kRegion).update('s3').digest();
            const signingKey = crypto.createHmac('sha256', kService).update('aws4_request').digest();
            const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

            // Build authorization header
            const authHeader = `AWS4-HMAC-SHA256 Credential=${this.config.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

            const reqHeaders: Record<string, string | number> = {
                'Host': host, 'X-Amz-Date': amzDate, 'X-Amz-Content-Sha256': payloadHash, 'Authorization': authHeader
            };
            if (payload) { reqHeaders['Content-Type'] = 'application/json'; reqHeaders['Content-Length'] = Buffer.byteLength(payload); }

            // Choose http/https based on config
            const protocol = this.config.useSSL ? https : http;
            // Execute request
            const req = protocol.request({ hostname: this.config.endPoint, port: this.config.port, path: fullPath, method, headers: reqHeaders }, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk.toString(); });
                res.on('end', () => {
                    // Normalize response
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
     * List all buckets visible to configured MinIO credentials.
     * @returns Promise<Minio.BucketItemFromList[]> - List of buckets.
     * @description Wraps client.listBuckets().
     */
    async listBuckets(): Promise<Minio.BucketItemFromList[]> {
        return this.client.listBuckets();
    }

    /**
     * Check if a bucket exists in MinIO.
     * @param bucketName - Name of the bucket to check.
     * @returns Promise<boolean> - True if bucket exists, false otherwise.
     * @description Swallows errors (like NotFound) to return a simple boolean.
     */
    async bucketExists(bucketName: string): Promise<boolean> {
        try {
            return await this.client.bucketExists(bucketName);
        } catch (error) {
            return false;
        }
    }

    /**
     * Create a new bucket in MinIO and register it in the metadata table.
     * @param bucketName - Unique bucket name to create.
     * @param description - Human-readable description.
     * @param user - Optional user context for audit.
     * @returns Promise<any> - Created bucket record.
     * @throws Error if bucket already configured or MinIO fail.
     * @description Checks DB config, creates bucket in MinIO, saves to DB, and logs audit.
     */
    async createBucket(bucketName: string, description: string, user?: { id: string, email: string, ip?: string }): Promise<any> {
        try {
            // 1. Check if configured in DB
            const existingConfig = await ModelFactory.minioBucket.findByName(bucketName);
            if (existingConfig) {
                throw new Error(`Bucket '${bucketName}' is already configured in the system.`);
            }

            // 2. Ensure exists in MinIO
            const exists = await this.client.bucketExists(bucketName);
            if (!exists) {
                await this.client.makeBucket(bucketName, 'us-east-1');
            }

            // 3. Register in DB
            const bucket = await ModelFactory.minioBucket.create({
                bucket_name: bucketName,
                display_name: bucketName,
                description,
                created_by: user?.id || 'system'
            });

            // 4. Audit Log
            if (user) {
                await auditService.log({
                    userId: user.id,
                    userEmail: user.email,
                    action: AuditAction.CREATE_BUCKET,
                    resourceType: AuditResourceType.BUCKET,
                    resourceId: bucket.id,
                    details: { bucketName },
                    ipAddress: user.ip,
                });
            }
            return bucket;
        } catch (error) {
            log.error('Failed to create bucket', { bucketName, error: String(error) });
            throw error;
        }
    }

    /**
     * Remove a bucket from MinIO and delete its database metadata record.
     * @param bucketName - Name of the bucket.
     * @param user - Optional user context for audit.
     * @returns Promise<void>
     * @description Removes from MinIO, then from DB, then logs audit.
     */
    async deleteBucket(bucketName: string, user?: { id: string, email: string, ip?: string }): Promise<void> {
        try {
            // Remove from backend storage
            await this.client.removeBucket(bucketName);

            // Remove from database
            const bucket = await ModelFactory.minioBucket.findByName(bucketName);
            if (bucket) {
                await ModelFactory.minioBucket.delete(bucket.id);
            }

            // Audit log
            if (user) {
                await auditService.log({
                    userId: user.id,
                    userEmail: user.email,
                    action: AuditAction.DELETE_BUCKET,
                    resourceType: AuditResourceType.BUCKET,
                    resourceId: bucketName,
                    ipAddress: user.ip,
                });
            }
        } catch (error) {
            log.error('Failed to delete bucket', { bucketName, error: String(error) });
            throw error;
        }
    }

    /**
     * List objects or pseudo-folders under a prefix in a bucket.
     * @param bucketName - Target bucket name.
     * @param prefix - Object prefix to filter.
     * @param recursive - Whether to list deeply.
     * @returns Promise<FileObject[]> - Array of standardized FileObjects.
     * @description Normalizes MinIO list objects stream into an array of FileObject.
     */
    async listObjects(bucketName: string, prefix: string = '', recursive: boolean = false): Promise<FileObject[]> {
        const objects: FileObject[] = [];
        // Get stream from MinIO client
        const stream = this.client.listObjectsV2(bucketName, prefix, recursive, '');

        for await (const obj of stream) {
            if (obj.prefix) {
                // Handle Folder (CommonPrefix)
                objects.push({
                    name: obj.prefix.replace(/\/$/, ''),
                    size: 0,
                    lastModified: new Date(),
                    etag: '',
                    isFolder: true,
                    prefix: obj.prefix
                });
            } else if (obj.name) {
                // Handle File
                // Skip folder placeholder objects (objects ending with /)
                if (obj.name.endsWith('/')) continue;

                objects.push({
                    name: obj.name,
                    size: obj.size,
                    lastModified: obj.lastModified,
                    etag: obj.etag,
                    isFolder: false
                });
            }
        }
        return objects;
    }

    /**
     * Convenience wrapper to list files (non-recursive) in a bucket prefix.
     * @param bucketName - Target bucket name.
     * @param prefix - Object prefix.
     * @returns Promise<FileObject[]> - List of files at current level.
     */
    async listFiles(bucketName: string, prefix: string = ''): Promise<FileObject[]> {
        return this.listObjects(bucketName, prefix, false);
    }

    /**
     * Upload a file to MinIO bucket.
     * @param bucketName - Target bucket name.
     * @param file - File object (supports buffer, path, or stream).
     * @param userId - ID of uploader (unused param for now).
     * @returns Promise<any> - Success message.
     * @throws Error on upload failure.
     * @description Supports multiple input types (buffer/file path/stream) and sets Content-Type.
     */
    async uploadFile(bucketName: string, file: any, userId?: string): Promise<any> {
        try {
            const objectName = file.originalname || 'unknown';
            const metaData = {
                'Content-Type': file.mimetype || 'application/octet-stream'
            };

            // Switch strategy based on input type
            if (file.buffer) {
                await this.client.putObject(bucketName, objectName, file.buffer, file.size, metaData);
            } else if (file.path) {
                await this.client.fPutObject(bucketName, objectName, file.path, metaData);
            } else if (file instanceof Readable) {
                const size = (file as any).size || undefined;
                await this.client.putObject(bucketName, objectName, file, size, metaData);
            }

            return { message: 'File uploaded' };
        } catch (error) {
            log.error('Failed to upload file', { bucketName, error: String(error) });
            throw error;
        }
    }

    /**
     * Get a readable stream for downloading a file from MinIO.
     * @param bucketName - Target bucket name.
     * @param fileName - Object name.
     * @returns Promise<Readable> - File stream.
     */
    async getFileStream(bucketName: string, fileName: string): Promise<Readable> {
        return this.client.getObject(bucketName, fileName);
    }

    /**
     * Delete a single object from a bucket.
     * @param bucketName - Target bucket name.
     * @param objectName - Object name to delete.
     * @returns Promise<void>
     */
    async deleteObject(bucketName: string, objectName: string): Promise<void> {
        await this.client.removeObject(bucketName, objectName);
    }

    /**
     * Alias for deleteObject to match controller naming convention.
     * @param bucketName - Target bucket name.
     * @param fileName - Object name.
     * @param userId - Uploader ID (unused).
     * @returns Promise<void>
     */
    async deleteFile(bucketName: string, fileName: string, userId?: string): Promise<void> {
        await this.deleteObject(bucketName, fileName);
    }

    /**
     * Check if a file exists using statObject.
     * @param bucketName - Target bucket name.
     * @param objectName - Object name.
     * @returns Promise<boolean> - True if exists.
     * @description Returns false on NotFound error, true otherwise.
     */
    async checkFileExists(bucketName: string, objectName: string): Promise<boolean> {
        try {
            await this.client.statObject(bucketName, objectName);
            return true;
        } catch (error: any) {
            if (error.code === 'NotFound') return false;
            return false;
        }
    }

    /**
     * Create a folder placeholder object in MinIO.
     * @param bucketName - Target bucket name.
     * @param folderPath - Folder path.
     * @returns Promise<void>
     * @description MinIO mimics folders with zero-byte objects ending in '/'.
     */
    async createFolder(bucketName: string, folderPath: string): Promise<void> {
        const objectName = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;
        await this.client.putObject(bucketName, objectName, Buffer.from(''), 0);
    }

    /**
     * Delete a folder and all its contents.
     * @param bucketName - Target bucket name.
     * @param folderPath - Folder prefix.
     * @returns Promise<void>
     * @description Recursively finds all objects with prefix and batch deletes them.
     */
    async deleteFolder(bucketName: string, folderPath: string): Promise<void> {
        // Find all objects under prefix
        const objects = await this.listObjects(bucketName, folderPath, true);
        const names = objects.map(o => o.name);

        // Batch remove
        if (names.length > 0) {
            await this.client.removeObjects(bucketName, names);
        }
    }

    /**
     * Bulk delete multiple objects from a bucket.
     * @param bucketName - Target bucket name.
     * @param objectNames - Array of object names.
     * @returns Promise<void>
     */
    async deleteObjects(bucketName: string, objectNames: string[]): Promise<void> {
        await this.client.removeObjects(bucketName, objectNames);
    }

    /**
     * Generate a presigned download URL for temporary access.
     * @param bucketName - Target bucket name.
     * @param objectName - Object name.
     * @param expiry - Expiry in seconds (default 1h).
     * @param disposition - 'inline' or 'attachment'.
     * @returns Promise<string> - The presigned URL.
     */
    async getDownloadUrl(bucketName: string, objectName: string, expiry: number = 3600, disposition?: string): Promise<string> {
        const reqParams: any = {};
        if (disposition) {
            reqParams['response-content-disposition'] = disposition;
        }
        return this.client.presignedGetObject(bucketName, objectName, expiry, reqParams);
    }

    /**
     * Compute storage statistics across all buckets.
     * @returns Promise<any> - Global stats object.
     * @description Aggregates stats from all buckets including size distribution and top files.
     */
    async getGlobalStats(): Promise<any> {
        const buckets = await this.listBuckets();
        let totalObjects = 0;
        let totalSize = 0;
        // Initialize distribution buckets
        const distribution = {
            '<1MB': 0,
            '1MB-10MB': 0,
            '10MB-100MB': 0,
            '100MB-1GB': 0,
            '1GB-5GB': 0,
            '5GB-10GB': 0,
            '>10GB': 0,
        };
        const bucketStats: { name: string; size: number; objectCount: number }[] = [];
        const allFiles: { name: string; size: number; lastModified: Date; bucketName: string }[] = [];

        // Iterate all buckets
        for (const bucket of buckets) {
            let bObjects = 0;
            let bSize = 0;
            try {
                // recursive list
                const stream = this.client.listObjects(bucket.name, '', true);
                for await (const obj of stream) {
                    if (obj.name && !obj.name.endsWith('/')) {
                        bObjects++;
                        const size = obj.size || 0;
                        bSize += size;

                        // Add to distribution logic
                        if (size < 1024 * 1024) distribution['<1MB']++;
                        else if (size < 10 * 1024 * 1024) distribution['1MB-10MB']++;
                        else if (size < 100 * 1024 * 1024) distribution['10MB-100MB']++;
                        else if (size < 1024 * 1024 * 1024) distribution['100MB-1GB']++;
                        else if (size < 5 * 1024 * 1024 * 1024) distribution['1GB-5GB']++;
                        else if (size < 10 * 1024 * 1024 * 1024) distribution['5GB-10GB']++;
                        else distribution['>10GB']++;

                        // Maintain top files list (limited to 100)
                        if (allFiles.length < 100 || size > (allFiles[allFiles.length - 1]?.size || 0)) {
                            allFiles.push({
                                name: obj.name,
                                size,
                                lastModified: obj.lastModified,
                                bucketName: bucket.name,
                            });
                            // keep sorted
                            allFiles.sort((a, b) => b.size - a.size);
                            if (allFiles.length > 100) allFiles.pop();
                        }
                    }
                }
                bucketStats.push({ name: bucket.name, size: bSize, objectCount: bObjects });
                totalObjects += bObjects;
                totalSize += bSize;
            } catch (err) {
                log.error(`Failed to get stats for bucket ${bucket.name}`, { error: String(err) });
            }
        }

        return {
            totalBuckets: buckets.length,
            totalObjects,
            totalSize,
            distribution,
            topBuckets: bucketStats.sort((a, b) => b.size - a.size), // Sort buckets by size
            topFiles: allFiles,
        };
    }

    /**
     * Get MinIO buckets not yet tracked in the application database.
     * @returns Promise<any[]> - Unconfigured buckets.
     * @description Diff between MinIO buckets and DB bucket records.
     */
    async getAvailableBuckets(): Promise<any[]> {
        // 1. Get all actual buckets from MinIO
        const minioBuckets = await this.listBuckets();

        // 2. Get all configured buckets from DB
        const configuredBuckets = await ModelFactory.minioBucket.findAll({});
        const configuredNames = new Set(configuredBuckets.map(b => b.bucket_name));

        // 3. Filter out buckets that are already configured
        return minioBuckets
            .filter(b => b.name && !configuredNames.has(b.name))
            .map(b => ({
                name: b.name,
                creationDate: b.creationDate
            }));
    }

    /**
     * Get object count and total size for a single bucket.
     * @param bucketName - Target bucket name.
     * @returns Promise<any> - { objectCount, totalSize }.
     * @description Recursively iterates bucket to compute stats.
     */
    async getBucketStats(bucketName: string): Promise<any> {
        let objectCount = 0;
        let totalSize = 0;
        const stream = this.client.listObjects(bucketName, '', true);
        for await (const obj of stream) {
            if (obj.name && !obj.name.endsWith('/')) {
                objectCount++;
                totalSize += obj.size || 0;
            }
        }
        return { objectCount, totalSize };
    }

    /**
     * List MinIO service accounts via admin API.
     * @returns Promise<any[]> - List of service accounts.
     */
    async listServiceAccounts(): Promise<any[]> {
        const result = await this.adminRequest('GET', 'minio/admin/v3/list-service-accounts');
        return result?.accounts || [];
    }

    /**
     * Create a new MinIO service account.
     * @param policy - 'readonly' or 'readwrite'.
     * @param name - Account name.
     * @param description - Account description.
     * @returns Promise<any> - JSON result with creds.
     */
    async createServiceAccount(policy: string, name: string, description: string): Promise<any> {
        const payload = {
            policy: policy === 'readonly' ? 'readonly' : 'readwrite',
            name,
            description,
        };
        return this.adminRequest('POST', 'minio/admin/v3/add-service-account', {}, payload);
    }

    /**
     * Delete a MinIO service account.
     * @param accessKey - Access key to delete.
     * @returns Promise<void>
     */
    async deleteServiceAccount(accessKey: string): Promise<void> {
        await this.adminRequest('POST', 'minio/admin/v3/delete-service-account', {}, { accessKey });
    }

    /**
     * Get the underlying MinIO client instance.
     * @returns Minio.Client
     */
    getClient() {
        return this.client;
    }

    /**
     * Fetch stat metadata for an object.
     * @param bucketName - Target bucket name.
     * @param objectName - Object name.
     * @returns Promise<Minio.BucketItemStat>
     */
    async getObjectStat(bucketName: string, objectName: string): Promise<Minio.BucketItemStat> {
        return this.client.statObject(bucketName, objectName);
    }
}

export const minioService = new MinioService();
