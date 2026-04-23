# Fresh VM Setup Guide for Local AI Assistant

Complete step-by-step instructions for deploying Local AI Assistant on a fresh Ubuntu VM.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Server Preparation](#server-preparation)
3. [Docker Installation](#docker-installation)
4. [Clone Repository](#clone-repository)
5. [Environment Configuration](#environment-configuration)
6. [Initial Setup](#initial-setup)
7. [Start Services](#start-services)
8. [Post-Installation Configuration](#post-installation-configuration)
9. [Verification & Health Checks](#verification--health-checks)
10. [Troubleshooting](#troubleshooting)
11. [Maintenance](#maintenance)

---

## Prerequisites

### Hardware Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 4 GB | 8+ GB (16GB recommended for local models) |
| Storage | 20 GB | 100+ GB SSD |
| Network | 100 Mbps | 1 Gbps |

### Software Requirements

- Ubuntu 24.04 LTS or later (or Debian 12+)
- Docker 24.x or later
- Docker Compose v2.x
- Git

### Network Requirements

- Domain name pointing to server IP
- Ports 80 and 443 open for inbound traffic

### Local-Only Deployment

Local AI Assistant is designed for **local-only deployment** using Ollama for all LLM inference. This ensures:
- No data leaves your network
- No external API dependencies
- Works in air-gapped environments
- Zero API costs for LLM inference

**Optional:** For non-sensitive data, you can optionally add cloud LLM providers (OpenAI, Anthropic, etc.) via direct API calls.

---

## Server Preparation

### 1. Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Install Required Packages

```bash
sudo apt install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    htop \
    nano \
    jq
```

### 3. Configure Firewall

```bash
# Allow SSH, HTTP, HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

### 4. Set Timezone

```bash
sudo timedatectl set-timezone UTC
# Or your preferred timezone:
# sudo timedatectl set-timezone America/New_York
```

### 5. Configure Swap (if RAM < 16GB)

```bash
# Create 8GB swap file (recommended for local models)
sudo fallocate -l 8G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## Docker Installation

### 1. Add Docker Repository

```bash
# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add the repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

### 2. Install Docker

```bash
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### 3. Configure Docker for Non-Root User

```bash
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
docker compose version
```

### 4. Lock Docker Version (Recommended)

```bash
# Prevent automatic upgrades that might break things
sudo apt-mark hold docker-ce docker-ce-cli containerd.io
```

---

## Clone Repository

### 1. Clone the Repository

```bash
cd /opt
sudo git clone https://github.com/your-org/local-ai-assistant.git
sudo chown -R $USER:$USER local-ai-assistant
cd local-ai-assistant
```

### 2. Run Initial Setup Script

**Important:** Run the setup script to create data directories with correct permissions:

```bash
./setup.sh
```

This script:
- Creates `./data/app` directory
- Creates `./data/transformers_cache` directory with proper permissions
- Sets permissions for local embedding/reranker model caching

> **Note:** The Docker entrypoint also handles permissions automatically, but running setup.sh ensures everything is ready before first start.

---

## Environment Configuration

### 1. Create Environment File

```bash
cp .env.example .env
nano .env
```

### 2. Required Environment Variables

Edit `.env` with the following minimum configuration:

```bash
# =============================================================================
# CORE SETTINGS (Required)
# =============================================================================

# Domain for your deployment
DOMAIN=localai.example.com

# Admin email addresses (comma-separated)
ADMIN_EMAILS=admin@example.com,ops@example.com

# NextAuth secret (generate with: openssl rand -base64 32)
NEXTAUTH_SECRET=your-32-character-random-string-here

# NextAuth URL (your full domain with https)
NEXTAUTH_URL=https://localai.example.com

# Let's Encrypt email for SSL certificates
ACME_EMAIL=admin@example.com

# =============================================================================
# DATABASE CONFIGURATION
# =============================================================================

# PostgreSQL (required)
POSTGRES_USER=localai
POSTGRES_PASSWORD=your-strong-password-here
POSTGRES_DB=localai

# =============================================================================
# VECTOR STORE CONFIGURATION
# =============================================================================

# Vector store provider
VECTOR_STORE_PROVIDER=qdrant

# Qdrant settings
QDRANT_HOST=qdrant
QDRANT_PORT=6333

# =============================================================================
# AUTHENTICATION
# =============================================================================

# Credentials login is ENABLED by default for fresh deployments
# Set initial admin password (used on first run if admin has no password)
CREDENTIALS_ADMIN_PASSWORD=your-secure-initial-password

# Azure AD (Microsoft Entra ID) - Optional, configure after first login
# AZURE_AD_CLIENT_ID=
# AZURE_AD_CLIENT_SECRET=
# AZURE_AD_TENANT_ID=

# Google OAuth - Optional, configure after first login
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=

# Access control mode: allowlist or domain
ACCESS_MODE=allowlist

# =============================================================================
# OLLAMA (Local LLM - Primary)
# =============================================================================

# Ollama API base URL (local inference)
OLLAMA_API_BASE=http://ollama:11434

# =============================================================================
# REDIS
# =============================================================================

REDIS_URL=redis://redis:6379

# =============================================================================
# OPTIONAL API KEYS (for non-sensitive data only)
# =============================================================================

# Cloud LLM providers (optional - for non-sensitive data only)
# OPENAI_API_KEY=sk-proj-...    # Only if needed for non-sensitive queries
# ANTHROPIC_API_KEY=            # Only if needed for non-sensitive queries

# Web search (optional)
# TAVILY_API_KEY=               # For web search capability

# Reranking (optional - local BGE reranker is default)
# COHERE_API_KEY=               # For cloud-based reranking

# Data source encryption (generate with: openssl rand -hex 32)
# DATA_SOURCE_ENCRYPTION_KEY=
```

### 3. Generate Secrets

```bash
# Generate NEXTAUTH_SECRET
echo "NEXTAUTH_SECRET=$(openssl rand -base64 32)"

# Generate DATA_SOURCE_ENCRYPTION_KEY (optional)
echo "DATA_SOURCE_ENCRYPTION_KEY=$(openssl rand -hex 32)"

# Generate strong PostgreSQL password
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)"
```

---

## Initial Setup

### 1. Configure DNS

Before starting, ensure your domain points to the server:

```bash
# Verify DNS resolution
dig localai.example.com +short
# Should return your server's IP address

# Or use host command
host localai.example.com
```

> **Important:** DNS must propagate before Let's Encrypt can issue certificates. Allow 5-15 minutes after DNS changes.

### 2. Review Docker Compose Profiles

Local AI Assistant uses Docker Compose profiles to select services:

| Profile | Service | Use Case |
|---------|---------|----------|
| `qdrant` | Qdrant vector store | All deployments |
| `postgres` | PostgreSQL database | Required (all deployments) |
| `ollama` | Ollama local LLM | Recommended for local-only deployment |

**Recommended deployment (local-only):**

```bash
# Full local deployment (PostgreSQL + Qdrant + Ollama)
docker compose --profile postgres --profile qdrant --profile ollama up -d
```

**Minimal deployment (external Ollama):**

```bash
# If Ollama runs on a different machine
docker compose --profile postgres --profile qdrant up -d
```

---

## Start Services

### 1. Build and Start

```bash
# Build and start (PostgreSQL + Qdrant + Ollama)
docker compose --profile postgres --profile qdrant --profile ollama up -d --build
```

### 2. Monitor Startup

```bash
# Watch logs during startup
docker compose logs -f

# Check service status
docker compose ps
```

### 3. Wait for Services to be Healthy

All services should show "healthy" status:

```bash
docker compose ps
```

Expected output:
```
NAME                    STATUS                   PORTS
local-ai-assistant-app  Up (healthy)             0.0.0.0:3000->3000/tcp
local-ai-assistant-qdrant    Up (healthy)        6333/tcp
local-ai-assistant-ollama    Up (healthy)        11434/tcp
local-ai-assistant-redis     Up (healthy)        6379/tcp
local-ai-assistant-traefik   Up                  0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
```

### 4. Verify SSL Certificate

```bash
# Check certificate issuance
docker compose logs traefik | grep -i certificate

# Test HTTPS
curl -I https://localai.example.com
```

---

## Post-Installation Configuration

### 1. First Login (Before OAuth Setup)

Local AI Assistant supports email/password login by default, allowing initial access without OAuth:

1. Navigate to `https://localai.example.com/auth/signin`
2. Enter the admin email from `ADMIN_EMAILS` (e.g., `admin@example.com`)
3. Enter the password from `CREDENTIALS_ADMIN_PASSWORD`
4. You're now logged in as admin

> **Tip:** After configuring OAuth providers, you can disable credentials login via Admin → Users → Credentials Authentication.

### 2. Access Admin Dashboard

1. Click your profile or the menu icon
2. Select **Admin** from the navigation
3. Or navigate directly to `/admin`

### 3. Initial Admin Tasks

#### Create Categories
1. Admin → Categories → Add Category
2. Create categories like: HR, Finance, IT, Legal, Operations
3. Each category creates a separate vector store collection

#### Upload Documents
1. Admin → Documents → Upload
2. Select category and upload policy documents
3. Supported formats: PDF, DOCX, XLSX, PPTX, TXT, MD

#### Configure Users
1. Admin → Users → Add User
2. Set role: `user`, `superuser`, or `admin`
3. Assign category subscriptions

#### Configure LLM Settings
1. Admin → Settings → LLM Configuration
2. Select default model (e.g., `llama3.2` or your preferred Ollama model)
3. Adjust temperature, max tokens as needed

> **Note:** For local-only deployment, only Ollama models will be available. Cloud providers can be enabled later for non-sensitive data.

#### Configure System Prompt
1. Admin → Settings → Prompts
2. Customize the global system prompt
3. Add category-specific prompts if needed

### 4. Configure Reranker (Optional)

The reranker improves search result quality:

1. Admin → Settings → Reranker
2. Enable reranking
3. Configure provider priority:
   - **BGE Large** - Best accuracy, ~670MB download on first use (recommended for local)
   - **BGE Base** - Smaller model, ~220MB
   - **Cohere** - Fast API-based (requires API key, for non-sensitive data only)

### 5. Configure OAuth & Disable Credentials (Optional)

After initial setup, you may want to switch to OAuth-only authentication:

#### Add OAuth Provider

1. Get credentials from Azure Portal or Google Cloud Console (see [Authentication Guide](auth.md))
2. Add to `.env`:
   ```bash
   # Azure AD
   AZURE_AD_CLIENT_ID=your-client-id
   AZURE_AD_CLIENT_SECRET=your-client-secret
   AZURE_AD_TENANT_ID=your-tenant-id

   # Or Google
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```
3. Restart the application:
   ```bash
   docker compose restart app
   ```
4. Verify OAuth login works

#### Disable Credentials Login (Optional)

Once OAuth is working, you can disable email/password login:

1. Admin → Users → expand **Credentials Authentication**
2. Toggle **Enable Credentials Login** to OFF
3. Click **Save Changes**
4. Restart the application

> **Warning:** Ensure OAuth is working before disabling credentials, or you may lock yourself out.

---

## Verification & Health Checks

### 1. Service Health Endpoints

```bash
# Application
curl -s https://localai.example.com/api/health | jq

# Ollama
docker compose exec ollama curl -s http://localhost:11434/api/tags

# Redis
docker compose exec redis redis-cli ping
# Expected: PONG

# Qdrant
docker compose exec qdrant curl -s http://localhost:6333/readyz

# PostgreSQL
docker compose exec postgres pg_isready -U localai
```

### 2. Test LLM Connection

```bash
# Test Ollama models
docker compose exec ollama curl -s http://localhost:11434/api/tags | jq '.models[].name'
```

### 3. Test Chat Functionality

1. Log in to the application
2. Start a new chat
3. Ask a simple question
4. Verify response is generated

### 4. Monitor Resource Usage

```bash
# Container resource usage
docker stats

# Disk usage
df -h
du -sh ./data/*
```

---

## Troubleshooting

### SSL Certificate Issues

```bash
# Check Traefik logs for certificate errors
docker compose logs traefik | grep -i "certificate\|acme\|error"

# Verify DNS is correct
dig localai.example.com +short

# Force certificate renewal (careful - rate limits apply)
docker compose restart traefik
```

### Database Connection Issues

```bash
# PostgreSQL - check connection
docker compose exec postgres psql -U localai -c "SELECT 1"

# Reinitialize database schema
docker compose exec app npm run db:setup
```

### Ollama Connection Issues

```bash
# Check Ollama logs
docker compose logs ollama | tail -50

# Test Ollama API directly
docker compose exec ollama curl -s http://localhost:11434/api/tags

# Pull a model if none available
docker compose exec ollama pull llama3.2
```

### Out of Memory

```bash
# Check memory usage
free -h
docker stats --no-stream

# Add more swap if needed
sudo fallocate -l 8G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Restart services
docker compose restart
```

### Container Won't Start

```bash
# Check logs for specific container
docker compose logs app

# Check for port conflicts
sudo lsof -i :80
sudo lsof -i :443
sudo lsof -i :3000

# Rebuild container
docker compose up -d --build app
```

### Vector Store Issues

```bash
# Qdrant reset (WARNING: deletes all vectors)
docker compose stop qdrant
sudo rm -rf ./data/qdrant/*
docker compose up -d qdrant

# Qdrant health check
docker compose exec qdrant curl http://localhost:6333/readyz
```

---

## Maintenance

### Daily Operations

```bash
# Check service status
docker compose ps

# View recent logs
docker compose logs --since 1h

# Monitor resources
docker stats --no-stream
```

### Backup

#### Via Admin UI
1. Admin → System Management → Backup
2. Click "Create Backup"
3. Download the backup file

#### Via Command Line
```bash
# PostgreSQL backup
docker compose exec postgres pg_dump -U localai localai > ./backups/$(date +%Y%m%d).sql
```

### Updates

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker compose --profile postgres --profile qdrant --profile ollama down
docker compose --profile postgres --profile qdrant --profile ollama up -d --build

# Check logs for issues
docker compose logs -f app
```

### Database Maintenance

#### PostgreSQL
```bash
# Analyze tables (automatic, but can run manually)
docker compose exec postgres psql -U localai -c "ANALYZE;"

# Check database size
docker compose exec postgres psql -U localai -c "SELECT pg_size_pretty(pg_database_size('localai'));"
```

### Log Rotation

Docker handles log rotation automatically. To configure:

```bash
# Edit Docker daemon config
sudo nano /etc/docker/daemon.json
```

Add:
```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

Restart Docker:
```bash
sudo systemctl restart docker
```

### SSL Certificate Renewal

Traefik automatically renews Let's Encrypt certificates. To verify:

```bash
# Check certificate expiry
echo | openssl s_client -servername policybot.example.com -connect policybot.example.com:443 2>/dev/null | openssl x509 -noout -dates
```

---

## Scaling Recommendations

| Users | Database | Vector Store | RAM | Notes |
|-------|----------|--------------|-----|-------|
| 1-25 | PostgreSQL | Qdrant | 8GB | Local Ollama |
| 26-100 | PostgreSQL | Qdrant | 16GB | Local Ollama |
| 100-250 | PostgreSQL | Qdrant | 32GB | Local Ollama + more models |
| 250+ | External PostgreSQL | Qdrant Cluster | 64GB+ | Consider separate Ollama server |

> **Note:** For local-only deployment, RAM requirements are higher to accommodate Ollama models. Consider a separate Ollama server for larger deployments.

---

## Quick Reference

### Common Commands

```bash
# Start services (recommended: with Ollama)
docker compose --profile postgres --profile qdrant --profile ollama up -d

# Stop services
docker compose --profile postgres --profile qdrant --profile ollama down

# View logs
docker compose logs -f app

# Restart single service
docker compose restart app

# Rebuild after code changes
docker compose up -d --build app

# Shell into container
docker compose exec app sh

# Check service health
docker compose ps

# Pull a model (if using Ollama)
docker compose exec ollama pull llama3.2
```

### Important Paths

| Path | Description |
|------|-------------|
| `./data/app/` | Application data, uploads |
| `./data/transformers_cache/` | Local embedding/reranker models |
| `./data/qdrant/` | Qdrant vectors |
| `./data/postgres/` | PostgreSQL data |
| `./data/redis/` | Redis persistence |
| `./.env` | Environment variables |

### Support

- Check logs: `docker compose logs -f`
- GitHub Issues: [repository-url/issues]
- Documentation: See `./docs/` directory

---

## Changelog

- **2026-04**: Updated for local-only deployment with Ollama
- **2026-02**: Initial documentation
