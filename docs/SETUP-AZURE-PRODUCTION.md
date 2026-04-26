# Local AI Assistant - Azure/Production VM Setup Guide

## Overview

This guide covers deploying Local AI Assistant to a production environment, specifically Azure VMs or similar cloud infrastructure. For local development setup, see [SETUP-LOCAL-DESKTOP.md](SETUP-LOCAL-DESKTOP.md).

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           AZURE VM                                       │
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
│  └─────────────────────────────────────────────────────────────────┘    │
│         │              │              │                                 │
│         ▼              ▼              ▼                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                       │
│  │ PostgreSQL  │ │   Qdrant    │ │    Redis    │                       │
│  │  (laap db)  │ │  (vectors)  │ │   (cache)   │                       │
│  └─────────────┘ └─────────────┘ └─────────────┘                       │
│         │                                                           │
│         ▼                                                           │
│  ┌─────────────┐                                                    │
│  │   Ollama    │                                                    │
│  │ (Local LLM) │                                                    │
│  └─────────────┘                                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### Azure Resources

| Resource | Specification | Purpose |
|----------|---------------|---------|
| **VM Size** | Standard B2ms (2 vCPU, 8GB RAM) minimum | Application + services |
| **VM Size (Recommended)** | Standard D4s v3 (4 vCPU, 16GB RAM) | Better LLM performance |
| **OS** | Ubuntu 24.04 LTS | Supported OS |
| **Disk** | 50GB Premium SSD | Data + models |
| **Network** | Static Public IP, NSG with ports 80, 443 | Public access |
| **DNS** | Custom domain pointing to VM IP | TLS certificate |

### Local Requirements

| Software | Purpose |
|----------|---------|
| SSH client | Connect to VM |
| Git | Clone repository |
| Text editor | Edit configuration files |

---

## Step 1: Create Azure VM

### Using Azure Portal

1. Navigate to **Virtual Machines** → **Create**
2. Configure:
   - **Name:** `laap-prod`
   - **Region:** Choose closest to your users
   - **Size:** Standard B2ms (minimum) or D4s v3 (recommended)
   - **Image:** Ubuntu Server 24.04 LTS
   - **Authentication:** SSH public key (recommended) or password
   - **Disk:** Premium SSD, 50GB
3. Networking:
   - Enable **Public IP**
   - Configure **NSG** to allow ports 22, 80, 443
4. Create VM

### Using Azure CLI

```bash
# Create resource group
az group create --name laap-prod-rg --location eastus

# Create VM
az vm create \
  --resource-group laap-prod-rg \
  --name laap-prod \
  --image Ubuntu2404 \
  --size Standard_D4s_v3 \
  --admin-username azureuser \
  --ssh-key-value ~/.ssh/id_rsa.pub \
  --public-ip-sku Standard \
  --os-disk-size-gb 50

# Open ports
az vm open-port --resource-group laap-prod-rg --name laap-prod --port 80 --priority 100
az vm open-port --resource-group laap-prod-rg --name laap-prod --port 443 --priority 101
```

---

## Step 2: Configure DNS

### Option A: Azure DNS Zone

```bash
# Create DNS zone
az network dns zone create --resource-group laap-prod-rg --name yourdomain.com

# Create A record
az network dns record-set a add-record \
  --resource-group laap-prod-rg \
  --zone-name yourdomain.com \
  --record-set-name laap \
  --ipv4-address <VM_PUBLIC_IP>
```

### Option B: External DNS Provider

1. Get VM public IP: `az vm show --resource-group laap-prod-rg --name laap-prod --query publicIps -o tsv`
2. Add A record in your DNS provider:
   - **Name:** `laap` (or your preferred subdomain)
   - **Value:** `<VM_PUBLIC_IP>`
   - **TTL:** 300

**Result:** `laap.yourdomain.com` → VM IP

---

## Step 3: Connect to VM

```bash
# SSH to VM
ssh azureuser@<VM_PUBLIC_IP>

# Or using domain
ssh azureuser@laap.yourdomain.com
```

---

## Step 4: Server Setup

### Update System

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y curl git ca-certificates gnupg
```

### Install Docker

```bash
# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Add user to docker group
sudo usermod -aG docker $USER

# Apply group changes
newgrp docker

# Verify installation
docker --version
docker compose version
```

### Lock Docker Version

```bash
# Prevent automatic upgrades
sudo apt-mark hold docker-ce docker-ce-cli containerd.io
```

### Configure Swap (Recommended)

```bash
# Check if swap exists
swapon --show

# Create 8GB swap if not present
sudo fallocate -l 8G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Optimize swap usage
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

---

## Step 5: Deploy Application

### Clone Repository

```bash
# Create directory
sudo mkdir -p /opt/laap
sudo chown $USER:$USER /opt/laap

# Clone repository
cd /opt/laap
git clone https://github.com/your-org/local-ai-assistant.git .
```

### Create Environment File

```bash
# Copy production template
cp .env.azure.example .env

# Edit configuration
nano .env
```

**Required Configuration:**

```env
# =============================================================================
# Core Configuration
# =============================================================================

# Admin emails (comma-separated)
ADMIN_EMAILS=admin@yourdomain.com

# NextAuth secret (generate with: openssl rand -base64 32)
NEXTAUTH_SECRET=your-generated-32-char-secret-here

# Public URL
NEXTAUTH_URL=https://laap.yourdomain.com

# =============================================================================
# LLM Configuration (Ollama)
# =============================================================================

OLLAMA_MODE=docker
OLLAMA_API_BASE=http://ollama:11434
DEFAULT_OLLAMA_MODEL=qwen3:1.7b
OLLAMA_MODEL=qwen3:1.7b
OLLAMA_PULL_MODELS=qwen3:1.7b,qwen3.5:0.8b,qwen3-embedding:0.6b,bbjson/bge-reranker-base
OLLAMA_RERANKER_MODEL=bbjson/bge-reranker-base

# Local embeddings for RAG
EMBEDDING_MODEL=ollama-qwen3-embedding:0.6b
EMBEDDING_DIMENSIONS=1024

# =============================================================================
# Database Configuration
# =============================================================================

DATABASE_PROVIDER=postgres
POSTGRES_USER=laap
POSTGRES_PASSWORD=your-strong-password-here
POSTGRES_DB=laap
DATABASE_URL=postgresql://laap:your-strong-password-here@postgres:5432/laap

# =============================================================================
# Vector Store
# =============================================================================

QDRANT_HOST=qdrant
QDRANT_PORT=6333

# =============================================================================
# Redis
# =============================================================================

REDIS_URL=redis://redis:6379

# =============================================================================
# Domain & TLS
# =============================================================================

DOMAIN=laap.yourdomain.com
ACME_EMAIL=admin@yourdomain.com

# =============================================================================
# Storage
# =============================================================================

DATA_DIR=/app/data
MAX_UPLOAD_SIZE=500mb

# =============================================================================
# Authentication (choose one or more)
# =============================================================================

# Option 1: Email/Password
CREDENTIALS_ADMIN_PASSWORD=your-admin-password

# Option 2: Azure AD
AZURE_AD_CLIENT_ID=your-azure-client-id
AZURE_AD_CLIENT_SECRET=your-azure-client-secret
AZURE_AD_TENANT_ID=your-azure-tenant-id

# Option 3: Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Access control
ACCESS_MODE=allowlist
AUTH_DISABLED=false
```

### Generate Secrets

```bash
# Generate NEXTAUTH_SECRET
openssl rand -base64 32

# Generate DATA_SOURCE_ENCRYPTION_KEY
openssl rand -hex 32
```

---

## Step 6: Start Services

### Start All Services

```bash
cd /opt/laap

# Start with all profiles (PostgreSQL, Qdrant, Ollama)
docker compose --profile postgres --profile qdrant --profile ollama up -d --build
```

On first start, Ollama downloads the chat, embedding, and reranker models from
`OLLAMA_PULL_MODELS`. Keep the terminal open on `docker compose logs -f ollama`
until `qwen3:1.7b`, `qwen3-embedding:0.6b`, and `bbjson/bge-reranker-base`
show as complete.

### Verify Services

```bash
# Check all containers
docker compose ps

# Check logs
docker compose logs -f

# Verify specific services
docker exec local-ai-assistant-postgres pg_isready -U laap
docker exec local-ai-assistant-redis redis-cli ping
docker exec local-ai-assistant-ollama ollama list
docker exec local-ai-assistant-ollama curl -s http://localhost:11434/api/version
docker exec local-ai-assistant-qdrant wget -qO- http://localhost:6333/readyz
```

### Wait for TLS Certificate

```bash
# Check Traefik logs for certificate issuance
docker compose logs -f traefik

# Look for: "ACME: certificate obtained"
```

---

## Step 7: Verify Deployment

### Check Application

```bash
# Check app health
curl -I https://laap.yourdomain.com/api/health

# Should return 200 OK
```

### Access Admin Panel

1. Open browser: `https://laap.yourdomain.com/admin`
2. Log in with admin email and configured auth method
3. Verify dashboard loads correctly

---

## Post-Deployment Configuration

### 1. Create Categories

1. Go to **Admin** → **Categories**
2. Create categories for your organization (e.g., HR, Finance, IT, Legal)
3. Assign colors and descriptions

### 2. Upload Documents

1. Go to **Admin** → **Documents**
2. Upload PDFs, DOCX files
3. Assign to categories
4. Wait for indexing to complete

### 3. Configure Prompts

1. Go to **Admin** → **Prompts**
2. Set global system prompt
3. Add category-specific prompts if needed

### 4. Add Users

1. Go to **Admin** → **Users**
2. Add users with appropriate roles:
   - **Admin:** Full access
   - **SuperUser:** Category management
   - **User:** Chat access only
3. Subscribe users to categories

---

## Operations

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f app
docker compose logs -f postgres
docker compose logs -f ollama
docker compose logs -f traefik
```

### Restart Services

```bash
# Restart all
docker compose restart

# Restart specific service
docker compose restart app
```

### Update Application

```bash
cd /opt/laap

# Pull latest code
git pull origin main

# Rebuild and restart
docker compose --profile postgres --profile qdrant --profile ollama up -d --build

# Verify
docker compose ps
docker compose logs -f app
```

### Backup

```bash
# Create backup directory
sudo mkdir -p /backups/laap
sudo chown $USER:$USER /backups/laap

# Backup script
cat > /opt/laap/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups/laap"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup PostgreSQL
docker exec local-ai-assistant-postgres pg_dump -U laap laap > $BACKUP_DIR/postgres-$DATE.sql

# Backup app data
tar czvf $BACKUP_DIR/app-data-$DATE.tar.gz -C /opt/laap/data .

# Keep last 7 days
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
EOF

chmod +x /opt/laap/backup.sh

# Run backup
/opt/laap/backup.sh
```

### Schedule Automatic Backups

```bash
# Add to crontab
crontab -e

# Add this line for daily backup at 2 AM
0 2 * * * /opt/laap/backup.sh >> /var/log/laap-backup.log 2>&1
```

---

## Monitoring

### Resource Usage

```bash
# Container stats
docker stats

# Disk usage
df -h

# Database size
docker exec local-ai-assistant-postgres psql -U laap -c "SELECT pg_size_pretty(pg_database_size('laap'));"

# Vector store size
du -sh /opt/laap/data/qdrant/
```

### Health Check Script

```bash
cat > /opt/laap/healthcheck.sh << 'EOF'
#!/bin/bash
echo "=== Health Check: $(date) ==="

# App
if curl -sf https://laap.yourdomain.com/api/health > /dev/null 2>&1; then
  echo "✓ App: healthy"
else
  echo "✗ App: unhealthy"
fi

# PostgreSQL
if docker exec local-ai-assistant-postgres pg_isready -U laap > /dev/null 2>&1; then
  echo "✓ PostgreSQL: healthy"
else
  echo "✗ PostgreSQL: unhealthy"
fi

# Redis
if docker exec local-ai-assistant-redis redis-cli ping | grep -q PONG; then
  echo "✓ Redis: healthy"
else
  echo "✗ Redis: unhealthy"
fi

# Ollama
if docker exec local-ai-assistant-ollama curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; then
  echo "✓ Ollama: healthy"
else
  echo "✗ Ollama: unhealthy"
fi

# Qdrant
if docker exec local-ai-assistant-qdrant wget -qO- http://localhost:6333/readyz > /dev/null 2>&1; then
  echo "✓ Qdrant: healthy"
else
  echo "✗ Qdrant: unhealthy"
fi
EOF

chmod +x /opt/laap/healthcheck.sh
```

---

## Troubleshooting

### TLS Certificate Issues

```bash
# Check Traefik logs
docker compose logs traefik

# Verify DNS
dig laap.yourdomain.com

# Check Let's Encrypt rate limits
# https://letsencrypt.org/docs/rate-limits/
```

### Database Connection Issues

```bash
# Check PostgreSQL
docker compose ps postgres
docker compose logs postgres

# Test connection
docker exec local-ai-assistant-postgres pg_isready -U laap

# Check schema
docker exec local-ai-assistant-postgres psql -U laap -d laap -c "\dt"
```

### Ollama Issues

```bash
# Check Ollama container
docker compose ps ollama
docker compose logs ollama

# Check available models
docker exec local-ai-assistant-ollama ollama list

# Pull model if missing
docker exec local-ai-assistant-ollama ollama pull qwen3:1.7b
docker exec local-ai-assistant-ollama ollama pull qwen3-embedding:0.6b
docker exec local-ai-assistant-ollama ollama pull bbjson/bge-reranker-base
```

### Memory Issues

```bash
# Check memory
free -h

# Check container memory usage
docker stats --no-stream

# Increase swap if needed
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

---

## Security Checklist

### Before Deployment
- [ ] Generate strong `NEXTAUTH_SECRET` (32+ characters)
- [ ] Set strong `POSTGRES_PASSWORD`
- [ ] Configure authentication provider (Azure AD, Google, or credentials)
- [ ] Set `AUTH_DISABLED=false`
- [ ] Configure firewall (ports 22, 80, 443 only)
- [ ] Verify `.env` is not in git

### After Deployment
- [ ] Verify TLS certificate is valid
- [ ] Test login flow
- [ ] Create admin user
- [ ] Review Traefik logs for suspicious activity
- [ ] Set up automated backups

### Ongoing
- [ ] Monitor disk usage weekly
- [ ] Review logs weekly
- [ ] Update images monthly
- [ ] Rotate secrets quarterly
- [ ] Test backup restoration quarterly

---

## Cost Estimation

### Azure VM Pricing (Estimates)

| VM Size | vCPU | RAM | Monthly Cost |
|---------|------|-----|--------------|
| Standard B2ms | 2 | 8GB | ~$60/month |
| Standard D4s v3 | 4 | 16GB | ~$140/month |
| Standard D8s v3 | 8 | 32GB | ~$280/month |

### Additional Costs

| Resource | Monthly Cost |
|----------|--------------|
| Premium SSD (50GB) | ~$10/month |
| Static Public IP | ~$4/month |
| DNS Zone | ~$0.50/month |
| **Total (B2ms)** | **~$75/month** |

**Note:** No LLM API costs - Ollama runs locally.

---

## Related Documentation

- [SETUP-LOCAL-DESKTOP.md](SETUP-LOCAL-DESKTOP.md) - Local development setup
- [INFRASTRUCTURE.md](tech/INFRASTRUCTURE.md) - Architecture details
- [DATABASE.md](tech/DATABASE.md) - Database schema reference
- [ADMIN_GUIDE.md](user_manuals/ADMIN_GUIDE.md) - Admin dashboard guide
- [air-gapped-deployment.md](features/air-gapped-deployment.md) - Air-gapped deployment
