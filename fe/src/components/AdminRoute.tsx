/**
 * @fileoverview Admin-only route wrapper component.
 * 
 * Restricts access to routes that require admin role.
 * Redirects non-admin users to 403 Forbidden page.
 * 
 * Usage:
 * ```tsx
 * <AdminRoute>
 *   <AdminOnlyPage />
 * </AdminRoute>
 * ```
 * 
 * @module components/AdminRoute
 */

import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

// ============================================================================
// Types
// ============================================================================

interface AdminRouteProps {
    /** Child components to render for admin users */
    children: React.ReactNode;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Route wrapper that restricts access to admin users only.
 * 
 * Behavior:
 * - Returns null while auth is loading (parent handles loading state)
 * - Redirects to /403 if user is not authenticated or not an admin
 * - Renders children if user is an admin
 * 
 * @param children - Components to render for admin users
 */
const AdminRoute = ({ children }: AdminRouteProps) => {
    const { user, isLoading } = useAuth();

    // Let ProtectedRoute handle the loading state
    if (isLoading) {
        return null;
    }

    // Redirect non-admin users to forbidden page
    if (!user || user.role !== 'admin') {
        return <Navigate to="/403" replace />;
    }

    return <>{children}</>;
};

export default AdminRoute;
