/**
 * @fileoverview Test utilities and custom render functions.
 * 
 * Provides:
 * - Custom render with all providers (Router, Settings, Auth, Ragflow)
 * - Mock data factories for users, configs, etc.
 * - Common test helpers
 */

import React, { ReactElement, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

// ============================================================================
// Types
// ============================================================================

export interface MockUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'leader' | 'user';
  avatar?: string;
}

export interface MockRagflowConfig {
  aiChatUrl: string;
  aiSearchUrl: string;
  chatSources: Array<{ id: string; name: string; url: string }>;
  searchSources: Array<{ id: string; name: string; url: string }>;
}

// ============================================================================
// Mock Data Factories
// ============================================================================

/**
 * Create a mock user object.
 */
export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    role: 'user',
    ...overrides,
  };
}

/**
 * Create a mock admin user.
 */
export function createMockAdmin(overrides: Partial<MockUser> = {}): MockUser {
  return createMockUser({
    id: 'admin-1',
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'admin',
    ...overrides,
  });
}

/**
 * Create a mock leader user.
 */
export function createMockLeader(overrides: Partial<MockUser> = {}): MockUser {
  return createMockUser({
    id: 'leader-1',
    email: 'leader@example.com',
    name: 'Leader User',
    role: 'leader',
    ...overrides,
  });
}

/**
 * Create mock RAGFlow configuration.
 */
export function createMockRagflowConfig(overrides: Partial<MockRagflowConfig> = {}): MockRagflowConfig {
  return {
    aiChatUrl: 'https://ragflow.example.com/chat',
    aiSearchUrl: 'https://ragflow.example.com/search',
    chatSources: [
      { id: 'chat-1', name: 'General Chat', url: 'https://ragflow.example.com/chat/1' },
      { id: 'chat-2', name: 'Technical Chat', url: 'https://ragflow.example.com/chat/2' },
    ],
    searchSources: [
      { id: 'search-1', name: 'General Search', url: 'https://ragflow.example.com/search/1' },
    ],
    ...overrides,
  };
}

// ============================================================================
// Mock Context Values
// ============================================================================

/**
 * Default mock auth context value.
 */
export const mockAuthContextValue = {
  user: null as MockUser | null,
  isAuthenticated: false,
  isLoading: false,
  checkSession: vi.fn(),
  logout: vi.fn(),
};

/**
 * Default mock settings context value.
 */
export const mockSettingsContextValue = {
  theme: 'light' as const,
  setTheme: vi.fn(),
  language: 'en' as const,
  setLanguage: vi.fn(),
  isDarkMode: false,
  resolvedTheme: 'light' as const,
  isSettingsOpen: false,
  openSettings: vi.fn(),
  closeSettings: vi.fn(),
};

/**
 * Default mock ragflow context value.
 */
export const mockRagflowContextValue = {
  config: null as MockRagflowConfig | null,
  selectedChatSourceId: '',
  selectedSearchSourceId: '',
  setSelectedChatSource: vi.fn(),
  setSelectedSearchSource: vi.fn(),
  isLoading: false,
  error: null as string | null,
};

// ============================================================================
// Mock Context Providers
// ============================================================================

// Create mock contexts
export const MockAuthContext = React.createContext(mockAuthContextValue);
export const MockSettingsContext = React.createContext(mockSettingsContextValue);
export const MockRagflowContext = React.createContext(mockRagflowContextValue);

// ============================================================================
// Custom Render Options
// ============================================================================

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Initial route for MemoryRouter */
  initialRoute?: string;
  /** Use BrowserRouter instead of MemoryRouter */
  useBrowserRouter?: boolean;
  /** Auth context overrides */
  authValue?: Partial<typeof mockAuthContextValue>;
  /** Settings context overrides */
  settingsValue?: Partial<typeof mockSettingsContextValue>;
  /** Ragflow context overrides */
  ragflowValue?: Partial<typeof mockRagflowContextValue>;
}

/**
 * Custom render with all providers.
 * Use this for integration tests that need full context.
 */
export function renderWithProviders(
  ui: ReactElement,
  options: CustomRenderOptions = {}
) {
  const {
    initialRoute = '/',
    useBrowserRouter = false,
    authValue = {},
    settingsValue = {},
    ragflowValue = {},
    ...renderOptions
  } = options;

  const authContext = { ...mockAuthContextValue, ...authValue };
  const settingsContext = { ...mockSettingsContextValue, ...settingsValue };
  const ragflowContext = { ...mockRagflowContextValue, ...ragflowValue };

  const Router = useBrowserRouter ? BrowserRouter : MemoryRouter;
  const routerProps = useBrowserRouter ? {} : { initialEntries: [initialRoute] };

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Router {...routerProps}>
        <MockSettingsContext.Provider value={settingsContext}>
          <MockAuthContext.Provider value={authContext}>
            <MockRagflowContext.Provider value={ragflowContext}>
              {children}
            </MockRagflowContext.Provider>
          </MockAuthContext.Provider>
        </MockSettingsContext.Provider>
      </Router>
    );
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    authContext,
    settingsContext,
    ragflowContext,
  };
}

/**
 * Simple render with router only.
 * Use for components that only need routing.
 */
export function renderWithRouter(
  ui: ReactElement,
  options: { initialRoute?: string } = {}
) {
  const { initialRoute = '/' } = options;

  function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[initialRoute]}>{children}</MemoryRouter>;
  }

  return render(ui, { wrapper: Wrapper });
}

// ============================================================================
// Async Test Helpers
// ============================================================================

/**
 * Wait for a condition to be true.
 */
export async function waitFor(
  condition: () => boolean,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 1000, interval = 50 } = options;
  const start = Date.now();

  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error('waitFor timeout exceeded');
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

/**
 * Create a mock fetch response.
 */
export function createMockResponse(data: any, options: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
}

/**
 * Mock fetch to return specific data.
 */
export function mockFetch(data: any, options: ResponseInit = {}) {
  return vi.fn().mockResolvedValue(createMockResponse(data, options));
}

/**
 * Mock fetch to reject with an error.
 */
export function mockFetchError(message: string) {
  return vi.fn().mockRejectedValue(new Error(message));
}

// ============================================================================
// Re-export testing-library
// ============================================================================

export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
