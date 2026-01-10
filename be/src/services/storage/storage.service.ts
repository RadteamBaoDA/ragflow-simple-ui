/**
 * @fileoverview Storage service factory.
 * @module services/storage/storage.service
 * @description Factory that loads the appropriate storage provider based on config.
 */

import { StorageProvider } from './storage-provider.interface.js';
import { MinioStorageProvider } from './providers/minio.provider.js';
import { log } from '@/services/logger.service.js';

/**
 * Supported storage provider types.
 */
export type StorageProviderType = 'minio' | 's3' | 'azure' | 'gcp';

/**
 * @description Creates and returns the configured storage provider instance.
 * @returns StorageProvider - The configured provider instance.
 */
function createStorageProvider(): StorageProvider {
    // Get provider type from environment
    const providerType = (process.env.STORAGE_PROVIDER || 'minio').toLowerCase() as StorageProviderType;

    log.info(`Initializing storage provider: ${providerType}`);

    switch (providerType) {
        case 'minio':
        case 's3':
            // MinIO is S3-compatible, use same provider
            return new MinioStorageProvider();

        case 'azure':
            // TODO: Implement Azure Blob Storage provider
            log.warn('Azure storage provider not implemented, falling back to MinIO');
            return new MinioStorageProvider();

        case 'gcp':
            // TODO: Implement Google Cloud Storage provider
            log.warn('GCP storage provider not implemented, falling back to MinIO');
            return new MinioStorageProvider();

        default:
            log.warn(`Unknown storage provider "${providerType}", falling back to MinIO`);
            return new MinioStorageProvider();
    }
}

/**
 * @description Singleton storage service instance.
 * Use this for all storage operations throughout the application.
 */
export const storageService = createStorageProvider();

/**
 * @description Get the MinIO-specific provider for admin operations.
 * @returns MinioStorageProvider - Cast to MinIO provider.
 * @throws Error if provider is not MinIO.
 */
export function getMinioProvider(): MinioStorageProvider {
    if (storageService instanceof MinioStorageProvider) {
        return storageService;
    }
    throw new Error('MinIO provider not available. Current provider does not support MinIO-specific operations.');
}
