# Configuration Guide

Complete configuration reference for Knowledge Base.

## Environment Variables

Create `be/.env` from `be/.env.example`.

### Server Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Backend server port |
| `NODE_ENV` | `development` | Environment: `development` \| `production` |
| `LOG_LEVEL` | `debug` (dev) / `info` (prod) | Logging level: `error` \| `warn` \| `info` \| `debug` |

### Development Server

| Variable | Default | Description |
|----------|---------|-------------|
| `DEV_DOMAIN` | `localhost` | Development domain |
| `DEV_PORT` | `5173` | Frontend dev server port |
| `HTTPS_ENABLED` | `false` | Enable HTTPS for local dev |
| `DEV_ADDITIONAL_DOMAINS` | `kb` | Additional SSL domains (comma-separated) |
| `IGNORE_SELF_SIGNED_CERTS` | `false` | Ignore self-signed certs (Dev only) |

### Database Configuration (PostgreSQL)

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `knowledge_base` | Database name |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | - | Database password |

### Session Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SESSION_STORE` | `redis` (prod) / `memory` (dev) | Session store: `redis` \| `memory` |
| `SESSION_SECRET` | - | **Required in production.** Session encryption secret |
| `SESSION_TTL_DAYS` | `7` | Session expiry in days |
| `SHARED_STORAGE_DOMAIN` | `.localhost` | Domain for cross-subdomain auth |

#### Redis (when `SESSION_STORE=redis`)

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | - | Redis password (optional) |
| `REDIS_DB` | `0` | Redis database number |

### Azure Entra ID (Microsoft SSO)

| Variable | Required | Description |
|----------|----------|-------------|
| `AZURE_AD_CLIENT_ID` | Yes | Application (client) ID |
| `AZURE_AD_CLIENT_SECRET` | Yes | Client secret value |
| `AZURE_AD_TENANT_ID` | Yes | Directory (tenant) ID |
| `AZURE_AD_REDIRECT_URI` | Yes | OAuth callback URL (default: `http://localhost:3001/api/auth/callback`) |
| `AZURE_AD_PROXY_URL` | No | Optional proxy URL for Azure AD requests |

### RAGFlow Configuration

| Variable | Description |
|----------|-------------|
| `RAGFLOW_CONFIG_PATH` | Path to ragflow.config.json (optional, for Docker mounts) |

RAGFlow sources are configured via JSON file. Default location: `be/src/config/ragflow.config.json`

### MinIO Object Storage

| Variable | Default | Description |
|----------|---------|-------------|
| `MINIO_ENDPOINT` | `localhost` | MinIO server endpoint |
| `MINIO_PORT` | `9000` | MinIO port |
| `MINIO_ACCESS_KEY` | `minioadmin` | Access key |
| `MINIO_SECRET_KEY` | `minioadmin` | Secret key |
| `MINIO_USE_SSL` | `false` | Use HTTPS |

### Langfuse (Observability)

| Variable | Description |
|----------|-------------|
| `LANGFUSE_SECRET_KEY` | Langfuse secret key |
| `LANGFUSE_PUBLIC_KEY` | Langfuse public key |
| `LANGFUSE_BASE_URL` | Langfuse server URL (default: `https://cloud.langfuse.com`) |

### External Integration (Trace & History)

| Variable | Default | Description |
|----------|---------|-------------|
| `EXTERNAL_TRACE_ENABLED` | `true` | Enable external trace/history API |
| `EXTERNAL_TRACE_API_KEY` | - | **Required.** API key for external clients |
| `EXTERNAL_TRACE_CACHE_TTL` | `300` | Cache TTL in seconds |
| `EXTERNAL_TRACE_LOCK_TIMEOUT`| `5000` | Lock timeout in ms |

### Root Login (Development/Emergency)

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_ROOT_LOGIN` | `true` | Enable root user login |
| `KB_ROOT_USER` | `admin@localhost` | Root username (email format) |
| `KB_ROOT_PASSWORD` | `admin` | Root password |

### Admin API Key

| Variable | Description |
|----------|-------------|
| `ADMIN_API_KEY` | API Key for admin tasks (if applicable) |

### Other Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `FRONTEND_URL` | `http://localhost:5173` | Frontend URL for CORS |
| `CORS_ORIGINS` | - | Allowed CORS origins (comma-separated) |
| `CORS_CREDENTIALS` | `true` | Allow CORS credentials |
| `SYSTEM_TOOLS_CONFIG_PATH` | - | Path to system-tools.config.json (optional) |
| `TEMP_CACHE_PATH` | `./temp` | Temp cache directory |
| `TEMP_FILE_TTL_MS` | `604800000` | Temp file TTL (7 days) |

## Logging Configuration

### Log File Settings

Logs are managed by Winston with daily rotation:

| Setting | Value | Description |
|---------|-------|-------------|
| **Filename Format** | `logs_YYYYMMDD.log` | Daily log files |
| **Error Logs** | `error_YYYYMMDD.log` | Separate error-only logs |
| **Retention** | 365 days (1 year) | Automatic cleanup of old logs |
| **Max Size** | 20MB | Rotates when file exceeds size |
| **Location** | `be/logs/` | Log directory |

## Azure App Registration Setup

1. Go to **Azure Portal** → **Microsoft Entra ID** → **App registrations**
2. Click **New registration**
3. Configure:
   - Name: `Knowledge Base`
   - Supported account types: Single tenant (or as needed)
   - Redirect URI: `http://localhost:3001/api/auth/callback` (Web)
4. After creation, note the **Application (client) ID**
5. Go to **Certificates & secrets** → **New client secret**
6. Copy the secret value immediately
7. Go to **API permissions** → **Add a permission**:
   - Microsoft Graph → Delegated permissions
   - Add: `openid`, `profile`, `email`, `User.Read`
8. Update `.env` with collected values

## RAGFlow Setup

1. Deploy RAGFlow server
2. Create a chat/search share in RAGFlow admin
3. Copy the share URL with authentication token
4. Configure in `ragflow.config.json` or set `RAGFLOW_CONFIG_PATH`
