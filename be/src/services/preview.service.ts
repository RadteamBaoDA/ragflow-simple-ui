
import fs from 'fs';
import fsPromises from 'fs/promises';
import { constants } from 'fs';
import path from 'path';
import { minioService } from './minio.service.js';
import { ModelFactory } from '../models/factory.js';
import { config } from '../config/index.js';
import { log } from './logger.service.js';

const tempDir = path.resolve(config.tempCachePath);
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

export class PreviewService {
    async generatePreview(bucketName: string, fileName: string): Promise<string> {
        let targetBucketName = bucketName;

        // Try resolve bucket name from ID if UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(bucketName)) {
             const bucket = await ModelFactory.minioBucket.findById(bucketName);
             if (bucket) targetBucketName = bucket.bucket_name;
        }

        const safeKey = fileName.replace(/[^a-zA-Z0-9.\-_/]/g, '_');
        const localFilename = `${targetBucketName}_${safeKey.replace(/\//g, '_')}`;
        const localFilePath = path.join(tempDir, localFilename);

        let useCache = false;

        try {
            await fsPromises.access(localFilePath, constants.F_OK);
            const stats = await fsPromises.stat(localFilePath);
            const now = Date.now();
            const age = now - stats.mtimeMs;

            if (age < config.tempFileTTL) {
                useCache = true;
                log.debug('Preview cache hit', { bucketName: targetBucketName, fileName, localFilePath });
            } else {
                try {
                    await fsPromises.unlink(localFilePath);
                } catch (err) {
                    log.error('Failed to delete expired cache file', { localFilePath, error: err });
                }
            }
        } catch (error) {
        }

        if (!useCache) {
             try {
                // Use minioService helper or direct client
                const { minioClient } = await import('../models/external/minio.js');
                await minioClient.fGetObject(targetBucketName, fileName, localFilePath);

                const now = new Date();
                await fsPromises.utimes(localFilePath, now, now);
                log.info('File cached successfully', { bucketName: targetBucketName, fileName, localFilePath });
             } catch (error) {
                log.error('Failed to download file for preview', { error, bucketName: targetBucketName, fileName });
                throw error;
             }
        }

        return localFilePath;
    }
}

export const previewService = new PreviewService();
