/**
 * @fileoverview Admin-only route wrapper component.
 *
 * Restricts access to routes that require admin role.
 * Redirects non-admin users to 403 Forbidden page.
 *
 * @module components/AdminRoute
 */

import { Navigate } from 'react-router-dom';
import { useAuth } from '@/features/auth';

// ============================================================================
// Types
// ============================================================================

/** 
 * @description Props for AdminRoute component
 */
interface AdminRouteProps {
    /** Child components to render for admin users */
    children: React.ReactNode;
}

// ============================================================================
// Component
// ============================================================================

/**
 * @description Route wrapper that restricts access to admin users only.
 * Checks the user's role and redirects if they are not an admin.
 *
 * @param {AdminRouteProps} props - Component properties.
 * @returns {JSX.Element | null} The child components if allowed, or a redirect.
 */
const AdminRoute = ({ children }: AdminRouteProps) => {
    const { user, isLoading } = useAuth();

    // Do nothing while authentication state is being determined
    if (isLoading) {
        return null;
    }

    // Check if the user is authenticated and has the 'admin' role
    if (!user || user.role !== 'admin') {
        // Redirect to the 403 Forbidden page if access is denied
        return <Navigate to="/403" replace />;
    }

    // Render the protected children if the user is an admin
    return <>{children}</>;
};

export default AdminRoute;
