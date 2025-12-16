/**
 * @fileoverview Role-based route wrapper component.
 * 
 * Restricts access to routes based on allowed roles.
 * More flexible than AdminRoute - supports any combination of roles.
 * 
 * Usage:
 * ```tsx
 * <RoleRoute allowedRoles={['admin', 'manager']}>
 *   <StoragePage />
 * </RoleRoute>
 * ```
 * 
 * @module components/RoleRoute
 */

import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

// ============================================================================
// Types
// ============================================================================

/** Valid user roles */
type Role = 'admin' | 'manager' | 'user';

interface RoleRouteProps {
    /** Child components to render for allowed roles */
    children: React.ReactNode;
    /** Array of roles that can access this route */
    allowedRoles: Role[];
}

// ============================================================================
// Component
// ============================================================================

/**
 * Route wrapper that restricts access based on user roles.
 * 
 * Behavior:
 * - Returns null while auth is loading
 * - Redirects to /403 if user role is not in allowedRoles
 * - Renders children if user has an allowed role
 * 
 * @param children - Components to render for allowed users
 * @param allowedRoles - Array of roles that can access this route
 */
const RoleRoute = ({ children, allowedRoles }: RoleRouteProps) => {
    const { user, isLoading } = useAuth();

    // Return null while loading (parent handles loading state)
    if (isLoading) {
        return null;
    }

    // Redirect if user is not authenticated or role not allowed
    if (!user || !allowedRoles.includes(user.role as Role)) {
        return <Navigate to="/403" replace />;
    }

    return <>{children}</>;
};

export default RoleRoute;
