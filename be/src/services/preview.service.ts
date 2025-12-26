
// Caches downloaded MinIO files locally to serve preview responses.
import fs from 'fs';
import fsPromises from 'fs/promises';
import { constants } from 'fs';
import path from 'path';
import { minioService } from '@/services/minio.service.js';
import { ModelFactory } from '@/models/factory.js';
import { config } from '@/config/index.js';
import { log } from '@/services/logger.service.js';

const tempDir = path.resolve(config.tempCachePath);
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

/**
 * PreviewService
 * Caches downloaded MinIO files locally to serve preview responses.
 * Manages temp file caching with TTL-based expiration for efficient file serving.
 */
export class PreviewService {
    /**
     * Generate a local preview file for a MinIO object.
     * Downloads the object if not cached or if cache has expired.
     * @param bucketName - MinIO bucket name or bucket UUID.
     * @param fileName - Object name/path within the bucket.
     * @returns Promise<string> - Absolute path to the local cached file.
     * @throws Error if download fails.
     * @description Handles mapping UUID to bucket name, sanitizing local filenames, checking cache validity (TTL), and downloading from MinIO.
     */
    async generatePreview(bucketName: string, fileName: string): Promise<string> {
        // Start with the provided bucket name as target
        let targetBucketName = bucketName;

        // UUID regex pattern to detect if bucketName is a database ID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        // If bucketName looks like a UUID, resolve actual bucket name from database
        if (uuidRegex.test(bucketName)) {
            // Look up bucket metadata by ID to get the real MinIO bucket name
            const bucket = await ModelFactory.minioBucket.findById(bucketName);
            if (bucket) targetBucketName = bucket.bucket_name;
        }

        // Sanitize filename to create a safe local cache key
        // Replace special characters with underscores to prevent path traversal
        const safeKey = fileName.replace(/[^a-zA-Z0-9.\-_/]/g, '_');

        // Build local filename: bucket_filename with slashes replaced by underscores
        const localFilename = `${targetBucketName}_${safeKey.replace(/\//g, '_')}`;

        // Full path to the cached file in temp directory
        const localFilePath = path.join(tempDir, localFilename);

        // Flag to track if we can use existing cached file
        let useCache = false;

        try {
            // Check if cached file exists and is accessible
            await fsPromises.access(localFilePath, constants.F_OK);

            // Get file stats to check modification time for TTL calculation
            const stats = await fsPromises.stat(localFilePath);
            const now = Date.now();

            // Calculate age of cached file in milliseconds
            const age = now - stats.mtimeMs;

            // If file is younger than TTL, use cache; otherwise delete expired file
            if (age < config.tempFileTTL) {
                useCache = true;
                log.debug('Preview cache hit', { bucketName: targetBucketName, fileName, localFilePath });
            } else {
                // Cache expired - attempt to delete the stale file
                try {
                    await fsPromises.unlink(localFilePath);
                } catch (err) {
                    // Log but continue - file might already be deleted or locked
                    log.error('Failed to delete expired cache file', { localFilePath, error: err });
                }
            }
        } catch (error) {
            // File doesn't exist - this is expected for first-time access
            // Continue to download the file
        }

        // If cache miss or expired, download fresh copy from MinIO
        if (!useCache) {
            try {
                // Dynamic import of MinIO client to download file directly to local path
                const { minioClient } = await import('../models/external/minio.js');

                // Download object from MinIO and save to local file system
                await minioClient.fGetObject(targetBucketName, fileName, localFilePath);

                // Update file timestamps to current time for accurate TTL tracking
                const now = new Date();
                await fsPromises.utimes(localFilePath, now, now);

                log.info('File cached successfully', { bucketName: targetBucketName, fileName, localFilePath });
            } catch (error) {
                // Download failed - log and propagate error to caller
                log.error('Failed to download file for preview', { error, bucketName: targetBucketName, fileName });
                throw error;
            }
        }

        // Return the local file path for the preview
        return localFilePath;
    }
}

export const previewService = new PreviewService();
