/**
 * @file index.ts
 * @description Barrel file for the Authentication feature.
 * Exports components, hooks, and types related to user authentication and route protection.
 */

// Page components for login and logout
export { default as LoginPage } from './pages/LoginPage';
export { default as LogoutPage } from './pages/LogoutPage';

// Auth context hook and provider
export { useAuth, AuthProvider } from './hooks/useAuth';
export type { User } from './hooks/useAuth';

// Route guards for protecting routes based on auth state and roles
export { default as ProtectedRoute } from './components/ProtectedRoute';
export { default as AdminRoute } from './components/AdminRoute';
export { default as RoleRoute } from './components/RoleRoute';
