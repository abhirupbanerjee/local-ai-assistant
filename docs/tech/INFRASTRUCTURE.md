# Local AI Assistant - Infrastructure & Deployment

## Overview

Local AI Assistant uses Docker Compose for containerized deployment with a flexible, profile-based service selection system:
- **Local Development**: Local services with hot reload
- **Production**: Full stack with Traefik TLS, provider selected via Docker profiles

### Infrastructure Provider Choices

Local AI Assistant supports pluggable database and vector store backends, selected at deployment time:

| Component | Options | Selection Method |
|-----------|---------|-----------------|
| **Database** | PostgreSQL | `--profile postgres` Docker profile |
| **Vector Store** | Qdrant | `VECTOR_STORE_PROVIDER` env var + Docker profile |

> **Important:** Always use explicit `--profile` flags — do not rely on `COMPOSE_PROFILES` env var (unreliable across Docker versions).

### LLM Provider Selection

Local AI Assistant uses Ollama as the primary (and recommended) LLM provider for all deployments. Ollama runs entirely locally, ensuring data never leaves your network.

| Provider | Use Case | Data Classification |
 |---|---|---|
 | **Ollama** (Local) | All workloads — RAG, document lookup, Q&A, complex reasoning, tool calls | ✅ All data classifications — data never leaves your network |

> **Note:** For air-gapped deployments, Ollama is the only supported LLM provider.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           DOCKER HOST                                    │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                         TRAEFIK                                  │    │
│  │                    (Reverse Proxy + TLS)                         │    │
│  │                       Port 443                                   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                           │
│                              ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      NEXT.JS APP                                 │    │
│  │                    (Port 3000 internal)                          │    │
│  │                                                                  │    │
│  │   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │    │
│  │   │  Chat API    │  │  Admin API   │  │ SuperUser API│          │    │
│  │   └──────────────┘  └──────────────┘  └──────────────┘          │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│         │              │              │                                 │
│         ▼              ▼              ▼                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                       │
│  │  DATABASE   │ │VECTOR STORE │ │    REDIS    │                       │
│  │ PostgreSQL  │ │   Qdrant    │ │  Port 6379  │                       │
│  │  Port 5432  │ │  Port 6333  │ │  (internal) │                       │
│  └─────────────┘ └─────────────┘ └─────────────┘                       │
│  * optional containers, via Docker profiles                              │
│         │              │              │                                 │
│         ▼              ▼              ▼                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                       │
│  │data/postgres│ │ data/qdrant │ │ data/redis  │                       │
│  │  (volume)   │ │  (volume)   │ │  (volume)   │                       │
│  │             │ │             │ └─────────────┘                       │
│  └─────────────┘ └─────────────┘                                       │
│         │                                                           │
│         ▼                                                           │
│  ┌─────────────┐                     ┌────────────────────────────┐   │
│  │  app_data   │ ◄── DB files +      │      LOCAL SERVICES        │   │
│  │  (volume)   │     global-docs +   │  ┌────────┐ ┌────────┐     │   │
│  └─────────────┘     threads         │  │ Ollama │ │Local   │     │   │
│                                      │  │        │ │Embed   │     │   │
│                                      │  └────────┘ └────────┘     │   │
│                                      └────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Storage Architecture

### Primary Database (PostgreSQL)

Local AI Assistant stores all structured metadata in PostgreSQL via the Kysely ORM:

| Data | Table | Notes |
|------|-------|-------|
| Users | `users` | Authentication, roles |
| Categories | `categories` | Category definitions |
| Documents metadata | `documents`, `document_categories` | Upload status, category links |
| Subscriptions | `user_subscriptions` | User → category access |
| Super user assignments | `super_user_categories` | Category management rights |
| Threads | `threads`, `thread_categories` | Chat sessions |
| Messages | `messages` | Chat history |
| Settings | `settings` | System configuration |

**PostgreSQL**:
- Container: `local-ai-assistant-postgres` (port 5432 internal)
- Schema auto-initialised on first start via Kysely migrations
- Connection pooling (max 20 connections, configurable)

### Vector Store (Qdrant)

Stores document embeddings for semantic search. Collections use the naming pattern `{slug}`:

| Collection Pattern | Purpose |
|-------------------|---------|
| `hr` | HR category documents |
| `finance` | Finance category documents |
| `{slug}` | Dynamic per category |

Global documents are indexed into ALL category collections.

- Container: `local-ai-assistant-qdrant` (port 6333 internal)
- Data at `data/qdrant/`
- Memory limit: 512MB (configurable in docker-compose)

### Filesystem

| Path | Purpose |
|------|---------|
| `data/postgres/` | PostgreSQL data directory |
| `data/qdrant/` | Qdrant vector data |
| `data/app/global-docs/` | Admin-uploaded policy PDFs |
| `data/app/threads/{userId}/{threadId}/uploads/` | User-uploaded PDFs |
| `data/app/threads/{userId}/{threadId}/outputs/` | AI-generated files |

---

## Environment Files

### Local Development (.env.local)

```env
# Ollama (required - local LLM)
OLLAMA_API_BASE=http://localhost:11434

# Local Embeddings (transformers.js)
EMBEDDING_MODEL=mxbai-embed-large
EMBEDDING_DIMENSIONS=1024

# Local Reranker (optional, BGE cross-encoder)
RERANKER_MODEL=BAAI/bge-reranker-v2-m3

# Vector store provider
VECTOR_STORE_PROVIDER=qdrant
QDRANT_HOST=localhost
QDRANT_PORT=6333

# Redis
REDIS_URL=redis://localhost:6379

# Auth (disabled for local dev)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=local-dev-secret-change-in-production
AUTH_DISABLED=true

# Admin
ADMIN_EMAILS=admin@example.com

# Storage
DATA_DIR=./data
```

### Production (.env)

```env
# Ollama (required - local LLM)
OLLAMA_API_BASE=http://ollama:11434

# Local Embeddings (transformers.js)
EMBEDDING_MODEL=mxbai-embed-large
EMBEDDING_DIMENSIONS=1024

# Local Reranker (optional, BGE cross-encoder)
RERANKER_MODEL=BAAI/bge-reranker-v2-m3

# PostgreSQL (always required)
POSTGRES_USER=laap
POSTGRES_PASSWORD=your-strong-password
POSTGRES_DB=laap

# Vector store provider
VECTOR_STORE_PROVIDER=qdrant
QDRANT_HOST=qdrant
QDRANT_PORT=6333

# Max upload size for backup restore (requires rebuild to change)
MAX_UPLOAD_SIZE=500mb

# Redis (internal Docker network)
REDIS_URL=redis://redis:6379

# Auth
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=generate-32-char-random-string

# Azure AD OAuth
AZURE_AD_CLIENT_ID=your-azure-client-id
AZURE_AD_CLIENT_SECRET=your-azure-client-secret
AZURE_AD_TENANT_ID=your-azure-tenant-id

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Email/Password Auth (optional)
EMAIL_AUTH_ENABLED=true
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASSWORD=your-smtp-password
SMTP_FROM=noreply@example.com

# Access Control
ACCESS_MODE=allowlist

AUTH_DISABLED=false

# Admin
ADMIN_EMAILS=admin@example.com

# Storage
DATA_DIR=/app/data

# Domain
DOMAIN=your-domain.com
ACME_EMAIL=admin@example.com
```

---

## Docker Compose — Profile-Based Services

`docker-compose.yml` uses Docker profiles to start only the services you need. Always use explicit `--profile` flags.

### Profile Reference

```
Vector Store:
  --profile qdrant      → Qdrant     (set VECTOR_STORE_PROVIDER=qdrant)

Database:
  --profile postgres    → PostgreSQL (always required)

Local LLM Inference:
  --profile ollama      → Ollama     (set OLLAMA_API_BASE=http://ollama:11434)

Always-on services (no profile needed):
  traefik, app, redis
```

> **Note:** `COMPOSE_PROFILES` env var is not reliable across Docker versions. Always pass `--profile` flags explicitly on the command line.

---

## Dockerfile

Multi-stage build for production.

```dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time environment variables
ENV NEXT_TELEMETRY_DISABLED=1

# Create public directory if it doesn't exist
RUN mkdir -p public

RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Create data directory for files
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

**Note**: Uses `npm ci` (not `npm ci --only=production`) because TypeScript and other devDependencies are required during the build stage.

---

## Infrastructure Selection Guide

Before deploying, choose the right combination of database and vector store for your scale.

### Database

PostgreSQL is the sole database backend. It provides connection pooling, high concurrency, and supports managed database services for HA/replication.

### Vector Store

Qdrant is the vector store for all deployments. It provides advanced payload filtering, cluster-ready scalability, and handles large document libraries efficiently.

| Scenario | Command |
|----------|---------|
| All deployments | `--profile postgres --profile qdrant` |

### Tuning for Large Deployments

**PostgreSQL:**
- Default connection pool: 10 max connections (sufficient for most cases)
- For very high traffic, use a managed PostgreSQL (Azure Database, AWS RDS, Supabase)

**Qdrant:**
- Default memory limit: 512MB (set in `docker-compose.yml` `deploy.resources.limits`)
- Increase to 1–2GB for collections >500K vectors by editing docker-compose.yml

---

## Docker Compose Files Reference

Local AI Assistant provides multiple Docker Compose files for different deployment scenarios:

| File | Purpose | Services | App Container |
|------|---------|----------|---------------|
| `docker-compose.local.yml` | **Local development** | Qdrant, Redis, Ollama (profile) | ❌ No - run with `npm run dev` |
| `docker-compose.yml` | **Production** | Traefik, App, Redis, Postgres, Qdrant, Ollama (profiles) | ✅ Yes |
| `docker-compose.dev.yml` | **Development testing** | Qdrant, Redis, Postgres | ❌ No |

### Key Differences

**docker-compose.local.yml (Local Development)**
- Exposes ports to localhost (6333, 6379, 11434)
- No app container - you run `npm run dev` locally
- Ollama behind `--profile ollama` flag
- Uses SQLite by default (no Postgres)

**docker-compose.yml (Production)**
- Full stack with Traefik reverse proxy
- Automatic TLS via Let's Encrypt
- All services on internal Docker network
- PostgreSQL and Qdrant behind profiles

**docker-compose.dev.yml (Development Testing)**
- Alternative infrastructure setup
- Includes PostgreSQL with local port exposure
- For testing/QA environments

## Local Development Setup

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- (Optional) Ollama installed locally, or use Docker with `--profile ollama`

### Steps

```bash
# 1. Clone repository
git clone <repo-url>
cd local-ai-assistant

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.example .env.local
# Edit .env.local - ensure OLLAMA_API_BASE is set

# 4. Start infrastructure services
# IMPORTANT: Ollama requires --profile ollama flag
docker compose -f docker-compose.local.yml --profile ollama up -d

# 5. Verify Ollama is running (optional)
curl -s http://localhost:11434/api/version

# 6. Wait for services to be healthy
docker compose -f docker-compose.local.yml ps

# 7. Start development server
npm run dev

# 8. Open browser
# http://localhost:3000
```

> **Note:** If you omit `--profile ollama`, only Qdrant and Redis will start. Ollama won't be available unless you have it installed natively on your system.

### Useful Commands

```bash
# View service logs
docker compose -f docker-compose.local.yml logs -f qdrant
docker compose -f docker-compose.local.yml logs -f redis

# Restart services
docker compose -f docker-compose.local.yml restart

# Stop services
docker compose -f docker-compose.local.yml down

# Stop and remove volumes (clean slate)
docker compose -f docker-compose.local.yml down -v
```

---

## Pre-Production Deployment

### Server Requirements

- Ubuntu 22.04+ or similar Linux
- Docker 29.x or later
- Docker Compose v2
- 8GB RAM minimum
- 20GB disk space
- Ports 80, 443 open

**Verify your Docker version:**
```bash
docker --version
# Should show: Docker version 29.x or later
```

> **⚠️ IMPORTANT: Lock Docker & Traefik Versions**
>
> After installation, hold Docker packages to prevent automatic upgrades that may break compatibility:
> ```bash
> # Hold Docker at current version
> sudo apt-mark hold docker-ce docker-ce-cli docker-compose-plugin
>
> # Verify holds are in place
> apt-mark showhold
> ```
>
> Traefik is pinned to a specific version (`traefik:v3.6.1`) in `docker-compose.yml`. Do not change to floating tags like `traefik:latest` or `traefik:v3` as minor updates may introduce breaking changes.
>
> **To upgrade later:** Test new versions in a staging environment first, then update the pinned version in `docker-compose.yml` and run `docker compose pull && docker compose up -d`.

### DNS Configuration

Point domain to server IP:
```
local-ai-assistant.yourdomain.com → <SERVER_IP>
```

### Deployment Steps

```bash
# 1. SSH to server
ssh user@server

# 2. Clone repository
git clone <repo-url>
cd local-ai-assistant

# 3. Create production environment file
cp .env.example .env
# Edit .env — set required values:
# - OLLAMA_API_BASE=http://ollama:11434
# - NEXTAUTH_SECRET (generate with: openssl rand -base64 32)
# - VECTOR_STORE_PROVIDER=qdrant
# - POSTGRES_PASSWORD
# - DOMAIN=your-domain.com
# - ACME_EMAIL=admin@example.com

# 4. Choose profiles (postgres is always required, pick a vector store)
# Example: PostgreSQL + Qdrant + Ollama
docker compose --profile postgres --profile qdrant --profile ollama up -d --build

# 5. Check status
docker compose ps

# 6. View logs
docker compose logs -f app

# 7. Verify TLS certificate
curl -I https://local-ai-assistant.yourdomain.com
```

### Initial Setup

```bash
# 1. Access admin panel
# https://local-ai-assistant.yourdomain.com/admin

# 2. Create categories
# Go to Categories tab, add: HR, Finance, IT, Legal, etc.

# 3. Upload documents
# Go to Documents tab, upload PDFs with category assignments

# 4. Add users
# Go to Users tab, add users with subscriptions
# - Admin: full access
# - SuperUser: assign categories to manage
# - User: subscribe to categories
```

---

## Operations

### Monitoring

```bash
# Container status
docker compose ps

# Resource usage
docker stats

# Application logs
docker compose logs -f app

# All logs
docker compose logs -f

# Database size (PostgreSQL)
docker exec local-ai-assistant-postgres psql -U laap -c "SELECT pg_size_pretty(pg_database_size('laap'));"

# Vector store data size
du -sh data/qdrant/
```

### Backup

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backups/local-ai-assistant"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup PostgreSQL database
docker exec local-ai-assistant-postgres pg_dump -U localaiassistant localaiassistant > $BACKUP_DIR/postgres-$DATE.sql

# Backup app data (global-docs, threads)
docker run --rm \
  -v local-ai-assistant-app-data:/data \
  -v $BACKUP_DIR:/backup \
  alpine tar czvf /backup/app-data-$DATE.tar.gz -C /data .

# Backup Qdrant
docker run --rm \
  -v local-ai-assistant-qdrant-data:/data \
  -v $BACKUP_DIR:/backup \
  alpine tar czvf /backup/qdrant-$DATE.tar.gz -C /data .

# Backup Redis
docker run --rm \
  -v local-ai-assistant-redis-data:/data \
  -v $BACKUP_DIR:/backup \
  alpine tar czvf /backup/redis-$DATE.tar.gz -C /data .

# Keep last 7 days
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
find $BACKUP_DIR -name "*.db" -mtime +7 -delete

echo "Backup completed: $DATE"
```

### Restore

```bash
#!/bin/bash
# restore.sh

BACKUP_DIR="/backups/local-ai-assistant"
DATE=$1  # Pass date as argument

if [ -z "$DATE" ]; then
  echo "Usage: ./restore.sh YYYYMMDD_HHMMSS"
  exit 1
fi

# Stop services
docker compose down

# Restore PostgreSQL database
docker exec -i local-ai-assistant-postgres psql -U localaiassistant localaiassistant < $BACKUP_DIR/postgres-$DATE.sql

# Restore app data (includes global-docs and threads)
docker run --rm \
  -v local-ai-assistant-app-data:/data \
  -v $BACKUP_DIR:/backup \
  alpine sh -c "rm -rf /data/* && tar xzvf /backup/app-data-$DATE.tar.gz -C /data"

# Restore Qdrant
docker run --rm \
  -v local-ai-assistant-qdrant-data:/data \
  -v $BACKUP_DIR:/backup \
  alpine sh -c "rm -rf /data/* && tar xzvf /backup/qdrant-$DATE.tar.gz -C /data"

# Restore Redis
docker run --rm \
  -v local-ai-assistant-redis-data:/data \
  -v $BACKUP_DIR:/backup \
  alpine sh -c "rm -rf /data/* && tar xzvf /backup/redis-$DATE.tar.gz -C /data"

# Start services
docker compose up -d

echo "Restore completed from: $DATE"
```

### Database Maintenance

#### PostgreSQL

```bash
# Check connection and record counts
docker exec local-ai-assistant-postgres psql -U localaiassistant -c "SELECT COUNT(*) FROM users;"
docker exec local-ai-assistant-postgres psql -U localaiassistant -c "SELECT COUNT(*) FROM documents;"

# Database size
docker exec local-ai-assistant-postgres psql -U localaiassistant -c "SELECT pg_size_pretty(pg_database_size('localaiassistant'));"

# Active connections
docker exec local-ai-assistant-postgres psql -U localaiassistant -c "SELECT count(*) FROM pg_stat_activity;"

# Note: PostgreSQL performs auto-vacuum automatically — no manual VACUUM needed
```

### Updates

```bash
# Pull latest code
git pull origin main

# Rebuild and restart (use same profiles as your deployment)
docker compose --profile postgres --profile qdrant up -d --build

# Verify
docker compose ps
docker compose logs -f app
```

### Rollback

```bash
# If update fails, rollback to previous image
docker compose --profile postgres --profile qdrant down
git checkout <previous-commit>
docker compose --profile postgres --profile qdrant up -d --build
```

> **Note:** PWA support has been removed from Local AI Assistant. The PWA features are no longer available.

---

## Health Checks

### Endpoints

| Service | URL / Command | Expected | When Active |
|---------|--------------|----------|-------------|
| App | `/api/auth/session` | 200 OK | Always |
| Redis | `redis-cli ping` | PONG | Always |
| Ollama | `http://ollama:11434/api/tags` | 200 OK | `--profile ollama` |
| Qdrant | `http://qdrant:6333/readyz` | 200 OK | `--profile qdrant` |
| PostgreSQL | `pg_isready -U localaiassistant` | accepting | `--profile postgres` (always) |

> **Tip:** Use Admin → Dashboard → Infrastructure to check provider status via the UI.

### Health Check Script

```bash
#!/bin/bash
# healthcheck.sh — adjust APP_URL and uncomment active providers

APP_URL="https://your-domain.com"

# Always-on services
if curl -sf "$APP_URL/api/auth/session" > /dev/null; then
  echo "✓ App: healthy"
else
  echo "✗ App: unhealthy"
fi

if docker exec local-ai-assistant-redis redis-cli ping | grep -q PONG; then
  echo "✓ Redis: healthy"
else
  echo "✗ Redis: unhealthy"
fi

# Ollama (if running)
if docker exec local-ai-assistant-ollama curl -sf http://localhost:11434/api/tags > /dev/null; then
  echo "✓ Ollama: healthy"
else
  echo "✗ Ollama: unhealthy"
fi

# Qdrant
if docker exec local-ai-assistant-qdrant curl -sf http://localhost:6333/readyz > /dev/null; then
  echo "✓ Qdrant: healthy"
else
  echo "✗ Qdrant: unhealthy"
# fi

# PostgreSQL (always active)
if docker exec local-ai-assistant-postgres pg_isready -U localaiassistant | grep -q "accepting"; then
  echo "✓ PostgreSQL: healthy"
else
  echo "✗ PostgreSQL: unhealthy"
fi
```

---

## Security Checklist

### Before Deployment

- [ ] Generate strong `NEXTAUTH_SECRET` (32+ characters)
- [ ] Configure Azure AD app registration
- [ ] Configure Google OAuth credentials (optional)
- [ ] Set `ACCESS_MODE` (allowlist or domain)
- [ ] Add admin emails to `ADMIN_EMAILS`
- [ ] Verify `.env` is in `.gitignore`

### After Deployment

- [ ] Verify TLS certificate is valid
- [ ] Test Azure AD login flow
- [ ] Test Google OAuth login flow (if configured)
- [ ] Verify admin access control
- [ ] Create initial categories
- [ ] Add initial users to allowlist (if ACCESS_MODE=allowlist)
- [ ] Assign super users to categories
- [ ] Subscribe regular users to categories
- [ ] Test file upload limits
- [ ] Check CORS settings

### Data Sources & Function APIs

- [ ] Ensure outbound network access is allowed for external API calls
- [ ] Store API credentials securely (encrypted in database)
- [ ] Review data source categories to ensure proper access control
- [ ] Test data source connectivity before assigning to categories
- [ ] Monitor data source usage via audit logs
- [ ] Configure firewall rules for specific external API domains if required

### Ongoing

- [ ] Monitor for unauthorized access attempts
- [ ] Review container logs weekly
- [ ] Update base images monthly
- [ ] Rotate secrets quarterly
- [ ] Review user allowlist regularly
- [ ] Monitor database storage size (`du -sh data/app/` or PostgreSQL `pg_database_size`)
- [ ] PostgreSQL: auto-vacuumed (no manual action needed)
- [ ] Monitor vector store data size (`du -sh data/qdrant/`)

---

## Troubleshooting

### Common Issues

#### TLS Certificate Not Issued

```bash
# Check Traefik logs
docker compose logs traefik

# Verify DNS propagation
dig local-ai-assistant.yourdomain.com

# Check Let's Encrypt rate limits
# https://letsencrypt.org/docs/rate-limits/
```

#### Qdrant Connection Failed

```bash
# Check if running (requires --profile qdrant)
docker compose --profile qdrant ps qdrant

# Check logs
docker compose --profile qdrant logs qdrant

# Test connection
docker exec local-ai-assistant-qdrant curl http://localhost:6333/readyz
```

#### PostgreSQL Connection Failed

```bash
# Check if running (requires --profile postgres)
docker compose --profile postgres ps postgres

# Check logs
docker compose --profile postgres logs postgres

# Test connection
docker exec local-ai-assistant-postgres pg_isready -U localaiassistant

# Check schema was initialised (should show 49+ tables)
docker exec local-ai-assistant-postgres psql -U localaiassistant -c "\dt" | wc -l
```

#### Redis Connection Failed

```bash
# Check if running
docker compose ps redis

# Check logs
docker compose logs redis

# Test connection
docker exec local-ai-assistant-redis redis-cli ping
```

#### Out of Memory

```bash
# Check memory usage
docker stats

# Increase swap if needed
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

---

## Resource Requirements

### Development

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 8 GB | 16 GB |
| Disk | 10 GB | 20 GB |

### Pre-Production / Production

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 8 GB | 16 GB |
| Disk | 20 GB | 50 GB |
| Network | 10 Mbps | 100 Mbps |

### Storage Breakdown

| Component | Typical Size | Notes |
|-----------|--------------|-------|
| PostgreSQL data | 50–500 MB | `data/postgres/` |
| Global documents | 100 MB – 1 GB | `data/app/global-docs/` |
| Qdrant vectors | 100 MB – 2 GB | `data/qdrant/` |
| Redis cache | 10–100 MB | Sessions + RAG cache |
| Thread data | 50 MB – 500 MB | Uploads and outputs |

### Additional RAM by Provider

| Provider | Additional RAM |
|----------|---------------|
| Qdrant | ~512 MB (hard limit in docker-compose) |
| PostgreSQL | ~100–256 MB |
| Ollama | 2-8 GB (depends on model loaded) |

---

## Cost Estimation

Local AI Assistant runs entirely locally using Ollama, so there are no per-token API costs.

### Local LLM Models (Ollama)

Ollama runs models locally on your infrastructure. Model selection affects resource usage:

| Model | RAM Required | Use Case |
|-------|--------------|----------|
| llama3.2:1b | ~2 GB | Basic Q&A, simple RAG |
| llama3.2:3b | ~4 GB | General purpose |
| llama3.2:7b | ~8 GB | Complex reasoning |
| qwen2.5:7b | ~8 GB | Good performance |
| mistral:7b | ~8 GB | Balanced |

### Infrastructure (Self-Hosted VM)

| Provider | Spec | Cost |
|----------|------|------|
| Azure B2ms | 2 vCPU, 8GB RAM | ~$60/month |
| DigitalOcean | 2 vCPU, 8GB RAM | ~$48/month |
| AWS t3.large | 2 vCPU, 8GB RAM | ~$60/month |

**Note:** For larger models (7B+), consider 4 vCPU, 16GB RAM for optimal performance.

**Total Infrastructure: ~$50-65/month** (no API costs)
