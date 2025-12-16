# Architecture

System architecture and design documentation for Knowledge Base.

## System Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                              Users                                      │
│                    (Browser / Mobile Browser)                           │
└────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         Load Balancer / Nginx                           │
│                        (SSL Termination, Routing)                       │
└────────────────────────────────────────────────────────────────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 ▼                               ▼
┌────────────────────────────┐   ┌────────────────────────────────────────┐
│       Frontend (FE)        │   │              Backend (BE)               │
│   React + Vite + Tailwind  │   │         Express + TypeScript            │
│        Port: 5173          │   │            Port: 3001                   │
│                            │   │                                         │
│  ┌──────────────────────┐  │   │  ┌─────────────────────────────────┐   │
│  │  Pages               │  │   │  │  Routes                         │   │
│  │  - AI Chat           │  │   │  │  - /api/auth/*                  │   │
│  │  - AI Search         │  │   │  │  - /api/users/*                 │   │
│  │  - History           │  │   │  │  - /api/ragflow/*               │   │
│  │  - User Management   │  │   │  │  - /api/minio/*                 │   │
│  │  - Storage Manager   │  │   │  │  - /api/storage/*               │   │
│  │  - System Tools      │  │   │  │  - /api/system-tools/*          │   │
│  │  - Audit Logs        │  │   │  │  - /api/audit/*                 │   │
│  └──────────────────────┘  │   │  │  - /api/admin/*                 │   │
│                            │   │  └─────────────────────────────────┘   │
│  ┌──────────────────────┐  │   │                                         │
│  │  Components          │  │   │  ┌─────────────────────────────────┐   │
│  │  - Layout            │  │   │  │  Services                       │   │
│  │  - RagflowIframe     │  │   │  │  - AuthService                  │   │
│  │  - SettingsDialog    │  │   │  │  - UserService                  │   │
│  │  - Dialog, Select... │  │   │  │  - MinioService                 │   │
│  └──────────────────────┘  │   │  │  - AuditService                 │   │
│                            │   │  │  - LangfuseService              │   │
│  ┌──────────────────────┐  │   │  │  - LoggerService                │   │
│  │  Contexts            │  │   │  │  - RagflowService               │   │
│  │  - SettingsContext   │  │   │  │  - SystemToolsService           │   │
│  │  - RagflowContext    │  │   │  └─────────────────────────────────┘   │
│  └──────────────────────┘  │   │                                         │
│                            │   │  ┌─────────────────────────────────┐   │
│  ┌──────────────────────┐  │   │  │  Middleware                     │   │
│  │  Hooks               │  │   │  │  - requireAuth                  │   │
│  │  - useAuth           │  │   │  │  - requireRole                  │   │
│  │  - useSharedUser     │  │   │  │  - requirePermission            │   │
│  └──────────────────────┘  │   │  └─────────────────────────────────┘   │
└────────────────────────────┘   └────────────────────────────────────────┘
                                                  │
                 ┌────────────────────────────────┼────────────────────────┐
                 │                                │                        │
                 ▼                                ▼                        ▼
┌────────────────────────┐   ┌────────────────────────┐   ┌────────────────────────┐
│      PostgreSQL        │   │         Redis          │   │         MinIO          │
│    (Primary Database)  │   │    (Session Store)     │   │   (Object Storage)     │
│                        │   │                        │   │                        │
│  - users               │   │  - Session data        │   │  - Documents           │
│  - minio_buckets       │   │  - Cache (future)      │   │  - Images              │
│  - audit_logs          │   │                        │   │  - Files               │
│  - user_ip_history     │   │                        │   │                        │
└────────────────────────┘   └────────────────────────┘   └────────────────────────┘
                                                                     │
                 ┌───────────────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│                            RAGFlow Server                               │
│                      (AI Chat & Search Engine)                          │
│                                                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │
│  │  Chat Interface │  │ Search Interface│  │  Knowledge Base Docs    │ │
│  │  (iframe embed) │  │  (iframe embed) │  │  (indexed content)      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│                            Langfuse                                     │
│                    (AI Observability Platform)                          │
│                                                                         │
│  - Trace AI interactions                                                │
│  - Monitor token usage                                                  │
│  - Debug conversation flows                                             │
└────────────────────────────────────────────────────────────────────────┘
```

## Component Details

### Frontend (React + Vite)

| Layer | Purpose |
|-------|---------|
| **Pages** | Route-level components (AiChatPage, AuditLogPage, LoginPage, etc.) |
| **Components** | Reusable UI components (Layout, Dialog, Select, SettingsDialog, etc.) |
| **Contexts** | Global state management (Settings, Ragflow) |
| **Hooks** | Custom React hooks (useAuth, useSharedUser) |
| **Services** | API client functions (minioService, userPreferences, systemToolsService) |
| **i18n** | Internationalization (English, Japanese, Vietnamese) |

### Backend (Express + TypeScript)

| Layer | Purpose |
|-------|---------|
| **Routes** | HTTP endpoint handlers (auth, users, ragflow, minio, storage, audit, admin) |
| **Services** | Business logic (stateless): auth, user, minio, audit, langfuse, logger, ragflow, system-tools |
| **Middleware** | Request processing (requireAuth, requireRole, requirePermission) |
| **Config** | Environment & app configuration, RBAC definitions |
| **DB** | Database abstraction layer with PostgreSQL adapter |
| **Models** | Data models (MinioBucket) |

## Authentication Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  User    │     │ Frontend │     │ Backend  │     │ Azure AD │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │
     │  Click Login   │                │                │
     │───────────────>│                │                │
     │                │  GET /login    │                │
     │                │───────────────>│                │
     │                │                │  Redirect      │
     │                │<───────────────│───────────────>│
     │                │                │                │
     │                │    Microsoft Login Page         │
     │<────────────────────────────────────────────────>│
     │                │                │                │
     │                │                │   Callback     │
     │                │                │<───────────────│
     │                │                │                │
     │                │  Set Session   │                │
     │                │<───────────────│                │
     │                │                │                │
     │  Redirect Home │                │                │
     │<───────────────│                │                │
     │                │                │                │
```

## Data Flow

### RAGFlow Iframe Integration

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │     │   Backend   │     │   RAGFlow   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │ GET /ragflow/config                   │
       │──────────────────>│                   │
       │                   │                   │
       │ { chatUrl, searchUrl, sources }       │
       │<──────────────────│                   │
       │                   │                   │
       │ Load iframe with URL                  │
       │──────────────────────────────────────>│
       │                   │                   │
       │        RAGFlow UI (chat/search)       │
       │<──────────────────────────────────────│
       │                   │                   │
```

### File Upload Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │     │   Backend   │     │    MinIO    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │ POST /upload (multipart)              │
       │──────────────────>│                   │
       │                   │                   │
       │                   │ putObject()       │
       │                   │──────────────────>│
       │                   │                   │
       │                   │     OK            │
       │                   │<──────────────────│
       │                   │                   │
       │   { success }     │                   │
       │<──────────────────│                   │
       │                   │                   │
```

### Audit Logging Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Admin     │     │   Backend   │     │  PostgreSQL │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │ User Action       │                   │
       │──────────────────>│                   │
       │                   │                   │
       │                   │ INSERT audit_logs │
       │                   │──────────────────>│
       │                   │                   │
       │ GET /api/audit    │                   │
       │──────────────────>│                   │
       │                   │                   │
       │                   │ SELECT with filters│
       │                   │──────────────────>│
       │                   │                   │
       │   { data, pagination }                │
       │<──────────────────│                   │
       │                   │                   │
```

## Database Schema

### Users Table

```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY,
  email         VARCHAR(255) UNIQUE NOT NULL,
  display_name  VARCHAR(255),
  avatar        TEXT,
  role          VARCHAR(50) DEFAULT 'user',
  department    VARCHAR(255),
  job_title     VARCHAR(255),
  mobile_phone  VARCHAR(50),
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);
```

### MinIO Buckets Table

```sql
CREATE TABLE minio_buckets (
  id            UUID PRIMARY KEY,
  bucket_name   VARCHAR(255) UNIQUE NOT NULL,
  display_name  VARCHAR(255),
  description   TEXT,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMP DEFAULT NOW()
);
```

### Audit Logs Table

```sql
CREATE TABLE audit_logs (
  id            SERIAL PRIMARY KEY,
  user_id       UUID REFERENCES users(id),
  user_email    VARCHAR(255) NOT NULL,
  action        VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id   VARCHAR(255),
  details       JSONB DEFAULT '{}',
  ip_address    VARCHAR(45),
  created_at    TIMESTAMP DEFAULT NOW()
);

-- Index for efficient querying
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
```

### User IP History Table

```sql
CREATE TABLE user_ip_history (
  id            SERIAL PRIMARY KEY,
  user_id       UUID REFERENCES users(id),
  ip_address    VARCHAR(45) NOT NULL,
  user_agent    TEXT,
  created_at    TIMESTAMP DEFAULT NOW()
);
```

## Role-Based Access Control (RBAC)

### Roles & Permissions

| Permission | Admin | Manager | User |
|------------|:-----:|:-------:|:----:|
| `view_chat` | ✅ | ✅ | ✅ |
| `view_search` | ✅ | ✅ | ✅ |
| `view_history` | ✅ | ✅ | ✅ |
| `storage:write` | ✅ | ✅ | ❌ |
| `manage_users` | ✅ | ✅ | ❌ |
| `view_analytics` | ✅ | ✅ | ❌ |
| `manage_system` | ✅ | ❌ | ❌ |

### Middleware Chain

```typescript
// Example: Storage route protection
router.use(requireAuth);                         // Must be logged in
router.use(requireRole(['admin', 'manager']));   // Must have role
router.use(requirePermission('storage:write'));  // Must have permission
```

## Logging Architecture

### Winston Logger Configuration

- **Daily Rotating Logs**: `logs_YYYYMMDD.log` format
- **Error Logs**: Separate `error_YYYYMMDD.log` for errors only
- **Retention**: 1 year (365 days) for both log types
- **Compression**: Old logs are gzip compressed
- **Max Size**: 20MB per file before rotation

```
be/logs/
├── logs_20251130.log       # All logs for today
├── logs_20251129.log.gz    # Compressed previous day
├── error_20251130.log      # Error-only logs
└── error_20251129.log.gz   # Compressed errors
```

## Security Considerations

1. **Session Security**
   - HTTP-only cookies
   - Secure flag in production
   - Redis session store with TTL
   - Session secret validation in production

2. **CORS**
   - Restricted to `FRONTEND_URL`
   - Credentials included

3. **Input Validation**
   - Request body validation
   - SQL injection prevention via parameterized queries
   - HPP (HTTP Parameter Pollution) protection
   - Safe query parameter extraction

4. **File Upload**
   - File type validation
   - Size limits (via Multer)
   - Secure MinIO presigned URLs

5. **Rate Limiting**
   - Express rate limiter middleware
   - Configurable limits per endpoint

6. **Security Headers**
   - Helmet middleware for security headers
   - CSP (Content Security Policy) configuration

7. **Audit Trail**
   - Comprehensive action logging
   - User, action, resource tracking
   - IP address recording
   - Searchable and filterable logs
