/**
 * @fileoverview Tests for RoleRoute component.
 * 
 * Tests:
 * - Allowed roles access
 * - Disallowed roles redirect
 * - Loading state
 * - Multiple roles
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React, { createContext, useContext, ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';

// ============================================================================
// Types
// ============================================================================

type Role = 'admin' | 'manager' | 'user';

interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
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
// Mock RoleRoute Component
// ============================================================================

interface RoleRouteProps {
  children: ReactNode;
  allowedRoles: Role[];
}

function RoleRoute({ children, allowedRoles }: RoleRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!user || !allowedRoles.includes(user.role)) {
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

function TestWrapper({ children, user = null, isLoading = false, initialRoute = '/protected' }: TestWrapperProps) {
  return (
    <AuthContext.Provider value={{ user, isLoading }}>
      <MemoryRouter initialEntries={[initialRoute]}>
        {children}
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

// Test users
const adminUser: User = { id: 'admin-1', email: 'admin@example.com', name: 'Admin', role: 'admin' };
const managerUser: User = { id: 'manager-1', email: 'manager@example.com', name: 'Manager', role: 'manager' };
const regularUser: User = { id: 'user-1', email: 'user@example.com', name: 'User', role: 'user' };

// ============================================================================
// Tests
// ============================================================================

describe('RoleRoute', () => {
  describe('single role access', () => {
    it('should allow admin for admin-only route', () => {
      render(
        <TestWrapper user={adminUser}>
          <RoleRoute allowedRoles={['admin']}>
            <div data-testid="content">Protected Content</div>
          </RoleRoute>
        </TestWrapper>
      );

      expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    it('should allow manager for manager-only route', () => {
      render(
        <TestWrapper user={managerUser}>
          <RoleRoute allowedRoles={['manager']}>
            <div data-testid="content">Manager Content</div>
          </RoleRoute>
        </TestWrapper>
      );

      expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    it('should allow user for user-only route', () => {
      render(
        <TestWrapper user={regularUser}>
          <RoleRoute allowedRoles={['user']}>
            <div data-testid="content">User Content</div>
          </RoleRoute>
        </TestWrapper>
      );

      expect(screen.getByTestId('content')).toBeInTheDocument();
    });
  });

  describe('multiple roles access', () => {
    it('should allow admin for admin+manager route', () => {
      render(
        <TestWrapper user={adminUser}>
          <RoleRoute allowedRoles={['admin', 'manager']}>
            <div data-testid="content">Content</div>
          </RoleRoute>
        </TestWrapper>
      );

      expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    it('should allow manager for admin+manager route', () => {
      render(
        <TestWrapper user={managerUser}>
          <RoleRoute allowedRoles={['admin', 'manager']}>
            <div data-testid="content">Content</div>
          </RoleRoute>
        </TestWrapper>
      );

      expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    it('should allow any role for all roles route', () => {
      render(
        <TestWrapper user={regularUser}>
          <RoleRoute allowedRoles={['admin', 'manager', 'user']}>
            <div data-testid="content">Content</div>
          </RoleRoute>
        </TestWrapper>
      );

      expect(screen.getByTestId('content')).toBeInTheDocument();
    });
  });

  describe('unauthorized redirect', () => {
    it('should redirect user from admin-only route', () => {
      render(
        <TestWrapper user={regularUser}>
          <RoleRoute allowedRoles={['admin']}>
            <div data-testid="content">Admin Content</div>
          </RoleRoute>
        </TestWrapper>
      );

      expect(screen.queryByTestId('content')).not.toBeInTheDocument();
      expect(screen.getByTestId('redirect')).toHaveAttribute('data-to', '/403');
    });

    it('should redirect user from admin+manager route', () => {
      render(
        <TestWrapper user={regularUser}>
          <RoleRoute allowedRoles={['admin', 'manager']}>
            <div data-testid="content">Content</div>
          </RoleRoute>
        </TestWrapper>
      );

      expect(screen.queryByTestId('content')).not.toBeInTheDocument();
      expect(screen.getByTestId('redirect')).toHaveAttribute('data-to', '/403');
    });

    it('should redirect manager from admin-only route', () => {
      render(
        <TestWrapper user={managerUser}>
          <RoleRoute allowedRoles={['admin']}>
            <div data-testid="content">Admin Content</div>
          </RoleRoute>
        </TestWrapper>
      );

      expect(screen.queryByTestId('content')).not.toBeInTheDocument();
      expect(screen.getByTestId('redirect')).toHaveAttribute('data-to', '/403');
    });
  });

  describe('unauthenticated user', () => {
    it('should redirect unauthenticated user', () => {
      render(
        <TestWrapper user={null}>
          <RoleRoute allowedRoles={['user']}>
            <div data-testid="content">Content</div>
          </RoleRoute>
        </TestWrapper>
      );

      expect(screen.queryByTestId('content')).not.toBeInTheDocument();
      expect(screen.getByTestId('redirect')).toHaveAttribute('data-to', '/403');
    });

    it('should redirect unauthenticated user even with all roles allowed', () => {
      render(
        <TestWrapper user={null}>
          <RoleRoute allowedRoles={['admin', 'manager', 'user']}>
            <div data-testid="content">Content</div>
          </RoleRoute>
        </TestWrapper>
      );

      expect(screen.queryByTestId('content')).not.toBeInTheDocument();
      expect(screen.getByTestId('redirect')).toHaveAttribute('data-to', '/403');
    });
  });

  describe('loading state', () => {
    it('should render nothing while loading', () => {
      render(
        <TestWrapper user={null} isLoading={true}>
          <RoleRoute allowedRoles={['admin']}>
            <div data-testid="content">Content</div>
          </RoleRoute>
        </TestWrapper>
      );

      expect(screen.queryByTestId('content')).not.toBeInTheDocument();
      expect(screen.queryByTestId('redirect')).not.toBeInTheDocument();
    });

    it('should render content after loading for authorized user', () => {
      const { rerender } = render(
        <TestWrapper user={null} isLoading={true}>
          <RoleRoute allowedRoles={['admin']}>
            <div data-testid="content">Content</div>
          </RoleRoute>
        </TestWrapper>
      );

      expect(screen.queryByTestId('content')).not.toBeInTheDocument();

      rerender(
        <TestWrapper user={adminUser} isLoading={false}>
          <RoleRoute allowedRoles={['admin']}>
            <div data-testid="content">Content</div>
          </RoleRoute>
        </TestWrapper>
      );

      expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    it('should redirect after loading for unauthorized user', () => {
      const { rerender } = render(
        <TestWrapper user={null} isLoading={true}>
          <RoleRoute allowedRoles={['admin']}>
            <div data-testid="content">Content</div>
          </RoleRoute>
        </TestWrapper>
      );

      expect(screen.queryByTestId('redirect')).not.toBeInTheDocument();

      rerender(
        <TestWrapper user={regularUser} isLoading={false}>
          <RoleRoute allowedRoles={['admin']}>
            <div data-testid="content">Content</div>
          </RoleRoute>
        </TestWrapper>
      );

      expect(screen.getByTestId('redirect')).toHaveAttribute('data-to', '/403');
    });
  });

  describe('empty allowed roles', () => {
    it('should redirect all users when allowedRoles is empty', () => {
      render(
        <TestWrapper user={adminUser}>
          <RoleRoute allowedRoles={[]}>
            <div data-testid="content">Content</div>
          </RoleRoute>
        </TestWrapper>
      );

      expect(screen.queryByTestId('content')).not.toBeInTheDocument();
      expect(screen.getByTestId('redirect')).toHaveAttribute('data-to', '/403');
    });
  });
});
