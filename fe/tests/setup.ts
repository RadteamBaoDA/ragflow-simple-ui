/**
 * @fileoverview Vitest setup file for frontend tests.
 * 
 * Configures global test environment:
 * - Extends expect with testing-library matchers
 * - Mocks browser APIs (matchMedia, fetch, localStorage, etc.)
 * - Mocks i18next for translation testing
 * - Provides test utilities and cleanup
 */

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, vi } from 'vitest';

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Cleanup after each test to prevent memory leaks and test pollution.
 */
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ============================================================================
// Browser API Mocks
// ============================================================================

/**
 * Mock window.matchMedia for responsive/theme tests.
 */
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // Deprecated
    removeListener: vi.fn(), // Deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

/**
 * Mock localStorage for settings persistence tests.
 */
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

/**
 * Mock sessionStorage.
 */
Object.defineProperty(window, 'sessionStorage', {
  value: localStorageMock,
});

/**
 * Mock ResizeObserver for component tests that use it.
 */
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

/**
 * Mock IntersectionObserver for lazy loading/infinite scroll tests.
 */
class IntersectionObserverMock {
  constructor(callback: IntersectionObserverCallback) {
    // Store callback if needed for tests
  }
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  root = null;
  rootMargin = '';
  thresholds = [];
  takeRecords = vi.fn(() => []);
}

global.IntersectionObserver = IntersectionObserverMock as unknown as typeof IntersectionObserver;

/**
 * Mock scrollTo for navigation tests.
 */
window.scrollTo = vi.fn();

/**
 * Mock fetch globally (can be overridden in individual tests).
 */
global.fetch = vi.fn();

// ============================================================================
// IndexedDB Mock
// ============================================================================

/**
 * Simple IndexedDB mock for userPreferences service tests.
 */
const indexedDBMock = {
  open: vi.fn().mockImplementation(() => {
    const request = {
      result: {
        objectStoreNames: { contains: vi.fn(() => false) },
        createObjectStore: vi.fn(),
        transaction: vi.fn().mockReturnValue({
          objectStore: vi.fn().mockReturnValue({
            get: vi.fn().mockReturnValue({
              onsuccess: null,
              onerror: null,
              result: undefined,
            }),
            put: vi.fn().mockReturnValue({
              onsuccess: null,
              onerror: null,
            }),
          }),
        }),
      },
      onsuccess: null as ((event: any) => void) | null,
      onerror: null as ((event: any) => void) | null,
      onupgradeneeded: null as ((event: any) => void) | null,
    };
    
    // Simulate async open
    setTimeout(() => {
      if (request.onsuccess) {
        request.onsuccess({ target: request } as any);
      }
    }, 0);
    
    return request;
  }),
  deleteDatabase: vi.fn(),
};

Object.defineProperty(window, 'indexedDB', {
  value: indexedDBMock,
  writable: true,
});

// ============================================================================
// BroadcastChannel Mock
// ============================================================================

/**
 * Mock BroadcastChannel for cross-tab communication tests.
 */
class BroadcastChannelMock {
  name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;

  constructor(name: string) {
    this.name = name;
  }

  postMessage = vi.fn();
  close = vi.fn();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  dispatchEvent = vi.fn(() => true);
}

global.BroadcastChannel = BroadcastChannelMock as unknown as typeof BroadcastChannel;

// ============================================================================
// i18n Mock
// ============================================================================

/**
 * Mock i18next module.
 */
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, any>) => {
      // Return key with params for testing
      if (params) {
        return `${key}:${JSON.stringify(params)}`;
      }
      return key;
    },
    i18n: {
      language: 'en',
      changeLanguage: vi.fn(),
    },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn(),
  },
}));

// ============================================================================
// React Router Mock
// ============================================================================

// Provide a default mock for `lucide-react` icons to avoid missing export errors in tests.
// The mock uses a Proxy to return a no-op component for any requested icon name.
vi.mock('lucide-react', () => {
  const NullIcon = () => null;
  const factory = { default: NullIcon } as Record<string | symbol, any>;
  return new Proxy(factory, {
    get: (target, prop) => {
      if (prop in target) return (target as any)[prop];
      return NullIcon;
    }
  });
});

const mockNavigate = vi.fn();
const mockLocation = { pathname: '/', search: '', hash: '', state: null };
const mockSearchParams = new URLSearchParams();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockLocation,
    useSearchParams: () => [mockSearchParams, vi.fn()],
  };
});

// Mock Headless UI to avoid animation/transition delays in tests
vi.mock('@headlessui/react', () => {
  const React = require('react') as typeof import('react')
  function Dialog(props: any) { return React.createElement(React.Fragment, null, props.children) }
  function DialogPanel(props: any) { return React.createElement('div', { className: props.className }, props.children) }
  function DialogTitle(props: any) { return React.createElement('div', null, props.children) }
  const Transition = (props: any) => props.children
  const TransitionChild = (props: any) => props.children
  return { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } as any
});

// ============================================================================
// Test Utilities Export
// ============================================================================

/**
 * Reset all mocks to their initial state.
 * Call this in beforeEach if needed.
 */
export function resetMocks() {
  vi.clearAllMocks();
  localStorageMock.clear();
  mockNavigate.mockReset();
}

/**
 * Get the mock navigate function for assertions.
 */
export function getMockNavigate() {
  return mockNavigate;
}

/**
 * Set mock location for tests.
 */
export function setMockLocation(location: Partial<typeof mockLocation>) {
  Object.assign(mockLocation, location);
}

/**
 * Set mock search params for tests.
 */
export function setMockSearchParams(params: Record<string, string>) {
  for (const [key, value] of Object.entries(params)) {
    mockSearchParams.set(key, value);
  }
}

// ============================================================================
// Console Suppression (optional)
// ============================================================================

/**
 * Suppress specific console warnings during tests.
 * Uncomment if needed to reduce test noise.
 */
// const originalConsoleError = console.error;
// beforeAll(() => {
//   console.error = (...args: any[]) => {
//     if (
//       typeof args[0] === 'string' &&
//       (args[0].includes('Warning: ReactDOM.render') ||
//         args[0].includes('act(...)'))
//     ) {
//       return;
//     }
//     originalConsoleError.call(console, ...args);
//   };
// });
