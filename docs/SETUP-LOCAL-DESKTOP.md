# Local AI Assistant - Local/Desktop Setup Guide

## Overview

This guide covers setting up Local AI Assistant on your local machine or desktop for development, testing, or personal use. For production deployments, see [SETUP-AZURE-PRODUCTION.md](SETUP-AZURE-PRODUCTION.md).

---

## Prerequisites

### Hardware Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 8 GB | 16 GB (for larger models) |
| Disk | 10 GB | 20 GB |
| GPU | Optional | NVIDIA GPU with 6GB+ VRAM for faster inference |

### Software Requirements

| Software | Version | Notes |
|----------|---------|-------|
| Node.js | 20.x LTS | Required for running the Next.js app |
| Docker | 24.x+ | For infrastructure services |
| Docker Compose | v2.x | Comes with Docker Desktop |
| Git | Latest | For cloning the repository |

### Verify Prerequisites

```bash
# Check Node.js version
node --version
# Should show v20.x.x

# Check Docker version
docker --version
# Should show Docker version 24.x or later

# Check Docker Compose version
docker compose version
# Should show Docker Compose version v2.x

# Check Git
git --version
```

---

## Quick Start (5 Minutes)

### Step 1: Clone Repository

```bash
git clone https://github.com/your-org/local-ai-assistant.git
cd local-ai-assistant
```

### Step 2: Create Environment File

```bash
cp .env.example .env.local
```

Edit `.env.local` with your settings:

```env
# Required: Admin email(s) - comma-separated
ADMIN_EMAILS=your-email@example.com

# Required: NextAuth secret (generate with: openssl rand -base64 32)
NEXTAUTH_SECRET=your-generated-secret-here

# Optional: Disable auth for local development
AUTH_DISABLED=true

# Database (PostgreSQL - included in docker-compose.local.yml)
DATABASE_PROVIDER=postgres
POSTGRES_USER=laap
POSTGRES_PASSWORD=laap-local-password
POSTGRES_DB=laap
DATABASE_URL=postgresql://laap:laap-local-password@localhost:5432/laap

# Ollama (local LLM)
OLLAMA_API_BASE=http://localhost:11434
DEFAULT_OLLAMA_MODEL=qwen3:1.7b
OLLAMA_MODEL=qwen3:1.7b
OLLAMA_PULL_MODELS=qwen3:1.7b,qwen3.5:0.8b,qwen3-embedding:0.6b,bbjson/bge-reranker-base
OLLAMA_RERANKER_MODEL=bbjson/bge-reranker-base

# Embeddings (local via Ollama)
EMBEDDING_MODEL=ollama-qwen3-embedding:0.6b
EMBEDDING_DIMENSIONS=1024

# Vector Store
QDRANT_HOST=localhost
QDRANT_PORT=6333

# Redis
REDIS_URL=redis://localhost:6379

# Storage
DATA_DIR=./data
```

### Step 3: Start Infrastructure Services

```bash
# Start all infrastructure services (PostgreSQL, Qdrant, Redis, Ollama)
docker compose -f docker-compose.local.yml --profile ollama up -d
```

### Step 4: Verify Services

```bash
# Check all containers are running
docker compose -f docker-compose.local.yml ps

# Verify PostgreSQL
docker exec laap-postgres-local pg_isready -U laap

# Verify Redis
docker exec local-ai-assistant-redis-local redis-cli ping

# Verify Ollama
curl -s http://localhost:11434/api/version

# Verify models downloaded for chat, embeddings, and reranking
docker exec local-ai-assistant-ollama-local ollama list
```

### Step 5: Install Dependencies and Start App

```bash
# Install Node.js dependencies
npm install

# Start development server
npm run dev
```

### Step 6: Access the Application

Open your browser and navigate to: **http://localhost:3000**

---

## Detailed Setup Instructions

### Option A: Docker Ollama (Recommended)

Ollama runs in a Docker container, making setup simple and isolated.

```bash
# Start with Ollama profile
docker compose -f docker-compose.local.yml --profile ollama up -d

# Wait for Ollama to be ready (first run pulls the image)
sleep 30

# Verify Ollama is running
curl -s http://localhost:11434/api/version
# Expected: {"version":"0.21.2"}
```

The first run downloads models listed in `OLLAMA_PULL_MODELS`. Watch progress with:

```bash
docker compose -f docker-compose.local.yml logs -f ollama
```

**Pre-loaded Models:**
- `qwen3:1.7b` - Default chat model
- `qwen3.5:0.8b` - Lightweight alternative
- `qwen3-embedding:0.6b` - Embedding model for RAG
- `bbjson/bge-reranker-base` - Local reranker model

**Pull Additional Models:**

```bash
# List available models
curl -s http://localhost:11434/api/tags | jq '.models[].name'

# Pull a specific model
docker exec local-ai-assistant-ollama-local ollama pull llama3.2:3b

# Pull a larger model (requires more RAM)
docker exec local-ai-assistant-ollama-local ollama pull mistral:7b
```

### Option B: Native Ollama (Advanced)

If you have Ollama installed natively on your system:

```bash
# Start infrastructure without Ollama container
docker compose -f docker-compose.local.yml up -d

# Ensure native Ollama is running on port 11434
ollama serve

# In .env.local, set:
OLLAMA_API_BASE=http://localhost:11434
```

### Database Configuration

The local setup uses PostgreSQL by default:

| Setting | Value |
|---------|-------|
| Host | localhost |
| Port | 5432 |
| Database | laap |
| User | laap |
| Password | laap-local-password |

**Connection String:**
```
postgresql://laap:laap-local-password@localhost:5432/laap
```

**Access PostgreSQL directly:**

```bash
# Connect via psql
docker exec -it laap-postgres-local psql -U laap -d laap

# List tables
\dt

# Check users
SELECT * FROM users;
```

---

## Service Management

### Start Services

```bash
# Start all services
docker compose -f docker-compose.local.yml --profile ollama up -d

# Start without Ollama (if using native Ollama)
docker compose -f docker-compose.local.yml up -d
```

### Stop Services

```bash
# Stop all services (preserves data)
docker compose -f docker-compose.local.yml down

# Stop and remove data volumes (clean slate)
docker compose -f docker-compose.local.yml down -v
```

### View Logs

```bash
# All services
docker compose -f docker-compose.local.yml logs -f

# Specific service
docker compose -f docker-compose.local.yml logs -f postgres
docker compose -f docker-compose.local.yml logs -f ollama
```

### Restart Services

```bash
# Restart all services
docker compose -f docker-compose.local.yml restart

# Restart specific service
docker compose -f docker-compose.local.yml restart postgres
```

---

## Troubleshooting

### Port Conflicts

If ports are already in use:

| Service | Default Port | Check What's Using It |
|---------|--------------|----------------------|
| PostgreSQL | 5432 | `sudo lsof -i :5432` |
| Redis | 6379 | `sudo lsof -i :6379` |
| Qdrant | 6333 | `sudo lsof -i :6333` |
| Ollama | 11434 | `sudo lsof -i :11434` |
| Next.js | 3000 | `sudo lsof -i :3000` |

**Solution:** Stop conflicting services or modify ports in `docker-compose.local.yml`.

### Database Connection Errors

```bash
# Check PostgreSQL is running
docker compose -f docker-compose.local.yml ps postgres

# Check PostgreSQL logs
docker compose -f docker-compose.local.yml logs postgres

# Test connection
docker exec laap-postgres-local pg_isready -U laap
```

### Ollama Not Responding

```bash
# Check Ollama container
docker compose -f docker-compose.local.yml ps ollama

# Check Ollama logs
docker compose -f docker-compose.local.yml logs ollama

# Restart Ollama
docker compose -f docker-compose.local.yml restart ollama

# Wait for model to load (first run takes time)
sleep 60
curl -s http://localhost:11434/api/version
```

### App Won't Start

```bash
# Check Node.js version (must be 20+)
node --version

# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check for TypeScript errors
npm run build
```

---

## Data Management

### Backup Database

```bash
# Create backup
docker exec laap-postgres-local pg_dump -U laap laap > backup_$(date +%Y%m%d).sql
```

### Restore Database

```bash
# Restore from backup
cat backup_20260424.sql | docker exec -i laap-postgres-local psql -U laap -d laap
```

### Clear All Data

```bash
# Stop and remove all data
docker compose -f docker-compose.local.yml down -v

# Remove Ollama models (optional)
docker volume rm local-ai-assistant-ollama-models-local
```

---

## Next Steps

1. **Access Admin Panel:** http://localhost:3000/admin
2. **Create Categories:** Organize documents by department/topic
3. **Upload Documents:** Add PDFs, DOCX files to categories
4. **Configure Prompts:** Customize AI behavior per category
5. **Add Users:** Set up user access and subscriptions

---

## Common Commands Reference

```bash
# Start everything
docker compose -f docker-compose.local.yml --profile ollama up -d

# Check status
docker compose -f docker-compose.local.yml ps

# View logs
docker compose -f docker-compose.local.yml logs -f

# Stop everything
docker compose -f docker-compose.local.yml down

# Start app
npm run dev

# Run database migrations (automatic on startup)
# Manual check:
docker exec laap-postgres-local psql -U laap -d laap -c "\dt" | wc -l
```

---

## Related Documentation

- [SETUP-AZURE-PRODUCTION.md](SETUP-AZURE-PRODUCTION.md) - Production deployment guide
- [INFRASTRUCTURE.md](tech/INFRASTRUCTURE.md) - Architecture details
- [DATABASE.md](tech/DATABASE.md) - Database schema reference
- [ADMIN_GUIDE.md](user_manuals/ADMIN_GUIDE.md) - Admin dashboard guide
