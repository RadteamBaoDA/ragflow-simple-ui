/**
 * @fileoverview Storage module re-exports.
 * @module services/storage
 */

// Types
export * from './types.js';

// Interface
export type { StorageProvider } from './storage-provider.interface.js';

// Factory and singleton
export { storageService, getMinioProvider } from './storage.service.js';
export type { StorageProviderType } from './storage.service.js';

// Providers (for direct access if needed)
export { MinioStorageProvider } from './providers/minio.provider.js';
