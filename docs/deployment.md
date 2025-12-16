# Deployment Guide

Production deployment instructions for Knowledge Base.

## Prerequisites

- Docker & Docker Compose
- Domain with SSL certificate (or use Let's Encrypt)
- Azure AD App Registration configured
- RAGFlow server deployed

## Docker Compose Deployment

### 1. Create Directory Structure

```bash
mkdir -p knowledge-base/{data,config,logs}
cd knowledge-base
```

### 2. Create docker-compose.yml

```yaml
version: '3.8'

services:
  # Frontend + Backend
  app:
    image: knowledge-base:latest
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
    env_file:
      - .env
    volumes:
      - ./logs:/app/be/logs          # Persist log files
      - ./config:/app/config          # External config files
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    networks:
      - kb-network

  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: knowledge_base
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
    networks:
      - kb-network

  # Redis Session Store
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    restart: unless-stopped
    networks:
      - kb-network

  # MinIO Object Storage
  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"
    restart: unless-stopped
    networks:
      - kb-network

  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - app
    restart: unless-stopped
    networks:
      - kb-network

volumes:
  postgres_data:
  redis_data:
  minio_data:

networks:
  kb-network:
    driver: bridge
```

### 3. Create Production .env

```env
# Application
NODE_ENV=production
PORT=3001
LOG_LEVEL=info

# Database
DATABASE_TYPE=postgresql
DB_HOST=postgres
DB_PORT=5432
DB_NAME=knowledge_base
DB_USER=postgres
DB_PASSWORD=STRONG_PASSWORD_HERE

# Session
SESSION_STORE=redis
SESSION_SECRET=GENERATE_STRONG_SECRET
SESSION_TTL_DAYS=7
REDIS_HOST=redis
REDIS_PORT=6379

# Frontend
FRONTEND_URL=https://kb.yourdomain.com

# Azure AD
AZURE_AD_CLIENT_ID=your-client-id
AZURE_AD_CLIENT_SECRET=your-client-secret
AZURE_AD_TENANT_ID=your-tenant-id
AZURE_AD_REDIRECT_URI=https://kb.yourdomain.com/api/auth/callback

# RAGFlow (use config file or env)
RAGFLOW_CONFIG_PATH=/app/config/ragflow.config.json

# MinIO
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=MINIO_ACCESS_KEY
MINIO_SECRET_KEY=MINIO_SECRET_KEY
MINIO_USE_SSL=false

# System Tools (optional external config)
SYSTEM_TOOLS_CONFIG_PATH=/app/config/system-tools.config.json

# Langfuse (optional)
LANGFUSE_SECRET_KEY=sk-lf-xxx
LANGFUSE_PUBLIC_KEY=pk-lf-xxx
LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

### 4. Create Nginx Configuration

```nginx
# nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream app {
        server app:3001;
    }

    server {
        listen 80;
        server_name kb.yourdomain.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name kb.yourdomain.com;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;

        # API routes
        location /api {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;

            # File upload size
            client_max_body_size 100M;
        }

        # Static files & SPA
        location / {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
}
```

### 5. Deploy

```bash
# Build and start
docker-compose up -d --build

# Run migrations
docker-compose exec app npm run db:migrate -w be

# View logs
docker-compose logs -f app

# Check status
docker-compose ps
```

## Log Management

### Log File Location

Production logs are stored in `./logs/` directory (mounted from container):

```
logs/
├── logs_20251130.log       # All logs for today
├── logs_20251129.log.gz    # Compressed previous day
├── error_20251130.log      # Error-only logs
└── error_20251129.log.gz   # Compressed errors
```

### Log Retention

- **Retention Period**: 1 year (365 days)
- **Compression**: Old logs are automatically gzip compressed
- **Max Size**: 20MB per file before rotation

### Viewing Logs

```bash
# View today's logs
docker-compose exec app cat logs/logs_$(date +%Y%m%d).log

# View error logs
docker-compose exec app cat logs/error_$(date +%Y%m%d).log

# Follow logs in real-time
docker-compose logs -f app

# View compressed old logs
zcat logs/logs_20251129.log.gz
```

## Kubernetes Deployment

### Helm Chart (Basic)

```yaml
# values.yaml
replicaCount: 2

image:
  repository: knowledge-base
  tag: latest

env:
  NODE_ENV: production
  DATABASE_TYPE: postgresql

secrets:
  sessionSecret: ""
  dbPassword: ""
  azureClientSecret: ""

persistence:
  logs:
    enabled: true
    size: 10Gi
    storageClass: standard

postgresql:
  enabled: true
  auth:
    database: knowledge_base

redis:
  enabled: true
  auth:
    enabled: false

ingress:
  enabled: true
  className: nginx
  hosts:
    - host: kb.yourdomain.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: kb-tls
      hosts:
        - kb.yourdomain.com
```

## Health Checks

```bash
# Application health
curl https://kb.yourdomain.com/api/health

# Database connection
docker-compose exec postgres pg_isready

# Redis connection
docker-compose exec redis redis-cli ping
```

## Backup & Restore

### PostgreSQL Backup

```bash
# Backup
docker-compose exec postgres pg_dump -U postgres knowledge_base > backup.sql

# Restore
docker-compose exec -T postgres psql -U postgres knowledge_base < backup.sql
```

### MinIO Backup

```bash
# Using mc (MinIO Client)
mc alias set kb http://localhost:9000 MINIO_ACCESS_KEY MINIO_SECRET_KEY
mc mirror kb/bucket ./backup/
```

### Log Backup

```bash
# Backup logs directory
tar -czvf logs_backup_$(date +%Y%m%d).tar.gz ./logs/
```

## Monitoring

### Recommended Stack

- **Metrics**: Prometheus + Grafana
- **Logs**: Loki or ELK Stack
- **AI Observability**: Langfuse

### Log Aggregation

Configure Promtail or Filebeat to collect logs from `./logs/` directory:

```yaml
# promtail config example
scrape_configs:
  - job_name: knowledge-base
    static_configs:
      - targets:
          - localhost
        labels:
          job: knowledge-base
          __path__: /var/log/knowledge-base/*.log
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| 502 Bad Gateway | Check if app container is running |
| Session not persisting | Verify Redis connection |
| Azure AD callback fails | Check redirect URI matches exactly |
| File upload fails | Increase `client_max_body_size` in Nginx |
| Database connection refused | Verify DB_HOST and network connectivity |
| Logs not appearing | Check volume mount and permissions |
| Old logs not compressed | Verify winston-daily-rotate-file is working |
