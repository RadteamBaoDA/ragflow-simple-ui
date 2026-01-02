# Development Guide

## Prerequisites

*   **Node.js**: v22+ (LTS recommended)
*   **npm**: v10+
*   **PostgreSQL**: v15+
*   **Redis**: v6+ (Optional for local dev, required for prod)
*   **MinIO**: Server running locally or accessible remote instance.

## Workspace Setup

This project is a monorepo using npm workspaces:
*   `be`: Backend (Express)
*   `fe`: Frontend (React)

### 1. Installation

Install dependencies for all workspaces from the root:

```bash
npm install
```

### 2. Environment Setup

Copy the example environment file in the backend workspace:

```bash
cp be/.env.example be/.env
```

Edit `be/.env` to configure your database, MinIO, and Azure credentials.

### 3. Database Setup

Ensure PostgreSQL is running and create the database:

```sql
CREATE DATABASE knowledge_base;
```

Run migrations from the root (targeting the `be` workspace):

```bash
npm run db:migrate -w be
```

(Optional) Seed initial data:

```bash
npm run db:seed -w be
```

### 4. Running Development Servers

Start both frontend and backend in development mode:

```bash
npm run dev
```

*   **Frontend**: http://localhost:5173
*   **Backend API**: http://localhost:3001/api

You can also run them individually:

```bash
npm run dev:be  # Backend only
npm run dev:fe  # Frontend only
```

## Testing

The project uses **Vitest** for unit and integration testing.

### Running Tests

Run all tests across workspaces:

```bash
npm test
```

Run backend tests only:

```bash
npm test -w be
```

Run frontend tests only:

```bash
npm test -w fe
```

### Test Coverage

Generate coverage reports:

```bash
npm run test:coverage -w be
npm run test:coverage -w fe
```

## Linting

Ensure code quality before committing:

```bash
npm run lint
```

## Build

Build for production:

```bash
npm run build
```

Artifacts will be generated in:
*   `be/dist/`
*   `fe/dist/`

## Coding Rules

### Database Migrations
*   **Knex Imports**: When importing `Knex` for typing in migration files, ALWAYS use `import type { Knex } from 'knex';`. The `knex` package is a CommonJS module and named imports will fail at runtime in the ESM environment. Use type-only imports to avoid this issue.
