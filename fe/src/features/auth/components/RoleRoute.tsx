/**
 * @fileoverview Role-based route wrapper component.
 *
 * Restricts access to routes based on allowed roles.
 * More flexible than AdminRoute - supports any combination of roles.
 *
 * @module components/RoleRoute
 */

import { Navigate } from 'react-router-dom';
import { useAuth } from '@/features/auth';

// ============================================================================
// Types
// ============================================================================

/** 
 * @description Valid user roles within the application.
 */
type Role = 'admin' | 'leader' | 'user';

/** 
 * @description Props for RoleRoute component.
 */
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
 * @description Route wrapper that restricts access based on user roles.
 * Verifies if the current user has one of the allowed roles.
 *
 * @param {RoleRouteProps} props - Component properties.
 * @returns {JSX.Element | null} The child components or a redirect.
 */
const RoleRoute = ({ children, allowedRoles }: RoleRouteProps) => {
    const { user, isLoading } = useAuth();

    // Return null while auth state is loading to prevent premature redirection
    if (isLoading) {
        return null;
    }

    // Check if user is authenticated and if their role is in the allowed list
    if (!user || !allowedRoles.includes(user.role as Role)) {
        // Redirect to 403 Forbidden page if access is denied
        return <Navigate to="/403" replace />;
    }

    // Render children if access is granted
    return <>{children}</>;
};

export default RoleRoute;
