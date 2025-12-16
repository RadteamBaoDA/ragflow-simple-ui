# Backend Unit Testing Guide

This document describes the unit testing setup for the Knowledge Base backend.

## Overview

The backend uses **Vitest** as the test framework with **v8** for code coverage reporting. Tests are organized to mirror the source code structure under `be/tests/`.

## Quick Start

```bash
# Run all tests
npm run test -w be

# Run tests in watch mode
npm run test:watch -w be

# Run tests with coverage
npm run test:coverage -w be
```

## Test Structure

```
be/tests/
├── setup.ts                           # Global mocks and test utilities
├── config/                            # Configuration tests
│   ├── file-upload.config.test.ts     # File upload settings (31 tests)
│   ├── index.test.ts                  # Config module (30 tests)
│   └── rbac.test.ts                   # Role-based access control (30 tests)
├── db/                                # Database tests
│   └── index.test.ts                  # Database exports (7 tests)
├── middleware/                        # Middleware tests
│   └── auth.middleware.test.ts        # Authentication middleware (32 tests)
├── routes/                            # Route handler tests
│   ├── admin.routes.test.ts           # Admin API (14 tests)
│   ├── audit.routes.test.ts           # Audit logs (14 tests)
│   ├── auth.routes.test.ts            # OAuth flow (11 tests)
│   ├── minio-bucket.routes.test.ts    # Bucket management (26 tests)
│   ├── minio-storage.routes.test.ts   # File operations (30 tests)
│   ├── ragflow.routes.test.ts         # RAGFlow config (5 tests)
│   ├── system-tools.routes.test.ts    # System tools (8 tests)
│   └── user.routes.test.ts            # User management (24 tests)
└── services/                          # Service layer tests
    ├── audit.service.test.ts          # Audit logging (30 tests)
    ├── auth.service.test.ts           # OAuth service (15 tests)
    ├── file-validation.service.test.ts # File validation (54 tests)
    ├── langfuse.service.test.ts       # Langfuse client (6 tests)
    ├── logger.service.test.ts         # Winston logging (7 tests)
    ├── minio.service.test.ts          # MinIO operations (23 tests)
    ├── ragflow.service.test.ts        # RAGFlow config (11 tests)
    ├── system-tools.service.test.ts   # System tools (8 tests)
    └── user.service.test.ts           # User management (23 tests)
```

## Test Statistics

| Category | Files | Tests |
|----------|-------|-------|
| Config | 3 | 91 |
| Database | 1 | 7 |
| Middleware | 1 | 32 |
| Routes | 8 | 132 |
| Services | 9 | 177 |
| **Total** | **22** | **439** |

## Coverage Report

Current coverage metrics (as of last run):

| Metric | Coverage |
|--------|----------|
| Statements | 89.35% |
| Branches | 90.93% |
| Functions | 93.84% |
| Lines | 89.35% |

### Coverage Thresholds

The project enforces minimum coverage thresholds:

- Statements: 50%
- Branches: 50%
- Functions: 50%
- Lines: 50%

### Excluded from Coverage

The following are excluded from coverage calculations:

- `src/index.ts` - Entry point
- `src/scripts/**` - CLI scripts
- `src/db/migrations/**` - Database migrations
- `src/db/adapters/**` - Database adapters (need integration tests)
- `src/db/migrate.ts` - Migration runner
- `src/routes/**` - Route handlers (tested via service layer)
- `src/services/minio.service.ts` - MinIO client (needs real instance)
- `src/services/logger.service.ts` - Winston setup

## Writing Tests

### Test File Naming

Test files should be named `*.test.ts` and placed in the corresponding directory under `tests/`.

### Mocking Dependencies

The `tests/setup.ts` file provides global mocks for common dependencies:

```typescript
// Global database mock
vi.mock('../src/db/index.js', () => ({
    query: vi.fn().mockResolvedValue([]),
    queryOne: vi.fn().mockResolvedValue(undefined),
    db: {
        query: vi.fn().mockResolvedValue([]),
        queryOne: vi.fn().mockResolvedValue(undefined),
        getClient: vi.fn(),
    },
}));

// Global logger mock
vi.mock('../src/services/logger.service.js', () => ({
    log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));
```

### Example Test Structure

```typescript
/**
 * @fileoverview Unit tests for [module name].
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
vi.mock('../../src/services/logger.service.js', () => ({
    log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

describe('ModuleName', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('functionName', () => {
        it('should do something specific', async () => {
            // Arrange
            const input = 'test';

            // Act
            const result = await functionUnderTest(input);

            // Assert
            expect(result).toBe(expectedValue);
        });
    });
});
```

### Testing Patterns

#### Testing Services

Services are tested by mocking their dependencies (database, external APIs) and verifying:

1. Correct function calls to dependencies
2. Proper error handling
3. Return value transformations

```typescript
it('should fetch user by ID', async () => {
    const mockUser = { id: '123', email: 'test@example.com' };
    vi.mocked(queryOne).mockResolvedValue(mockUser);

    const result = await userService.getUserById('123');

    expect(queryOne).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['123']
    );
    expect(result).toEqual(mockUser);
});
```

#### Testing Middleware

Middleware tests verify request/response handling:

```typescript
it('should call next() for authenticated users', () => {
    const req = { session: { user: mockUser } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
});
```

#### Testing Configuration

Configuration tests validate environment variable parsing and defaults:

```typescript
it('should use default port when not specified', () => {
    delete process.env.PORT;

    const { config } = require('../../src/config/index.js');

    expect(config.port).toBe(3001);
});
```

## Configuration

### vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      thresholds: {
        statements: 50,
        branches: 50,
        functions: 50,
        lines: 50,
      },
    },
    testTimeout: 10000,
    typecheck: {
      enabled: true,
      tsconfig: './tsconfig.json',
    },
  },
});
```

## CI/CD Integration

Tests are designed to run in CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
    - run: npm ci
    - run: npm run test:coverage -w be
    - uses: codecov/codecov-action@v4
      with:
        files: ./be/coverage/lcov.info
```

## Troubleshooting

### Module Mocking Issues

If mocks aren't being applied correctly:

1. Ensure `vi.mock()` calls are at the top of the file, before any imports
2. Use `vi.clearAllMocks()` in `beforeEach` to reset mock state
3. Avoid `vi.resetModules()` when testing module singletons

### Async Test Failures

For async tests that timeout:

1. Ensure all promises are awaited
2. Check for unhandled promise rejections
3. Increase `testTimeout` if needed for slow operations

### Coverage Not Updating

If coverage reports are stale:

1. Delete the `coverage/` directory
2. Run `npm run test:coverage -w be` again
3. Check that files aren't excluded in `vitest.config.ts`
