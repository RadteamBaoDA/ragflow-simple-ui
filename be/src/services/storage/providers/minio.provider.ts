/**
 * @fileoverview MinIO storage provider implementation.
 * @module services/storage/providers/minio.provider
 * @description Implements StorageProvider interface for MinIO/S3-compatible storage.
 */

import * as Minio from 'minio';
import { Readable } from 'stream';
import * as http from 'http';
import * as https from 'https';
import * as crypto from 'crypto';
import { minioClient } from '@/models/external/minio.js';
import { log } from '@/services/logger.service.js';
import { auditService, AuditAction, AuditResourceType } from '@/services/audit.service.js';
import { StorageProvider } from '../storage-provider.interface.js';
import {
    BucketInfo,
    FileObject,
    BucketStats,
    GlobalStats,
    UserContext,
    UploadFile
} from '../types.js';

/**
 * @description MinIO configuration interface.
 */
interface MinioConfig {
    endPoint: string;
    port: number;
    useSSL: boolean;
    accessKey: string;
    secretKey: string;
    publicEndPoint?: string;
}

/**
 * MinioStorageProvider
 * @description Implements StorageProvider for MinIO/S3-compatible storage.
 */
export class MinioStorageProvider implements StorageProvider {
    private client: Minio.Client;
    private config: MinioConfig;

    constructor(client?: Minio.Client) {
        this.client = client || minioClient;
        this.config = {
            endPoint: process.env.MINIO_ENDPOINT || 'localhost',
            port: parseInt(process.env.MINIO_PORT || '9000'),
            useSSL: process.env.MINIO_USE_SSL === 'true',
            accessKey: process.env.MINIO_ACCESS_KEY || '',
            secretKey: process.env.MINIO_SECRET_KEY || '',
            ...(process.env.MINIO_PUBLIC_ENDPOINT ? { publicEndPoint: process.env.MINIO_PUBLIC_ENDPOINT } : {}),
        };
    }

    // Admin API helper
    private async adminRequest(method: string, path: string, query: Record<string, string> = {}, body: unknown = null): Promise<unknown> {
        return new Promise((resolve, reject) => {
            const urlPath = `/${path}`;
            const queryString = Object.keys(query).length > 0
                ? '?' + Object.entries(query).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
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
                res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
                res.on('end', () => {
                    if (res.statusCode && res.statusCode >= 400) {
                        log.error('Admin API Error', { statusCode: res.statusCode, data });
                        return reject(new Error(`Admin API Error ${res.statusCode}: ${data}`));
                    }
                    try { if (!data) return resolve(null); resolve(JSON.parse(data)); } catch { resolve(data); }
                });
            });
            req.on('error', (err: Error) => { log.error('Admin request error', { message: err.message }); reject(err); });
            if (payload) req.write(payload);
            req.end();
        });
    }

    // Bucket Operations
    async listBuckets(): Promise<BucketInfo[]> {
        const buckets = await this.client.listBuckets();
        return buckets.map(b => ({ name: b.name, creationDate: b.creationDate }));
    }

    async bucketExists(name: string): Promise<boolean> {
        try { return await this.client.bucketExists(name); } catch { return false; }
    }

    async createBucket(name: string, user?: UserContext): Promise<void> {
        try {
            const exists = await this.client.bucketExists(name);
            if (!exists) {
                await this.client.makeBucket(name, 'us-east-1');
                await auditService.log({
                    userId: user?.id || 'system',
                    userEmail: user?.email || 'system',
                    action: AuditAction.CREATE_BUCKET,
                    resourceType: AuditResourceType.BUCKET,
                    resourceId: name,
                    details: { bucketName: name },
                    ipAddress: user?.ip,
                });
            }
        } catch (error) {
            log.error('Failed to create bucket', { bucketName: name, error: String(error) });
            throw error;
        }
    }

    async deleteBucket(name: string, user?: UserContext): Promise<void> {
        try {
            const objectsToDelete: string[] = [];
            try {
                const stream = this.client.listObjects(name, '', true);
                for await (const obj of stream) { const item = obj as any; if (item.name) objectsToDelete.push(item.name); }
                if (objectsToDelete.length > 0) await this.client.removeObjects(name, objectsToDelete);
            } catch (err) { log.warn(`Failed to empty bucket ${name}`, { error: String(err) }); }

            await this.client.removeBucket(name);

            if (user) {
                await auditService.log({
                    userId: user.id,
                    userEmail: user.email,
                    action: AuditAction.DELETE_BUCKET,
                    resourceType: AuditResourceType.BUCKET,
                    resourceId: name,
                    ipAddress: user.ip,
                });
            }
        } catch (error) {
            log.error('Failed to delete bucket', { bucketName: name, error: String(error) });
            throw error;
        }
    }

    async getBucketStats(name: string): Promise<BucketStats> {
        let objectCount = 0;
        let totalSize = 0;
        const stream = this.client.listObjects(name, '', true);
        for await (const obj of stream) {
            const item = obj as any;
            if (item.name && !item.name.endsWith('/')) { objectCount++; totalSize += item.size || 0; }
        }
        return { objectCount, totalSize };
    }

    // Object Operations
    async listObjects(bucket: string, prefix: string = '', recursive: boolean = false): Promise<FileObject[]> {
        const objects: FileObject[] = [];
        const stream = this.client.listObjectsV2(bucket, prefix, recursive, '');

        for await (const obj of stream) {
            if (obj.prefix) {
                objects.push({ name: obj.prefix.replace(/\/$/, ''), size: 0, lastModified: new Date(), etag: '', isFolder: true, prefix: obj.prefix });
            } else if (obj.name && !obj.name.endsWith('/')) {
                objects.push({ name: obj.name, size: obj.size || 0, lastModified: obj.lastModified || new Date(), etag: obj.etag || '', isFolder: false });
            }
        }
        return objects;
    }

    async listFiles(bucket: string, prefix: string = ''): Promise<FileObject[]> {
        return this.listObjects(bucket, prefix, false);
    }

    async uploadFile(bucket: string, file: UploadFile): Promise<{ message: string }> {
        try {
            const objectName = file.originalname || 'unknown';
            const metaData = { 'Content-Type': file.mimetype || 'application/octet-stream' };

            if (file.buffer) {
                await this.client.putObject(bucket, objectName, file.buffer, file.size, metaData);
            } else if (file.path) {
                await this.client.fPutObject(bucket, objectName, file.path, metaData);
            }
            return { message: 'File uploaded' };
        } catch (error) {
            log.error('Failed to upload file', { bucket, error: String(error) });
            throw error;
        }
    }

    async getFileStream(bucket: string, objectName: string): Promise<Readable> {
        return this.client.getObject(bucket, objectName);
    }

    async deleteObject(bucket: string, objectName: string): Promise<void> {
        await this.client.removeObject(bucket, objectName);
    }

    async deleteFile(bucket: string, fileName: string, _userId?: string): Promise<void> {
        await this.deleteObject(bucket, fileName);
    }

    async deleteObjects(bucket: string, objectNames: string[]): Promise<void> {
        await this.client.removeObjects(bucket, objectNames);
    }

    async checkFileExists(bucket: string, objectName: string): Promise<boolean> {
        try { await this.client.statObject(bucket, objectName); return true; } catch { return false; }
    }

    // Folder Operations
    async createFolder(bucket: string, folderPath: string): Promise<void> {
        const objectName = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;
        await this.client.putObject(bucket, objectName, Buffer.from(''), 0);
    }

    async deleteFolder(bucket: string, folderPath: string): Promise<void> {
        const objects = await this.listObjects(bucket, folderPath, true);
        const names = objects.map(o => o.name);
        if (names.length > 0) await this.client.removeObjects(bucket, names);
    }

    // URL Generation
    async getPresignedUrl(bucket: string, objectName: string, expiry: number = 3600, disposition?: string): Promise<string> {
        const reqParams: Record<string, string> = {};
        if (disposition) reqParams['response-content-disposition'] = disposition;
        return this.client.presignedGetObject(bucket, objectName, expiry, reqParams);
    }

    async getDownloadUrl(bucket: string, objectName: string, expiry: number = 3600, disposition?: string): Promise<string> {
        return this.getPresignedUrl(bucket, objectName, expiry, disposition);
    }

    // Statistics
    async getGlobalStats(): Promise<GlobalStats> {
        const buckets = await this.listBuckets();
        let totalObjects = 0;
        let totalSize = 0;
        const distribution: Record<string, number> = { '<1MB': 0, '1MB-10MB': 0, '10MB-100MB': 0, '100MB-1GB': 0, '1GB-5GB': 0, '5GB-10GB': 0, '>10GB': 0 };
        const bucketStats: { name: string; size: number; objectCount: number }[] = [];
        const allFiles: { name: string; size: number; lastModified: Date; bucketName: string }[] = [];

        for (const bucket of buckets) {
            let bObjects = 0;
            let bSize = 0;
            try {
                const stream = this.client.listObjects(bucket.name, '', true);
                for await (const obj of stream) {
                    const item = obj as any;
                    if (item.name && !item.name.endsWith('/')) {
                        bObjects++;
                        const size = item.size || 0;
                        bSize += size;

                        if (size < 1024 * 1024) distribution['<1MB']!++;
                        else if (size < 10 * 1024 * 1024) distribution['1MB-10MB']!++;
                        else if (size < 100 * 1024 * 1024) distribution['10MB-100MB']!++;
                        else if (size < 1024 * 1024 * 1024) distribution['100MB-1GB']!++;
                        else if (size < 5 * 1024 * 1024 * 1024) distribution['1GB-5GB']!++;
                        else if (size < 10 * 1024 * 1024 * 1024) distribution['5GB-10GB']!++;
                        else distribution['>10GB']!++;

                        if (allFiles.length < 100 || size > (allFiles[allFiles.length - 1]?.size ?? 0)) {
                            allFiles.push({ name: obj.name || 'unknown', size, lastModified: obj.lastModified || new Date(), bucketName: bucket.name });
                            allFiles.sort((a, b) => b.size - a.size);
                            if (allFiles.length > 100) allFiles.pop();
                        }
                    }
                }
                bucketStats.push({ name: bucket.name, size: bSize, objectCount: bObjects });
                totalObjects += bObjects;
                totalSize += bSize;
            } catch (err) { log.error(`Failed to get stats for bucket ${bucket.name}`, { error: String(err) }); }
        }

        return { totalBuckets: buckets.length, totalObjects, totalSize, distribution, topBuckets: bucketStats.sort((a, b) => b.size - a.size), topFiles: allFiles };
    }

    async getObjectStat(bucket: string, objectName: string): Promise<Minio.BucketItemStat> {
        return this.client.statObject(bucket, objectName);
    }

    // Admin / Access Key Operations
    async listAccessKeys(): Promise<any[]> {
        try {
            const result = await this.adminRequest('GET', 'minio/admin/v3/list-service-accounts') as any;
            return (result?.accounts || []).map((acc: any) => ({
                accessKey: acc,
                accountStatus: 'on'
            }));
        } catch (error) {
            log.warn('Failed to list access keys', { error });
            return [];
        }
    }

    async createAccessKey(policy: string, name?: string, description?: string): Promise<any> {
        try {
            // MinIO admin API for adding service account
            const payload = {
                policy: policy === 'readonly' ? 'readonly' : 'readwrite',
                name,
                description,
                // New access keys are generated by MinIO if not provided
            };
            const result = await this.adminRequest('POST', 'minio/admin/v3/add-service-account', {}, payload);
            return result;
        } catch (error) {
            log.error('Failed to create access key', { error });
            throw error;
        }
    }

    async deleteAccessKey(accessKey: string): Promise<void> {
        try {
            // MinIO admin API for deleting service account
            await this.adminRequest('POST', 'minio/admin/v3/delete-service-account', {}, { accessKey });
        } catch (error) {
            log.error('Failed to delete access key', { error });
            throw error;
        }
    }

    getClient(): Minio.Client {
        return this.client;
    }
}
