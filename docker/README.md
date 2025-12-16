# Knowledge Base - Docker Deployment

This directory contains Docker configuration files for deploying the Knowledge Base system with Nginx reverse proxy for proper IP forwarding and audit log support.

## Architecture

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                     Docker Network                       │
                    │                                                          │
  Client ──────────►│  ┌─────────┐    ┌──────────┐    ┌──────────────────┐    │
  (Browser)         │  │  Nginx  │───►│ Frontend │    │     Backend      │    │
                    │  │  :80    │    │   :80    │    │      :3001       │    │
                    │  │         │───►│          │    │                  │    │
                    │  └─────────┘    └──────────┘    └────────┬─────────┘    │
                    │       │                                   │              │
                    │       │  X-Forwarded-For                  │              │
                    │       │  X-Real-IP                        │              │
                    │       └──────────────────────────────────►│              │
                    │                                           │              │
                    │                    ┌──────────────────────┼───────────┐ │
                    │                    │                      ▼           │ │
                    │               ┌────┴─────┐          ┌──────────┐     │ │
                    │               │ PostgreSQL│          │  Redis   │     │ │
                    │               │   :5432   │          │  :6379   │     │ │
                    │               └───────────┘          └──────────┘     │ │
                    │                                                       │ │
                    └───────────────────────────────────────────────────────┘ │
                                                                              │
                    └─────────────────────────────────────────────────────────┘
```

## Directory Structure

```
docker/
├── docker-compose.yml      # Main compose file for all services
├── build-frontend.sh       # Script to build frontend for Ubuntu 22
├── .env.example            # Environment variables template
├── manage.sh               # Management script for common operations
├── nginx/
│   └── nginx.conf          # Main Nginx configuration with IP forwarding
├── frontend-dist/          # Built frontend files (created by build script)
├── init-db/                # Database initialization scripts
│   └── 01-init.sql         # PostgreSQL initialization
├── config/                 # Optional config overrides (mount as volume)
└── README.md               # This file
```

## Services

| Service   | Description                      | Internal Port | External Port |
|-----------|----------------------------------|---------------|---------------|
| nginx     | Reverse proxy + frontend serving | 80, 443       | 80, 443       |
| backend   | Knowledge Base backend API       | 3001          | -             |
| postgres  | PostgreSQL 16 database           | 5432          | 5432          |
| redis     | Redis 7 session store            | 6379          | 6379          |

## IP Forwarding for Audit Logs

Nginx is configured to forward client IP addresses to the backend for audit logging:

```nginx
# Headers set by Nginx
X-Real-IP: $remote_addr
X-Forwarded-For: $proxy_add_x_forwarded_for
X-Forwarded-Proto: $scheme
X-Forwarded-Host: $host
```

The backend reads these headers to record the real client IP in audit logs.

## Quick Start

### 1. Build Frontend (on Ubuntu 22)

Build the frontend static files:

```bash
chmod +x build-frontend.sh
./build-frontend.sh
```

This will:
- Install Node.js dependencies
- Build optimized production bundle (no source maps)
- Copy output to `frontend-dist/` directory

### 2. Build Backend Docker Image

```bash
chmod +x manage.sh
./manage.sh build-backend
```

Or build everything:

```bash
./manage.sh build
```

### 3. Configure Environment

```bash
# Copy environment file template
cp .env.example .env

# Edit configuration
nano .env
```

### 4. Start Services

```bash
./manage.sh start
```

Or directly with docker compose:

```bash
docker compose up -d
```

### 5. Access the Application

- **Web UI**: http://localhost (via Nginx)
- **API**: http://localhost/api (via Nginx)
- **Health Check**: http://localhost/health

### 6. Check Status

```bash
./manage.sh status
```

### 7. View Logs

```bash
./manage.sh logs           # All services
./manage.sh logs nginx     # Nginx only
./manage.sh logs backend   # Backend only
./manage.sh logs postgres  # PostgreSQL only
```

## Environment Variables

### Docker Compose Variables (`.env`)

| Variable           | Default                  | Description                |
|--------------------|--------------------------|----------------------------|
| `NGINX_HTTP_PORT`  | 80                       | Nginx HTTP port            |
| `NGINX_HTTPS_PORT` | 443                      | Nginx HTTPS port           |
| `BACKEND_IMAGE`    | knowledge-base-backend   | Backend Docker image       |
| `BACKEND_VERSION`  | latest                   | Backend image tag          |
| `DB_NAME`          | knowledge_base           | PostgreSQL database name   |
| `DB_USER`          | postgres                 | PostgreSQL username        |
| `DB_PASSWORD`      | change_me_in_production  | PostgreSQL password        |
| `DB_PORT`          | 5432                     | PostgreSQL exposed port    |
| `REDIS_PORT`       | 6379                     | Redis exposed port         |
| `REDIS_PASSWORD`   | (empty)                  | Redis password             |
| `SESSION_SECRET`   | (required)               | Session encryption secret  |
| `AZURE_AD_*`       | (required for auth)      | Azure AD configuration     |

## Management Commands

| Command          | Description                                    |
|------------------|------------------------------------------------|
| `build`          | Build all (backend image + frontend static)    |
| `build-backend`  | Build only the backend Docker image            |
| `build-frontend` | Build only the frontend static files           |
| `start`          | Start all services                             |
| `stop`           | Stop all services                              |
| `restart`        | Restart all services                           |
| `logs`           | View service logs                              |
| `status`         | Show service status                            |
| `pull`           | Pull latest images                             |
| `clean`          | Remove all data (WARNING: destructive)         |
| `migrate`        | Run database migrations                        |

## Production Deployment

For production deployment:

1. **Change all default passwords** in `.env`
2. Set `ENABLE_ROOT_LOGIN=false`
3. Configure proper `SESSION_SECRET` (use a long random string)
4. Set up SSL/TLS certificates (see HTTPS Configuration below)
5. Configure proper `SHARED_STORAGE_DOMAIN` for cookie sharing
6. Set up proper backup for PostgreSQL and Redis volumes
7. Configure `FRONTEND_URL` and `AZURE_AD_REDIRECT_URI` with your domain

### HTTPS Configuration

1. Place SSL certificates in `nginx/ssl/`:
   ```
   nginx/ssl/fullchain.pem  # Certificate chain
   nginx/ssl/privkey.pem    # Private key
   ```

2. Uncomment the HTTPS server block in `nginx/nginx.conf`

3. Update `.env`:
   ```bash
   NGINX_HTTPS_PORT=443
   ```

4. Update redirect URIs and frontend URLs to use `https://`

## Volumes

| Volume        | Description                |
|---------------|----------------------------|
| postgres_data | PostgreSQL database files  |
| redis_data    | Redis persistence          |
| backend_logs  | Backend application logs   |

## Health Checks

All services have built-in health checks:

- **Nginx**: `/nginx-health` endpoint
- **Frontend**: `/health` endpoint
- **Backend**: `/health` endpoint
- **PostgreSQL**: `pg_isready` command
- **Redis**: `redis-cli ping`

## Audit Log IP Collection

The system is configured to collect real client IPs for audit logging:

1. **Nginx** receives the request and sets forwarding headers:
   - `X-Real-IP`: Direct client IP
   - `X-Forwarded-For`: Full proxy chain

2. **Backend** reads these headers in `auth.middleware.ts`:
   ```typescript
   const clientIp = req.headers['x-forwarded-for'] || 
                    req.headers['x-real-ip'] || 
                    req.socket.remoteAddress;
   ```

3. **Audit logs** store the client IP with each action

## Troubleshooting

### Services won't start

1. Check if ports are already in use (80, 443, 5432, 6379)
2. Verify `.env` configuration
3. Check logs: `./manage.sh logs`

### Nginx 502 Bad Gateway

1. Check if backend and frontend are healthy: `./manage.sh status`
2. Check backend logs: `./manage.sh logs backend`
3. Verify internal network connectivity

### Database connection issues

1. Wait for PostgreSQL to be healthy
2. Check `DB_*` environment variables
3. Verify network connectivity

### IP not being collected

1. Check Nginx configuration includes IP forwarding headers
2. Verify backend is reading `X-Forwarded-For` header
3. Check audit logs in the database

### Frontend not loading

1. Make sure `frontend-dist/` contains the built files
2. Run `./build-frontend.sh` if empty
3. Check Nginx logs: `./manage.sh logs nginx`
4. Verify nginx can read the files (permissions)
