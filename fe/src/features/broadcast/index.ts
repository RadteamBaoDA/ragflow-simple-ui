/**
 * @file index.ts
 * @description Barrel file for the broadcast feature.
 * Exports the admin page, notification banner, and service API helpers.
 */

// Export the Admin Broadcast Message Page
export { default as BroadcastMessagePage } from './pages/BroadcastMessagePage';

// Export the Public Broadcast Banner Component
export { default as BroadcastBanner } from './components/BroadcastBanner';

// Export all services and types from the broadcast message service
export * from './api/broadcastMessageService';
