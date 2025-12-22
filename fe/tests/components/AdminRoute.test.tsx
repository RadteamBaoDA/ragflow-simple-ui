/**
 * @fileoverview Tests for AdminRoute component.
 * 
 * Tests:
 * - Admin access
 * - Non-admin redirect
 * - Loading state
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React, { createContext, useContext, ReactNode } from 'react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

// ============================================================================
// Types
// ============================================================================

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'leader' | 'user';
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
}

// ============================================================================
// Mock Context
// ============================================================================

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: false,
});

function useAuth() {
  return useContext(AuthContext);
}

// ============================================================================
// Mock AdminRoute Component
// ============================================================================

interface AdminRouteProps {
  children: ReactNode;
}

function AdminRoute({ children }: AdminRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!user || user.role !== 'admin') {
    // Redirect to 403
    return <Navigate to="/403" />;
  }

  return <>{children}</>;
}

// Mock Navigate component
function Navigate({ to }: { to: string }) {
  const location = useLocation();
  return <div data-testid="redirect" data-to={to}>Redirected from {location.pathname}</div>;
}

// ============================================================================
// Test Helpers
// ============================================================================

interface TestWrapperProps {
  children: ReactNode;
  user?: User | null;
  isLoading?: boolean;
  initialRoute?: string;
}

function TestWrapper({ children, user = null, isLoading = false, initialRoute = '/admin' }: TestWrapperProps) {
  return (
    <AuthContext.Provider value={{ user, isLoading }}>
      <MemoryRouter initialEntries={[initialRoute]}>
        {children}
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

// ============================================================================
// Tests
// ============================================================================

describe('AdminRoute', () => {
  describe('admin access', () => {
    it('should render children for admin user', () => {
      const adminUser: User = {
        id: 'admin-1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin',
      };

      render(
        <TestWrapper user={adminUser}>
          <AdminRoute>
            <div data-testid="admin-content">Admin Only Content</div>
          </AdminRoute>
        </TestWrapper>
      );

      expect(screen.getByTestId('admin-content')).toBeInTheDocument();
      expect(screen.getByText('Admin Only Content')).toBeInTheDocument();
    });

    it('should render complex children for admin', () => {
      const adminUser: User = {
        id: 'admin-1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin',
      };

      render(
        <TestWrapper user={adminUser}>
          <AdminRoute>
            <div>
              <h1>Admin Dashboard</h1>
              <button>Manage Users</button>
            </div>
          </AdminRoute>
        </TestWrapper>
      );

      expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Manage Users')).toBeInTheDocument();
    });
  });

  describe('non-admin redirect', () => {
    it('should redirect regular user to 403', () => {
      const regularUser: User = {
        id: 'user-1',
        email: 'user@example.com',
        name: 'Regular User',
        role: 'user',
      };

      render(
        <TestWrapper user={regularUser}>
          <AdminRoute>
            <div data-testid="admin-content">Admin Only Content</div>
          </AdminRoute>
        </TestWrapper>
      );

      expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();
      expect(screen.getByTestId('redirect')).toHaveAttribute('data-to', '/403');
    });

    it('should redirect leader to 403', () => {
      const leaderUser: User = {
        id: 'leader-1',
        email: 'leader@example.com',
        name: 'Leader User',
        role: 'leader',
      };

      render(
        <TestWrapper user={leaderUser}>
          <AdminRoute>
            <div data-testid="admin-content">Admin Only Content</div>
          </AdminRoute>
        </TestWrapper>
      );

      expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();
      expect(screen.getByTestId('redirect')).toHaveAttribute('data-to', '/403');
    });

    it('should redirect unauthenticated user to 403', () => {
      render(
        <TestWrapper user={null}>
          <AdminRoute>
            <div data-testid="admin-content">Admin Only Content</div>
          </AdminRoute>
        </TestWrapper>
      );

      expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();
      expect(screen.getByTestId('redirect')).toHaveAttribute('data-to', '/403');
    });
  });

  describe('loading state', () => {
    it('should render nothing while loading', () => {
      render(
        <TestWrapper user={null} isLoading={true}>
          <AdminRoute>
            <div data-testid="admin-content">Admin Only Content</div>
          </AdminRoute>
        </TestWrapper>
      );

      expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();
      expect(screen.queryByTestId('redirect')).not.toBeInTheDocument();
    });

    it('should render content after loading completes for admin', () => {
      const adminUser: User = {
        id: 'admin-1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin',
      };

      const { rerender } = render(
        <TestWrapper user={null} isLoading={true}>
          <AdminRoute>
            <div data-testid="admin-content">Admin Only Content</div>
          </AdminRoute>
        </TestWrapper>
      );

      expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();

      rerender(
        <TestWrapper user={adminUser} isLoading={false}>
          <AdminRoute>
            <div data-testid="admin-content">Admin Only Content</div>
          </AdminRoute>
        </TestWrapper>
      );

      expect(screen.getByTestId('admin-content')).toBeInTheDocument();
    });
  });
});
