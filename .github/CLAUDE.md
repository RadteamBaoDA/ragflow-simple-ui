
# Claude Instructions for knowledge-base

## Project Overview

RAGFlow knowledge-base proxy that embeds AI Chat and AI Search interfaces via iframe, with Langfuse logging for observability and chat history tracking.

## Architecture

### Monorepo Structure (npm workspaces)
```
├── be/                 # Backend: Express + TypeScript (Port 3001)
│   └── src/
│       ├── config/     # Centralized config via `config` object
│       ├── middleware/ # Auth: `requireAuth` + mock user in dev
│       ├── routes/     # Express Router pattern: *.routes.ts
│       └── services/   # Stateless functions: *.service.ts
├── fe/                 # Frontend: React + Vite + Tailwind (Port 5173)
│   └── src/
│       ├── components/ # Layout, RagflowIframe
│       └── pages/      # Route components
└── package.json        # Root workspace scripts
```

## Code Conventions

### TypeScript (Strict Mode)
- Access env via `config` object from `be/src/config/index.ts`
- Use `noUncheckedIndexedAccess` - always handle `undefined`
- All API responses typed with explicit interfaces

### Backend Patterns (Node.js + Express)
```typescript
// Routes: be/src/routes/*.routes.ts
router.use(requireAuth);
const user = getCurrentUser(req);
await logChatInteraction({ userId, sessionId, traceId, userPrompt, aiResponse });
```

### Frontend Patterns (React)
```typescript
// Data fetching: React Query with typed fetchers
const { data, isLoading } = useQuery({ queryKey: ['key'], queryFn: fetchFn });
// Styling: Tailwind classes
className="w-full h-[calc(100vh-140px)] border border-slate-200"
```

## Development Commands
```bash
npm run dev              # Run BE + FE concurrently
npm run dev:be           # Backend only
npm run dev:fe           # Frontend only
```

## Important Notes
- Do **not** auto-generate documentation files after task completion
- Follow existing code patterns strictly
- Request user confirmation before creating new files
