/**
 * @fileoverview Test setup file for Vitest.
 * 
 * This file is run before each test file and configures:
 * - Global mocks for database operations
 * - Mock implementations for external services
 * - Common test utilities
 */

import { vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// GLOBAL MOCKS
// ============================================================================

// Mock logger service to prevent console output during tests
vi.mock('../src/shared/services/logger.service.js', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock database module
vi.mock('../src/shared/db/index.js', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  getClient: vi.fn(),
  getAdapter: vi.fn(),
  closePool: vi.fn(),
  checkConnection: vi.fn(),
  db: {
    query: vi.fn(),
    queryOne: vi.fn(),
    getClient: vi.fn(),
  },
}));

// ============================================================================
// LIFECYCLE HOOKS
// ============================================================================

beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks();
});

afterEach(() => {
  // Reset all mocks after each test
  vi.resetAllMocks();
});

// ============================================================================
// GLOBAL TEST UTILITIES
// ============================================================================

/**
 * Create a mock Express request object
 */
export function createMockRequest(overrides: Partial<any> = {}): any {
  return {
    session: {},
    sessionID: 'test-session-id',
    params: {},
    query: {},
    body: {},
    path: '/test',
    method: 'GET',
    ip: '127.0.0.1',
    headers: {},
    ...overrides,
  };
}

/**
 * Create a mock Express response object
 */
export function createMockResponse(): any {
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    redirect: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
  };
  return res;
}

/**
 * Create a mock next function
 */
export function createMockNext(): any {
  return vi.fn();
}

/**
 * Create a mock user object for testing
 */
export function createMockUser(overrides: Partial<any> = {}): any {
  return {
    id: 'test-user-id',
    email: 'test@example.com',
    displayName: 'Test User',
    role: 'user',
    permissions: [],
    ...overrides,
  };
}

/**
 * Create a mock Azure AD user object
 */
export function createMockAzureAdUser(overrides: Partial<any> = {}): any {
  return {
    id: 'azure-ad-user-id',
    email: 'azure@example.com',
    displayName: 'Azure AD User',
    department: 'IT Department',
    jobTitle: 'Developer',
    mobilePhone: '+1234567890',
    ...overrides,
  };
}
