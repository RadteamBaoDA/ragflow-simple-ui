/**
 * @file index.ts
 * @description Barrel file for the Documents feature.
 * Exports the Document Manager page, permission modals, and storage services.
 */

export { default as DocumentManagerPage } from './pages/DocumentManagerPage';
export { DocumentPermissionModal } from './components/DocumentPermissionModal';
export { SourcePermissionsModal } from './components/SourcePermissionsModal';
export * from './api/minioService';
export * from './api/shared-storage.service';
