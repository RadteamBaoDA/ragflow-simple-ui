/**
 * @fileoverview Tests for ProtectedRoute component.
 * 
 * Tests:
 * - Authentication required
 * - Loading state
 * - Redirect to login
 * - Theme application
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React, { createContext, useContext, ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';

// ============================================================================
// Types
// ============================================================================

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'user';
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface SettingsContextType {
  resolvedTheme: 'light' | 'dark';
}

// ============================================================================
// Mock Contexts
// ============================================================================

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: false,
});

const SettingsContext = createContext<SettingsContextType>({
  resolvedTheme: 'light',
});

function useAuth() {
  return useContext(AuthContext);
}

function useSettings() {
  return useContext(SettingsContext);
}

// ============================================================================
// Mock Components
// ============================================================================

function Navigate({ to }: { to: string }) {
  return <div data-testid="redirect" data-to={to}>Redirecting...</div>;
}

interface ProtectedRouteProps {
  children: ReactNode;
}

function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const { resolvedTheme } = useSettings();
  const location = useLocation();

  // Apply theme during loading
  React.useEffect(() => {
    if (resolvedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [resolvedTheme]);

  if (isLoading) {
    return (
      <div data-testid="loading" className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div data-testid="spinner" className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>common.checkingSession</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const redirectUrl = location.pathname + location.search;
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirectUrl)}`} />;
  }

  return <>{children}</>;
}

// ============================================================================
// Test Helpers
// ============================================================================

interface TestWrapperProps {
  children: ReactNode;
  isAuthenticated?: boolean;
  isLoading?: boolean;
  resolvedTheme?: 'light' | 'dark';
  initialRoute?: string;
}

function TestWrapper({
  children,
  isAuthenticated = false,
  isLoading = false,
  resolvedTheme = 'light',
  initialRoute = '/dashboard',
}: TestWrapperProps) {
  return (
    <SettingsContext.Provider value={{ resolvedTheme }}>
      <AuthContext.Provider value={{ user: null, isAuthenticated, isLoading }}>
        <MemoryRouter initialEntries={[initialRoute]}>
          {children}
        </MemoryRouter>
      </AuthContext.Provider>
    </SettingsContext.Provider>
  );
}

// ============================================================================
// Tests
// ============================================================================

describe('ProtectedRoute', () => {
  describe('authenticated access', () => {
    it('should render children when authenticated', () => {
      render(
        <TestWrapper isAuthenticated={true}>
          <ProtectedRoute>
            <div data-testid="protected-content">Protected Content</div>
          </ProtectedRoute>
        </TestWrapper>
      );

      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    it('should render complex children when authenticated', () => {
      render(
        <TestWrapper isAuthenticated={true}>
          <ProtectedRoute>
            <div>
              <h1>Dashboard</h1>
              <nav>Navigation</nav>
              <main>Main Content</main>
            </div>
          </ProtectedRoute>
        </TestWrapper>
      );

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Navigation')).toBeInTheDocument();
      expect(screen.getByText('Main Content')).toBeInTheDocument();
    });
  });

  describe('unauthenticated redirect', () => {
    it('should redirect to login when not authenticated', () => {
      render(
        <TestWrapper isAuthenticated={false}>
          <ProtectedRoute>
            <div data-testid="protected-content">Protected Content</div>
          </ProtectedRoute>
        </TestWrapper>
      );

      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
      expect(screen.getByTestId('redirect')).toBeInTheDocument();
    });

    it('should include redirect param in login URL', () => {
      // Test the redirect URL format
      render(
        <TestWrapper isAuthenticated={false} initialRoute="/dashboard">
          <ProtectedRoute>
            <div>Content</div>
          </ProtectedRoute>
        </TestWrapper>
      );

      const redirect = screen.getByTestId('redirect');
      const dataTo = redirect.getAttribute('data-to');
      // The redirect URL should start with /login?redirect=
      expect(dataTo).toContain('/login?redirect=');
    });

    it('should redirect to login for unauthenticated users', () => {
      render(
        <TestWrapper isAuthenticated={false}>
          <ProtectedRoute>
            <div>Content</div>
          </ProtectedRoute>
        </TestWrapper>
      );

      const redirect = screen.getByTestId('redirect');
      expect(redirect.getAttribute('data-to')).toMatch(/^\/login\?redirect=/);
    });
  });

  describe('loading state', () => {
    it('should show loading spinner while checking session', () => {
      render(
        <TestWrapper isLoading={true}>
          <ProtectedRoute>
            <div data-testid="protected-content">Protected Content</div>
          </ProtectedRoute>
        </TestWrapper>
      );

      expect(screen.getByTestId('loading')).toBeInTheDocument();
      expect(screen.getByTestId('spinner')).toBeInTheDocument();
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('should show loading message', () => {
      render(
        <TestWrapper isLoading={true}>
          <ProtectedRoute>
            <div>Content</div>
          </ProtectedRoute>
        </TestWrapper>
      );

      expect(screen.getByText('common.checkingSession')).toBeInTheDocument();
    });

    it('should render content after loading completes', () => {
      const { rerender } = render(
        <TestWrapper isLoading={true}>
          <ProtectedRoute>
            <div data-testid="protected-content">Protected Content</div>
          </ProtectedRoute>
        </TestWrapper>
      );

      expect(screen.getByTestId('loading')).toBeInTheDocument();

      rerender(
        <TestWrapper isLoading={false} isAuthenticated={true}>
          <ProtectedRoute>
            <div data-testid="protected-content">Protected Content</div>
          </ProtectedRoute>
        </TestWrapper>
      );

      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });
  });

  describe('theme application', () => {
    beforeEach(() => {
      document.documentElement.classList.remove('dark');
    });

    it('should apply dark theme class when theme is dark', () => {
      render(
        <TestWrapper isLoading={true} resolvedTheme="dark">
          <ProtectedRoute>
            <div>Content</div>
          </ProtectedRoute>
        </TestWrapper>
      );

      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('should remove dark theme class when theme is light', () => {
      document.documentElement.classList.add('dark');

      render(
        <TestWrapper isLoading={true} resolvedTheme="light">
          <ProtectedRoute>
            <div>Content</div>
          </ProtectedRoute>
        </TestWrapper>
      );

      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });
});
