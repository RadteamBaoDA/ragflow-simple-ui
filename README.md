# RAGFlow Simple UI

A high-performance, enterprise-ready Management UI for RAGFlow, designed to bridge the gap between raw AI engines and business workflows. It provides a secure, localized, and feature-rich portal with Azure Entra ID authentication, advanced RBAC, and integrated observability.

## 🚀 Key Features

| Feature | Description |
| :--- | :--- |
| 🤖 **AI Chat & Search** | Refined interfaces for RAGFlow, with session history and full-text search. |
| 📁 **MinIO Storage Manager** | Enterprise document management with PDF, Word, and Excel previews. |
| 🔐 **Azure Entra AD SSO** | Seamless Microsoft enterprise authentication with avatar synchronization. |
| 👥 **Enterprise RBAC** | Granular multi-tier permissions: Admin, Manager, and User roles. |
| 🏢 **Team Management** | Multi-tenant team structures for isolated document and flow access. |
| 📢 **Broadcast System** | Real-time system-wide announcements for all active users. |
| 🕵️ **Comprehensive Auditing** | Localized audit logs tracking every user action for compliance. |
| 🖥️ **System Monitoring** | Real-time health metrics, resource usage, and diagnostics. |
| 🌍 **Global Localization** | Full support for English, Vietnamese, and Japanese (i18n). |
| 🎨 **Dynamic Theming** | Elegant Light, Dark, and System theme synchronization. |
| 🔢 **AI Tokenizer** | Built-in tool for estimating token counts for various LLM models. |
| 📊 **Observability** | Native Langfuse integration for tracing AI interactions. |

## 🏗️ Architecture

```mermaid
graph TD
    Client[Frontend: React + Vite]
    BE[Backend: Express + TS]
    DB[(PostgreSQL)]
    Redis[(Redis)]
    MinIO[(MinIO Object Storage)]
    RAGFlow[[RAGFlow AI Engine]]
    Langfuse[[Langfuse Observability]]

    Client <--> BE
    BE <--> DB
    BE <--> Redis
    BE <--> MinIO
    BE <--> RAGFlow
    BE -.-> Langfuse
```

**Tech Stack:**
- **Frontend**: React 18, Vite, Ant Design, Tailwind CSS, React Query, i18next
- **Backend**: Express.js, TypeScript, Winston (Daily Rotate), Node-cron
- **Database**: PostgreSQL (Prisma/Knex-ready migrations)
- **Session**: Redis (Session persistence & rate limiting)
- **Storage**: MinIO SDK (S3 compatible)
- **Auth**: Azure Entra ID (OAuth2/OpenID Connect)
- **Monitoring**: Langfuse API integration

## 📂 Project Structure

```bash
├── be/                 # Backend (Express + TypeScript)
│   ├── src/
│   │   ├── config/     # RBAC roles, CORS, and env configuration
│   │   ├── db/         # Migrations and database adapters
│   │   ├── middleware/ # Auth, rate-limit, and audit interceptors
│   │   ├── routes/     # API endpoints
│   │   └── services/   # Business logic (MinIO, RAGFlow, Audit)
│   └── scripts/        # Database maintenance & seeding
├── fe/                 # Frontend (React + Vite)
│   ├── src/
│   │   ├── components/ # Atomic UI components & Document Previewer
│   │   ├── locales/    # i18n translation files (en, vi, ja)
│   │   ├── pages/      # Feature modules (Chat, Search, Admin)
│   │   └── services/   # Type-safe API clients
├── docker/             # Dockerization & deployment configs
└── docs/               # Detailed technical documentation
```

## 🛠️ Developer Guide

### Prerequisites
- **Node.js**: 22+ (LTS)
- **npm**: 10+
- **PostgreSQL**: 15+
- **MinIO**: High-performance object storage setup
- **Redis**: Required for production session management

### Local Development

```bash
# 1. Install dependencies for the workspace
npm install

# 2. Setup Environment Variables
# Copy be/.env.example to be/.env and fill in Azure/MinIO/RAGFlow credentials

# 3. Run Database Migrations
npm run db:migrate -w be

# 4. Start Development Servers
npm run dev
```

| Command | Action |
| :--- | :--- |
| `npm run dev` | Spins up both FE (5173) and BE (3001) |
| `npm run build` | Production build for both tiers |
| `npm run build:prod` | Optimized production build without source maps |
| `npm run lint` | Run project-wide ESLint checks |

## 📖 Documentation

Explore our detailed guides in the `docs/` folder:
- [Configuration Guide](docs/configuration.md)
- [Deployment Strategy](docs/deployment.md)
- [API Reference](docs/api-reference.md)
- [RBAC Policy](docs/architecture.md)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
