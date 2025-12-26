/**
 * @fileoverview User feature exports.
 * Contains components, services, and hooks for user management, permissions, and preferences.
 */
export { default as UserManagementPage } from './pages/UserManagementPage';
export { default as PermissionManagementPage } from './pages/PermissionManagementPage';
export { default as UserMultiSelect } from './components/UserMultiSelect';
export * from './api/userService';
export * from './api/userPreferences';
export * from './hooks/useSharedUser';
