# Copilot Instructions for knowledge-base

## Project Overview

RAGFlow knowledge-base proxy that embeds AI Chat and AI Search interfaces via iframe, with Langfuse logging for observability, PostgreSQL chat history, and Azure Entra ID authentication.

## Architecture

### Monorepo Structure (npm workspaces)
```
├── be/                 # Backend: Express + TypeScript (Port 3001)
│   └── src/
│       ├── config/     # Centralized config via `config` object
│       ├── db/         # PostgreSQL connection pool + migrations
│       ├── middleware/ # Auth: `requireAuth` + mock user in dev
│       ├── routes/     # Express Router pattern: *.routes.ts
│       └── services/   # Stateless functions: *.service.ts
├── fe/                 # Frontend: React + Vite + Tailwind (Port 5173)
│   └── src/
│       ├── components/ # Layout (collapsible sidebar + user info), RagflowIframe
│       └── pages/      # Route components
└── package.json        # Root workspace scripts
```

### Key Integration Points
- **RAGFlow**: Iframe URLs served from `/api/ragflow/config` → fetched by `RagflowIframe.tsx`
- **Langfuse 3.x**: `logChatInteraction()` / `logSearchInteraction()` in `langfuse.service.ts`
- **Azure Entra ID**: Custom OAuth2 flow in `auth.service.ts` with session-based auth
- **PostgreSQL**: Chat history with full-text search via GIN indexes

## Development Commands

```bash
npm install              # Install all workspaces
npm run dev              # Run BE (3001) + FE (5173) concurrently
npm run dev:be           # Backend only with tsx watch
npm run dev:fe           # Frontend only with Vite
npm run db:migrate -w be # Run database migrations
npm run build            # Build all workspaces
```

## Code Conventions

### TypeScript (Strict Mode)
- Access env via `config` object from `be/src/config/index.ts` - never raw `process.env`
- Use `noUncheckedIndexedAccess` - always handle `undefined` for array/object access
- Use `| undefined` for optional properties with `exactOptionalPropertyTypes`
- All API responses typed with explicit interfaces

### Backend Patterns
```typescript
// Routes: be/src/routes/*.routes.ts
router.use(requireAuth);  // Apply auth middleware
const user = getCurrentUser(req);  // Get typed user from session

// Services: stateless, async functions
await logChatInteraction({ userId, sessionId, traceId, userPrompt, aiResponse });

// Auth: Session-based with Azure Entra ID OAuth2
req.session.user  // User data after login
```

### Frontend Patterns
```typescript
// Data fetching: React Query with typed fetchers
const { data, isLoading } = useQuery({ queryKey: ['key'], queryFn: fetchFn });

// User info: Fetched via /api/auth/me
const { data: user } = useQuery({ queryKey: ['currentUser'], queryFn: fetchCurrentUser });

// Styling: Tailwind classes, custom colors in tailwind.config.js
className="w-full h-[calc(100vh-140px)] border border-slate-200"
```

## Authentication Flow

1. User clicks "Sign in with Microsoft" → redirects to `/api/auth/login`
2. Backend redirects to Azure Entra ID with OAuth2 authorization URL
3. User authenticates → Azure redirects to `/api/auth/callback`
4. Backend exchanges code for tokens, fetches user profile + avatar
5. User stored in session → redirects to frontend
6. Frontend fetches user via `/api/auth/me` and displays in sidebar

## Environment Setup

Copy `.env.example` in `be/` directory. Key variables:
- `DB_*` - PostgreSQL connection settings
- `RAGFLOW_AI_CHAT`, `RAGFLOW_AI_SEARCH` - Full iframe URLs
- `LANGFUSE_SECRET_KEY`, `LANGFUSE_PUBLIC_KEY` - Langfuse 3.x credentials
- `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID` - Azure App registration
- `AZURE_AD_REDIRECT_URI` - Must match Azure Portal redirect URI (default: `http://localhost:3001/api/auth/callback`)

---

