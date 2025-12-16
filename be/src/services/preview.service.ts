/**
 * @fileoverview Service for handling file previews with local caching.
 * 
 * This service mediates file access for previews by:
 * 1. Checking if the file exists in the local temp cache.
 * 2. Checking if the cached file is within the TTL (7 days).
 * 3. Downloading from MinIO if missing or expired.
 * 4. Serving the file as a stream.
 * 
 * @module services/preview
 */

import fs from 'fs';
import fsPromises from 'fs/promises';
import { constants } from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { minioService, FileObject } from './minio.service.js';
import { queryOne } from '../db/index.js';
import { config } from '../config/index.js';
import { log } from './logger.service.js';

// Ensure temp directory exists (Non-blocking check not easily possible at top-level without await)
const tempDir = path.resolve(config.tempCachePath);
// We keep this sync as it runs once on startup
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

export class PreviewService {

    /**
     * Get a file stream for preview, using local cache if available and valid.
     * 
     * @param bucketId - The MinIO bucket name
     * @param filePath - The full path of the file in the bucket
     * @returns Promise containing the file stream, mime type (inferred), and size
     */
    async getPreviewStream(bucketId: string, filePath: string): Promise<{ path: string, size: number, filename: string }> {
        // Resolve bucket ID to bucket name
        const bucket = await queryOne<{ bucket_name: string }>(
            "SELECT bucket_name FROM minio_buckets WHERE id = $1 AND is_active = 1",
            [bucketId]
        );

        if (!bucket) {
            log.error('Bucket not found in database', { bucketId });
            throw new Error('Bucket not found');
        }

        const bucketName = bucket.bucket_name;

        // Sanitize file path to prevent directory traversal
        const safeKey = filePath.replace(/[^a-zA-Z0-9.\-_/]/g, '_');
        // Cache file using UUID to ensure uniqueness/immutability
        const localFilename = `${bucketId}_${safeKey.replace(/\//g, '_')}`;
        const localFilePath = path.join(tempDir, localFilename);

        let useCache = false;

        // Check if file exists in cache
        try {
            await fsPromises.access(localFilePath, constants.F_OK);
            const stats = await fsPromises.stat(localFilePath);
            const now = Date.now();
            const age = now - stats.mtimeMs;

            if (age < config.tempFileTTL) {
                useCache = true;
                log.debug('Preview cache hit', { bucketId, bucketName, filePath, localFilePath });
            } else {
                log.debug('Preview cache expired', { bucketId, bucketName, filePath, age, ttl: config.tempFileTTL });
                // Delete expired file
                try {
                    await fsPromises.unlink(localFilePath);
                } catch (err) {
                    log.error('Failed to delete expired cache file', { localFilePath, error: err });
                }
            }
        } catch (error) {
            // File does not exist, safe to ignore
        }

        if (!useCache) {
            log.debug('Preview cache miss - downloading', { bucketId, bucketName, filePath });
            try {
                // Get object stats to verify existence and size
                // Use actual bucket name for MinIO
                const stat = await minioService.getObjectStat(bucketName, filePath);

                // Download file to temp path
                // Use actual bucket name for MinIO
                await minioService.getClient().fGetObject(bucketName, filePath, localFilePath);

                // Explicitly update mtime to now (though fGetObject should create it new)
                const now = new Date();
                await fsPromises.utimes(localFilePath, now, now);

                log.info('File cached successfully', { bucketId, bucketName, filePath, localFilePath });

            } catch (error) {
                log.error('Failed to download file for preview', { error, bucketId, bucketName, filePath });
                throw error;
            }
        }

        const stats = await fsPromises.stat(localFilePath);
        // Return file path to allow res.sendFile to handle Ranges/Etags
        return {
            path: localFilePath,
            size: stats.size,
            filename: path.basename(filePath)
        };
    }
}

export const previewService = new PreviewService();
