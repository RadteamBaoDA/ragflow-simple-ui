# Knowledge Base

A RAGFlow-powered knowledge base portal with AI Chat and AI Search interfaces, featuring Azure Entra ID authentication, role-based access control, MinIO object storage, and comprehensive audit logging.

## Key Features

| Feature | Description |
|---------|-------------|
| 🤖 **AI Chat & Search** | Embedded RAGFlow interfaces with multiple source support |
| 🔐 **Azure AD SSO** | Microsoft Entra ID authentication with avatar sync |
| 👥 **RBAC** | Admin, Manager, User roles with granular permissions |
| 📁 **MinIO Storage** | Object storage for knowledge base documents |
| 📋 **Audit Logs** | Comprehensive user action tracking for compliance |
| 🌍 **i18n** | English, Japanese, Vietnamese support |
| 🎨 **Theming** | Light, Dark, System theme preferences |
| 📊 **Observability** | Langfuse integration for AI monitoring |
| 📝 **Rotating Logs** | Daily log rotation with 1-year retention |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│              React + Vite + Tailwind (Port 5173)            │
├─────────────────────────────────────────────────────────────┤
│                        Backend                               │
│              Express + TypeScript (Port 3001)                │
├──────────────┬──────────────┬──────────────┬────────────────┤
│  PostgreSQL  │    Redis     │    MinIO     │   RAGFlow      │
│   Database   │   Sessions   │   Storage    │   AI Engine    │
└──────────────┴──────────────┴──────────────┴────────────────┘
```

**Tech Stack:**
- **Frontend**: React 18, Vite, Tailwind CSS, React Query, i18next, Lucide Icons
- **Backend**: Express.js, TypeScript, Winston (logging)
- **Database**: PostgreSQL
- **Session**: Redis (prod) / Memory (dev)
- **Storage**: MinIO object storage
- **Auth**: Azure Entra ID OAuth2

## Quick Start (Docker)

```bash
# Clone repository
git clone https://github.com/user/knowledge-base.git
cd knowledge-base

# Configure environment
cp be/.env.example be/.env
# Edit be/.env with your settings

# Start with Docker Compose
docker-compose up -d
```

Access at: `http://localhost:5173`

## Configuration

### Required Environment Variables

```env
# Azure AD (Required for SSO)
AZURE_AD_CLIENT_ID=your-client-id
AZURE_AD_CLIENT_SECRET=your-client-secret
AZURE_AD_TENANT_ID=your-tenant-id

# RAGFlow URLs
RAGFLOW_AI_CHAT_URL=http://ragflow:8888/chat
RAGFLOW_AI_SEARCH_URL=http://ragflow:8888/search

# Database
DB_HOST=postgres
DB_NAME=knowledge_base
```

See [docs/configuration.md](docs/configuration.md) for full configuration options.

## Developer Guide

### Prerequisites
- Node.js 18+
- npm 9+
- PostgreSQL 14+
- Redis (optional)

### Local Development

```bash
# Install dependencies
npm install

# Run migrations
npm run db:migrate -w be

# Start development servers
npm run dev
```

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both FE & BE |
| `npm run dev:fe` | Frontend only (port 5173) |
| `npm run dev:be` | Backend only (port 3001) |
| `npm run build` | Build for production |
| `npm run db:migrate -w be` | Run migrations |

### Project Structure

```
├── be/                 # Backend (Express + TypeScript)
│   └── src/
│       ├── config/     # Configuration & RBAC
│       ├── db/         # Database adapters & migrations
│       ├── middleware/ # Auth middleware
│       ├── routes/     # API routes
│       └── services/   # Business logic
├── fe/                 # Frontend (React + Vite)
│   └── src/
│       ├── components/ # UI components
│       ├── contexts/   # React contexts
│       ├── hooks/      # Custom hooks
│       ├── i18n/       # Internationalization
│       ├── pages/      # Route pages
│       └── services/   # API clients
└── docs/               # Documentation
```

## Documentation

| Document | Description |
|----------|-------------|
| [Configuration](docs/configuration.md) | Environment variables & setup options |
| [API Reference](docs/api-reference.md) | REST API endpoints documentation |
| [Architecture](docs/architecture.md) | System design & data flow |
| [Deployment](docs/deployment.md) | Production deployment guide |
| [Development](docs/development.md) | Developer setup & guidelines |
| [Security Review](docs/security-review.md) | OWASP security audit report |

## License

MIT
