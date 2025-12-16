# Development Guide

Developer setup and guidelines for Knowledge Base.

## Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js | 18+ |
| npm | 9+ |
| PostgreSQL | 14+ |
| Redis | 7+ (optional for dev) |

## Quick Setup

```bash
# Clone repository
git clone https://github.com/user/knowledge-base.git
cd knowledge-base

# Install dependencies (all workspaces)
npm install

# Setup environment
cp be/.env.example be/.env
# Edit be/.env with your settings

# Run database migrations
npm run db:migrate -w be

# Start development servers
npm run dev
```

## Project Structure

```
knowledge-base/
├── be/                     # Backend workspace
│   ├── src/
│   │   ├── config/         # Configuration
│   │   │   ├── index.ts    # Environment config
│   │   │   ├── rbac.ts     # Role permissions
│   │   │   └── system-tools.config.json
│   │   ├── db/
│   │   │   ├── index.ts    # DB connection
│   │   │   ├── adapters/   # PostgreSQL adapter
│   │   │   └── migrations/ # Database migrations
│   │   ├── middleware/
│   │   │   └── auth.middleware.ts
│   │   ├── models/         # Data models
│   │   │   └── minio-bucket.model.ts
│   │   ├── routes/         # API endpoints
│   │   │   ├── admin.routes.ts
│   │   │   ├── audit.routes.ts
│   │   │   ├── auth.routes.ts
│   │   │   ├── minio-bucket.routes.ts
│   │   │   ├── minio-storage.routes.ts
│   │   │   ├── ragflow.routes.ts
│   │   │   ├── system-tools.routes.ts
│   │   │   └── user.routes.ts
│   │   ├── services/       # Business logic
│   │   │   ├── audit.service.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── langfuse.service.ts
│   │   │   ├── logger.service.ts
│   │   │   ├── minio.service.ts
│   │   │   ├── ragflow.service.ts
│   │   │   ├── system-tools.service.ts
│   │   │   └── user.service.ts
│   │   └── scripts/        # Utility scripts
│   ├── logs/               # Log files (logs_YYYYMMDD.log)
│   ├── public/             # Static files
│   ├── package.json
│   └── tsconfig.json
├── fe/                     # Frontend workspace
│   ├── src/
│   │   ├── components/     # React components
│   │   │   ├── Layout.tsx
│   │   │   ├── RagflowIframe.tsx
│   │   │   ├── SettingsDialog.tsx
│   │   │   ├── Dialog.tsx
│   │   │   ├── Select.tsx
│   │   │   └── ...
│   │   ├── contexts/       # React contexts
│   │   │   ├── RagflowContext.tsx
│   │   │   └── SettingsContext.tsx
│   │   ├── hooks/          # Custom hooks
│   │   │   ├── useAuth.tsx
│   │   │   └── useSharedUser.ts
│   │   ├── pages/          # Route pages
│   │   │   ├── AiChatPage.tsx
│   │   │   ├── AiSearchPage.tsx
│   │   │   ├── AuditLogPage.tsx
│   │   │   ├── HistoryPage.tsx
│   │   │   ├── LoginPage.tsx
│   │   │   ├── MinIOManagerPage.tsx
│   │   │   ├── SystemToolsPage.tsx
│   │   │   └── UserManagementPage.tsx
│   │   ├── services/       # API clients
│   │   │   ├── minioService.ts
│   │   │   ├── shared-storage.service.ts
│   │   │   ├── systemToolsService.ts
│   │   │   └── userPreferences.ts
│   │   ├── i18n/           # Internationalization
│   │   │   ├── index.ts
│   │   │   └── locales/
│   │   │       ├── en.json
│   │   │       ├── ja.json
│   │   │       └── vi.json
│   │   ├── lib/            # Utilities
│   │   │   └── api.ts
│   │   ├── App.tsx         # Root component
│   │   └── main.tsx        # Entry point
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── docs/                   # Documentation
├── scripts/                # Build scripts
└── package.json            # Root workspace config
```

## Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start FE (5173) + BE (3001) |
| `npm run dev:fe` | Frontend only |
| `npm run dev:be` | Backend only |
| `npm run build` | Build all workspaces |
| `npm run build -w fe` | Build frontend only |
| `npm run build -w be` | Build backend only |
| `npm run db:migrate -w be` | Run migrations |
| `npm run db:seed-audit -w be` | Seed audit log data (for testing) |
| `npm run lint` | Lint all workspaces |

## Backend Development

### Adding a New Route

1. Create route file in `be/src/routes/`:

```typescript
// be/src/routes/example.routes.ts
import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { log } from '../services/logger.service.js';

const router = Router();

// Apply auth middleware
router.use(requireAuth);

// GET /api/example
router.get('/', async (req: Request, res: Response) => {
  log.debug('Example endpoint called', { userId: req.session.user?.id });
  res.json({ message: 'Hello' });
});

// POST /api/example (admin only)
router.post('/', requireRole('admin'), async (req: Request, res: Response) => {
  // ...
});

export default router;
```

2. Register in `be/src/index.ts`:

```typescript
import exampleRoutes from './routes/example.routes.js';

app.use('/api/example', exampleRoutes);
```

### Adding a New Service

```typescript
// be/src/services/example.service.ts
import { query, queryOne } from '../db/index.js';
import { log } from './logger.service.js';

export async function getItems(): Promise<Item[]> {
  try {
    const result = await query<Item>('SELECT * FROM items');
    return result;
  } catch (error) {
    log.error('Failed to get items', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

export async function createItem(data: CreateItemDto): Promise<Item> {
  // Use parameterized queries to prevent SQL injection
  const result = await queryOne<Item>(
    'INSERT INTO items (name, value) VALUES ($1, $2) RETURNING *',
    [data.name, data.value]
  );
  return result!;
}
```

### Adding a Migration

1. Create migration file:

```typescript
// be/src/db/migrations/007_add_example_table.ts
import { Migration } from './types.js';

export const migration: Migration = {
  id: '007_add_example_table',
  
  async up(db) {
    await db.query(`
      CREATE TABLE IF NOT EXISTS examples (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
  },
  
  async down(db) {
    await db.query('DROP TABLE IF EXISTS examples');
  }
};
```

2. Register in `be/src/db/migrations/runner.ts`

3. Run: `npm run db:migrate -w be`

### Environment Configuration

Access config via the `config` object (never use raw `process.env`):

```typescript
import { config } from '../config/index.js';

console.log(config.port);           // 3001
console.log(config.database.host);  // localhost
console.log(config.azureAd.clientId); // your-client-id
console.log(config.isProduction);   // false
```

### Logging

Use the centralized logger service:

```typescript
import { log } from '../services/logger.service.js';

log.debug('Processing request', { path: '/api/data' });
log.info('User logged in', { userId: '123', email: 'user@example.com' });
log.warn('Rate limit approaching', { current: 95, limit: 100 });
log.error('Database connection failed', { error: err.message });
```

### Audit Logging

Log user actions for compliance:

```typescript
import { auditService, AuditAction, AuditResourceType } from '../services/audit.service.js';

await auditService.log({
  userId: user.id,
  userEmail: user.email,
  action: AuditAction.UPDATE_ROLE,
  resourceType: AuditResourceType.USER,
  resourceId: targetUserId,
  details: { oldRole: 'user', newRole: 'manager' },
  ipAddress: req.ip,
});
```

## Frontend Development

### Adding a New Page

1. Create page component:

```tsx
// fe/src/pages/ExamplePage.tsx
import { useTranslation } from 'react-i18next';

function ExamplePage() {
  const { t } = useTranslation();
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
        {t('example.title')}
      </h1>
    </div>
  );
}

export default ExamplePage;
```

2. Add route in `fe/src/App.tsx`:

```tsx
const ExamplePage = lazy(() => import('./pages/ExamplePage'));

// In routes
<Route path="/example" element={<ExamplePage />} />
```

3. Add to sidebar in `fe/src/components/Layout.tsx`

### Adding a New Component

```tsx
// fe/src/components/ExampleCard.tsx
interface ExampleCardProps {
  title: string;
  description: string;
  onClick?: () => void;
}

export function ExampleCard({ title, description, onClick }: ExampleCardProps) {
  return (
    <div 
      onClick={onClick}
      className="p-4 bg-white dark:bg-slate-800 rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer"
    >
      <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
      <p className="text-sm text-slate-600 dark:text-slate-400">{description}</p>
    </div>
  );
}
```

### Using API Client

```tsx
import { apiFetch } from '../lib/api';

// In component
const fetchData = async () => {
  try {
    const data = await apiFetch<MyData[]>('/api/example');
    setData(data);
  } catch (error) {
    console.error('Failed to fetch:', error);
  }
};

// With React Query
import { useQuery } from '@tanstack/react-query';

const { data, isLoading, error } = useQuery({
  queryKey: ['example'],
  queryFn: () => apiFetch<MyData[]>('/api/example'),
});
```

### Adding Translations

1. Add to locale files:

```json
// fe/src/i18n/locales/en.json
{
  "example": {
    "title": "Example Page",
    "description": "This is an example"
  }
}
```

```json
// fe/src/i18n/locales/ja.json
{
  "example": {
    "title": "サンプルページ",
    "description": "これはサンプルです"
  }
}
```

```json
// fe/src/i18n/locales/vi.json
{
  "example": {
    "title": "Trang ví dụ",
    "description": "Đây là ví dụ"
  }
}
```

2. Use in component:

```tsx
const { t } = useTranslation();
<h1>{t('example.title')}</h1>
```

## Code Style Guidelines

### TypeScript

- Use strict mode (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- Prefer `interface` over `type` for objects
- Use `async/await` over `.then()`
- Handle all errors explicitly
- Access env vars via `config` object only

### React

- Use functional components with hooks
- Prefer composition over inheritance
- Use React Query for server state
- Use Context for global UI state (Settings, Ragflow)

### CSS (Tailwind)

- Use Tailwind utility classes
- Support dark mode with `dark:` prefix
- Use `@apply` sparingly in `index.css`
- Follow responsive design patterns

## Testing

```bash
# Run tests (when available)
npm test

# Run tests with coverage
npm test -- --coverage
```

## Debugging

### Backend

```bash
# Enable debug logging
LOG_LEVEL=debug npm run dev:be

# View log files
cat be/logs/logs_$(date +%Y%m%d).log

# View error logs only
cat be/logs/error_$(date +%Y%m%d).log
```

### Frontend

- Use React DevTools browser extension
- Use React Query DevTools (enabled in dev)
- Check browser console for errors
- Network tab for API calls

## Common Issues

| Issue | Solution |
|-------|----------|
| `Module not found` | Run `npm install` |
| Port already in use | Kill process or change port |
| Database connection failed | Check `DB_*` env vars |
| CORS errors | Verify `FRONTEND_URL` matches |
| Session not persisting | Check `SESSION_SECRET` is set |
| Azure AD callback fails | Check redirect URI matches exactly |
| Logs not appearing | Check `LOG_LEVEL` setting |

## Git Workflow

1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes and commit
3. Push and create Pull Request
4. Get review and merge

### Commit Message Format

```
type(scope): description

- feat: New feature
- fix: Bug fix
- docs: Documentation
- style: Formatting
- refactor: Code refactoring
- test: Tests
- chore: Maintenance
```

Example: `feat(audit): add audit log filtering by date range`
