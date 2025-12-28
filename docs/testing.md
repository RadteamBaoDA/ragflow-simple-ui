# Testing Strategy

This document describes the testing setup for the Knowledge Base project. We prioritize high code coverage and reliability using **Vitest**.

## Overview

*   **Framework**: Vitest
*   **Coverage Provider**: v8
*   **Location**:
    *   Backend: `be/tests/` (mirrors `be/src/`)
    *   Frontend: `fe/src/**/*.test.tsx` (co-located)

## Running Tests

From the project root:

```bash
# Run all tests
npm test

# Run backend tests
npm test -w be

# Run frontend tests
npm test -w fe

# Run with coverage
npm run test:coverage -w be
```

## Backend Testing Guidelines

### Structure
Tests are located in `be/tests/` and mirror the source structure.

### Mocking
*   **Database**: Mock `knex` and `ModelFactory`. Do not connect to a real DB during unit tests.
*   **External Services**: Mock `minio`, `axios` (for RAGFlow), and `langfuse`.
*   **Middleware**: Mock `auth.middleware.ts` to bypass Azure AD checks in route tests.

### Example (Service Test)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserService } from '../../src/services/user.service.js';

describe('UserService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return a user by id', async () => {
    // Setup mocks
    // Call service
    // Assert result
  });
});
```

## Frontend Testing Guidelines

*   **Components**: Test rendering and user interactions using `@testing-library/react`.
*   **Hooks**: Test custom hooks in isolation.
*   **Services**: Mock API calls.

## CI/CD

Tests are run automatically on Pull Requests. A minimum coverage threshold (e.g., 80% or 95%) is enforced.
