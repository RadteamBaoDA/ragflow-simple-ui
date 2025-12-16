/**
 * @fileoverview Tests for LoginPage component.
 * 
 * Tests:
 * - Microsoft sign-in button
 * - Root login dialog
 * - Theme handling
 * - Loading state
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import LoginPage from '../../src/pages/LoginPage';

// ============================================================================
// Mocks
// ============================================================================

// Mock useAuth hook
const mockUseAuth = vi.fn();
vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock useSettings hook
const mockUseSettings = vi.fn();
vi.mock('../../src/contexts/SettingsContext', () => ({
  useSettings: () => mockUseSettings(),
}));

// Mock useNavigate
const mockNavigate = vi.fn();

// Mock useSearchParams - returns a URLSearchParams-like object
let mockSearchParams = new URLSearchParams();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams, vi.fn()],
  };
});

// ============================================================================
// Test Helpers
// ============================================================================

interface TestConfig {
  isAuthenticated?: boolean;
  isLoading?: boolean;
  resolvedTheme?: 'light' | 'dark';
  errorParam?: string;
  redirectParam?: string;
}

function renderLoginPage(config: TestConfig = {}) {
  const {
    isAuthenticated = false,
    isLoading = false,
    resolvedTheme = 'light',
    errorParam = '',
    redirectParam = '',
  } = config;

  mockUseAuth.mockReturnValue({
    isAuthenticated,
    isLoading,
  });

  mockUseSettings.mockReturnValue({
    resolvedTheme,
  });

  // Set up search params mock
  mockSearchParams = new URLSearchParams();
  if (errorParam) {
    mockSearchParams.set('error', errorParam);
  }
  if (redirectParam) {
    mockSearchParams.set('redirect', redirectParam);
  }

  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
      </Routes>
    </MemoryRouter>
  );
}

// ============================================================================
// Tests
// ============================================================================

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.classList.remove('dark');
    // Mock fetch for auth config
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ enableRootLogin: false }),
    });
  });

  describe('rendering', () => {
    it('should render login page', () => {
      renderLoginPage();

      // Check for Microsoft sign-in button
      expect(screen.getByRole('button', { name: /login.signInMicrosoft/i })).toBeInTheDocument();
    });

    it('should render logo', () => {
      renderLoginPage();

      expect(screen.getByRole('img', { name: /knowledge base/i })).toBeInTheDocument();
    });

    it('should render Microsoft sign-in button', () => {
      renderLoginPage();

      expect(screen.getByRole('button', { name: /login.signInMicrosoft/i })).toBeInTheDocument();
    });

    it('should render sign-in prompt', () => {
      renderLoginPage();

      expect(screen.getByText('login.signInPrompt')).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('should show loading when checking session', () => {
      renderLoginPage({ isLoading: true });

      expect(screen.getByText('common.checkingSession')).toBeInTheDocument();
    });

    it('should not show login form when loading', () => {
      renderLoginPage({ isLoading: true });

      expect(screen.queryByRole('button', { name: /login.signInMicrosoft/i })).not.toBeInTheDocument();
    });
  });

  describe('authentication redirect', () => {
    it('should redirect when already authenticated', async () => {
      renderLoginPage({ isAuthenticated: true });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/ai-chat', { replace: true });
      });
    });

    it('should redirect to custom location when redirect param provided', async () => {
      renderLoginPage({ isAuthenticated: true, redirectParam: '/custom-page' });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/custom-page', { replace: true });
      });
    });
  });

  describe('Microsoft sign-in', () => {
    it('should redirect to login URL when sign-in button clicked', async () => {
      const user = userEvent.setup();

      // Mock window.location.href
      const originalLocation = window.location;
      // @ts-expect-error - Mocking location
      delete window.location;
      window.location = { ...originalLocation, href: '', origin: 'http://localhost' };

      renderLoginPage();

      const signInButton = screen.getByRole('button', { name: /login.signInMicrosoft/i });
      await user.click(signInButton);

      expect(window.location.href).toContain('/api/auth/login');
      expect(window.location.href).toContain('redirect=');

      // Restore
      window.location = originalLocation;
    });
  });

  describe('root login', () => {
    beforeEach(() => {
      // Enable root login in config
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ enableRootLogin: true }),
      });
    });

    it('should not show root login button by default', () => {
      // With enableRootLogin: false
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ enableRootLogin: false }),
      });

      renderLoginPage();

      expect(screen.queryByRole('button', { name: /login.rootLogin/i })).not.toBeInTheDocument();
    });

    it('should show root login button when enabled', async () => {
      renderLoginPage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /login.rootLogin/i })).toBeInTheDocument();
      });
    });

    it('should open root login dialog', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /login.rootLogin/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /login.rootLogin/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('should render username and password inputs in dialog', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /login.rootLogin/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /login.rootLogin/i }));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('admin@localhost')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
      });
    });

    it('should update username input', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /login.rootLogin/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /login.rootLogin/i }));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('admin@localhost')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('admin@localhost') as HTMLInputElement;
      await user.type(input, 'admin@test.com');

      expect(input.value).toBe('admin@test.com');
    });

    it('should update password input', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /login.rootLogin/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /login.rootLogin/i }));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('••••••••') as HTMLInputElement;
      await user.type(input, 'password123');

      expect(input.value).toBe('password123');
    });

    it('should submit root login and handle success', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      // Wait for root login to be enabled
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /login.rootLogin/i })).toBeInTheDocument();
      });

      // Open dialog
      await user.click(screen.getByRole('button', { name: /login.rootLogin/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Fill in credentials
      const usernameInput = screen.getByPlaceholderText('admin@localhost');
      const passwordInput = screen.getByPlaceholderText('••••••••');
      await user.type(usernameInput, 'admin');
      await user.type(passwordInput, 'password');

      // Mock successful login response
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      // Click login button
      const loginButton = screen.getByRole('button', { name: /common.login/i });
      await user.click(loginButton);

      // Verify fetch was called with credentials
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });

    it('should show error on failed root login', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      // Wait for root login to be enabled
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /login.rootLogin/i })).toBeInTheDocument();
      });

      // Open dialog
      await user.click(screen.getByRole('button', { name: /login.rootLogin/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Mock failed login response
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Invalid credentials' }),
      });

      // Click login button
      const loginButton = screen.getByRole('button', { name: /common.login/i });
      await user.click(loginButton);

      // Verify error is shown
      await waitFor(() => {
        expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
      });
    });

    it('should show default error on failed root login without error message', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      // Wait for root login to be enabled
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /login.rootLogin/i })).toBeInTheDocument();
      });

      // Open dialog
      await user.click(screen.getByRole('button', { name: /login.rootLogin/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Mock failed login response without error message
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({}),
      });

      // Click login button
      const loginButton = screen.getByRole('button', { name: /common.login/i });
      await user.click(loginButton);

      // Verify default error is shown
      await waitFor(() => {
        expect(screen.getByText('login.error')).toBeInTheDocument();
      });
    });

    it('should show default error on network failure', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      // Wait for root login to be enabled
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /login.rootLogin/i })).toBeInTheDocument();
      });

      // Open dialog
      await user.click(screen.getByRole('button', { name: /login.rootLogin/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Mock network failure
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

      // Click login button
      const loginButton = screen.getByRole('button', { name: /common.login/i });
      await user.click(loginButton);

      // Verify error is shown
      await waitFor(() => {
        expect(screen.getByText('login.error')).toBeInTheDocument();
      });
    });

    it('should close root login dialog on cancel', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      // Wait for root login to be enabled
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /login.rootLogin/i })).toBeInTheDocument();
      });

      // Open dialog
      await user.click(screen.getByRole('button', { name: /login.rootLogin/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Click cancel button
      const cancelButton = screen.getByRole('button', { name: /common.cancel/i });
      await user.click(cancelButton);

      // Dialog should be closed
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('should close root login dialog on escape key', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      // Wait for root login to be enabled
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /login.rootLogin/i })).toBeInTheDocument();
      });

      // Open dialog
      await user.click(screen.getByRole('button', { name: /login.rootLogin/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Press Escape key to close dialog
      await user.keyboard('{Escape}');

      // Dialog should be closed
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('error display', () => {
    it('should display error from URL params', async () => {
      renderLoginPage({ errorParam: 'OAuth failed' });

      // The error displays with translation key 'login.error' and the error message
      await waitFor(() => {
        expect(screen.getByText(/login.error/)).toBeInTheDocument();
        expect(screen.getByText(/OAuth failed/)).toBeInTheDocument();
      });
    });

    it('should not display error when no error param', () => {
      renderLoginPage();

      // No error message container should be displayed (the red bg div)
      const errorDivs = document.querySelectorAll('.bg-red-50');
      expect(errorDivs.length).toBe(0);
    });
  });

  describe('fetch config error handling', () => {
    it('should handle config fetch failure gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Failed'));

      renderLoginPage();

      // Root login should not appear since config fetch failed
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /login.rootLogin/i })).not.toBeInTheDocument();
      });
    });

    it('should handle non-ok config response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Server error' }),
      });

      renderLoginPage();

      // Root login should not appear since config response was not ok
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /login.rootLogin/i })).not.toBeInTheDocument();
      });
    });
  });

  describe('theme handling', () => {
    it('should use light logo for light theme', () => {
      renderLoginPage({ resolvedTheme: 'light' });

      const logo = screen.getByRole('img', { name: /knowledge base/i }) as HTMLImageElement;
      expect(logo.src).toContain('logo.png');
      expect(logo.src).not.toContain('logo-dark.png');
    });

    it('should use dark logo for dark theme', () => {
      renderLoginPage({ resolvedTheme: 'dark' });

      const logo = screen.getByRole('img', { name: /knowledge base/i }) as HTMLImageElement;
      expect(logo.src).toContain('logo-dark.png');
    });

    it('should apply dark class for dark theme', () => {
      renderLoginPage({ resolvedTheme: 'dark' });

      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('should remove dark class for light theme', () => {
      document.documentElement.classList.add('dark');

      renderLoginPage({ resolvedTheme: 'light' });

      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });
});
