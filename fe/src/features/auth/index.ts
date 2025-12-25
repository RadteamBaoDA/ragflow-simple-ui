// Barrel exports for auth feature (routes, providers, guards).
export { default as LoginPage } from './pages/LoginPage';
export { default as LogoutPage } from './pages/LogoutPage';
export { useAuth, AuthProvider } from './hooks/useAuth';
export type { User } from './hooks/useAuth';
export { default as ProtectedRoute } from './components/ProtectedRoute';
export { default as AdminRoute } from './components/AdminRoute';
export { default as RoleRoute } from './components/RoleRoute';
