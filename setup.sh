#!/bin/bash
# =============================================================================
# Local AI Assistant - Azure VM Setup Script
# =============================================================================
#
# This script sets up and deploys Local AI Assistant on an Azure VM.
#
# Usage:
#   ./setup.sh                    # Full setup with Docker and model download
#   ./setup.sh --skip-docker      # Skip Docker build/start
#   ./setup.sh --skip-models      # Skip HuggingFace model download
#   ./setup.sh --help             # Show help message
#
# Prerequisites:
#   - Docker and Docker Compose installed
#   - curl, jq installed
#   - DNS configured for laap.abhirup.app
#
# =============================================================================

set -e

# =============================================================================
# Configuration
# =============================================================================

DOMAIN="laap.abhirup.app"
ENV_TEMPLATE=".env.azure"
ENV_FILE=".env"
TRANSFORMERS_CACHE="./data/transformers_cache"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# =============================================================================
# Helper Functions
# =============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_command() {
    if ! command -v "$1" &> /dev/null; then
        log_error "$1 is not installed. Please install it first."
        exit 1
    fi
}

generate_secret() {
    openssl rand -base64 32 | tr -d '\n'
}

generate_hex_key() {
    openssl rand -hex 32 | tr -d '\n'
}

wait_for_service() {
    local service=$1
    local max_attempts=${2:-60}
    local attempt=0
    
    log_info "Waiting for $service to be healthy..."
    while [ $attempt -lt $max_attempts ]; do
        if docker compose ps "$service" 2>/dev/null | grep -q "healthy"; then
            log_success "$service is healthy"
            return 0
        fi
        attempt=$((attempt + 1))
        echo -n "."
        sleep 2
    done
    echo ""
    log_error "$service did not become healthy within timeout"
    return 1
}

# =============================================================================
# Parse Arguments
# =============================================================================

SKIP_DOCKER=false
SKIP_MODELS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-docker)
            SKIP_DOCKER=true
            shift
            ;;
        --skip-models)
            SKIP_MODELS=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --skip-docker    Skip Docker build and start"
            echo "  --skip-models    Skip HuggingFace model download"
            echo "  --help, -h       Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# =============================================================================
# Step 1: Check Prerequisites
# =============================================================================

echo ""
echo "=============================================="
echo "  Local AI Assistant - Azure VM Setup"
echo "=============================================="
echo ""

log_info "Step 1: Checking prerequisites..."

check_command docker
check_command docker
check_command curl
check_command jq

# Check Docker is running
if ! docker info &> /dev/null; then
    log_error "Docker is not running. Please start Docker first."
    exit 1
fi

log_success "All prerequisites satisfied"

# =============================================================================
# Step 2: Create Data Directories
# =============================================================================

log_info "Step 2: Creating data directories..."

mkdir -p ./data/app
mkdir -p ./data/transformers_cache
mkdir -p ./data/qdrant
mkdir -p ./data/redis

# Set permissions for transformers cache (needs to be writable by container user)
chmod 777 ./data/transformers_cache

log_success "Data directories created"

# =============================================================================
# Step 3: Create Environment File
# =============================================================================

log_info "Step 3: Setting up environment file..."

if [ -f "$ENV_FILE" ]; then
    log_warning ".env file already exists. Skipping creation."
else
    if [ -f "$ENV_TEMPLATE" ]; then
        cp "$ENV_TEMPLATE" "$ENV_FILE"
        log_success "Created .env from $ENV_TEMPLATE"
    else
        log_error "Template file $ENV_TEMPLATE not found"
        exit 1
    fi
fi

# =============================================================================
# Step 4: Generate Secrets
# =============================================================================

log_info "Step 4: Generating secrets..."

# Function to update .env with generated value
update_env() {
    local key=$1
    local value=$2
    
    # Check if key exists and is empty, or doesn't exist
    if grep -q "^${key}=$" "$ENV_FILE" 2>/dev/null || ! grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
        if grep -q "^${key}=$" "$ENV_FILE" 2>/dev/null; then
            # Key exists but empty - update it
            if [[ "$OSTYPE" == "darwin"* ]]; then
                sed -i '' "s|^${key}=$|${key}=${value}|" "$ENV_FILE"
            else
                sed -i "s|^${key}=$|${key}=${value}|" "$ENV_FILE"
            fi
        else
            # Key doesn't exist - append it
            echo "${key}=${value}" >> "$ENV_FILE"
        fi
        log_success "Generated $key"
    else
        log_info "$key already set, keeping existing value"
    fi
}

# Generate NEXTAUTH_SECRET if not set
NEXTAUTH_SECRET=$(generate_secret)
update_env "NEXTAUTH_SECRET" "$NEXTAUTH_SECRET"

# Generate POSTGRES_PASSWORD if not set
POSTGRES_PASSWORD=$(generate_secret)
update_env "POSTGRES_PASSWORD" "$POSTGRES_PASSWORD"

# Generate DATA_SOURCE_ENCRYPTION_KEY if not set
DATA_SOURCE_ENCRYPTION_KEY=$(generate_hex_key)
update_env "DATA_SOURCE_ENCRYPTION_KEY" "$DATA_SOURCE_ENCRYPTION_KEY"

log_success "All secrets generated"

# =============================================================================
# Step 5: Verify DNS
# =============================================================================

log_info "Step 5: Verifying DNS for $DOMAIN..."

DNS_IP=$(dig +short "$DOMAIN" 2>/dev/null | tail -1)

if [ -z "$DNS_IP" ]; then
    log_warning "DNS not configured for $DOMAIN"
    log_warning "Please ensure $DOMAIN points to this server's IP"
    log_warning "TLS certificate will not be issued until DNS is configured"
else
    log_success "DNS resolved: $DOMAIN -> $DNS_IP"
fi

# =============================================================================
# Step 6: Build and Start Docker Containers
# =============================================================================

if [ "$SKIP_DOCKER" = true ]; then
    log_info "Step 6: Skipping Docker build (--skip-docker)"
else
    log_info "Step 6: Building and starting Docker containers..."
    
    # Stop any existing containers
    log_info "Stopping existing containers..."
    docker compose --profile postgres --profile qdrant --profile ollama down 2>/dev/null || true
    
    # Build and start
    log_info "Building containers (this may take a few minutes)..."
    docker compose --profile postgres --profile qdrant --profile ollama build
    
    log_info "Starting containers..."
    docker compose --profile postgres --profile qdrant --profile ollama up -d
    
    log_success "Containers started"
    
    # =============================================================================
    # Step 7: Wait for Services
    # =============================================================================
    
    log_info "Step 7: Waiting for services to be healthy..."
    
    # Wait for Redis (fast startup)
    sleep 5
    if docker compose ps redis 2>/dev/null | grep -q "healthy"; then
        log_success "Redis is healthy"
    else
        log_info "Waiting for Redis..."
        sleep 10
    fi
    
    # Wait for PostgreSQL
    log_info "Waiting for PostgreSQL (may take 30-60 seconds)..."
    for i in {1..30}; do
        if docker compose ps postgres 2>/dev/null | grep -q "healthy"; then
            log_success "PostgreSQL is healthy"
            break
        fi
        echo -n "."
        sleep 2
    done
    echo ""
    
    # Wait for Qdrant
    log_info "Waiting for Qdrant..."
    for i in {1..30}; do
        if docker compose ps qdrant 2>/dev/null | grep -q "healthy"; then
            log_success "Qdrant is healthy"
            break
        fi
        echo -n "."
        sleep 2
    done
    echo ""
    
    # Wait for Ollama (longer startup due to model loading)
    log_info "Waiting for Ollama (may take 2-5 minutes for model download)..."
    for i in {1..90}; do
        if docker compose ps ollama 2>/dev/null | grep -q "healthy"; then
            log_success "Ollama is healthy"
            break
        fi
        echo -n "."
        sleep 2
    done
    echo ""
    
    # Wait for App
    log_info "Waiting for App..."
    for i in {1..60}; do
        if docker compose ps app 2>/dev/null | grep -q "healthy"; then
            log_success "App is healthy"
            break
        fi
        echo -n "."
        sleep 2
    done
    echo ""
fi

# =============================================================================
# Step 8: Pre-download HuggingFace Models
# =============================================================================

if [ "$SKIP_MODELS" = true ]; then
    log_info "Step 8: Skipping HuggingFace model download (--skip-models)"
else
    log_info "Step 8: Pre-downloading HuggingFace models..."
    
    # Read HF_TOKEN from .env if set
    HF_TOKEN=""
    if [ -f "$ENV_FILE" ]; then
        HF_TOKEN=$(grep "^HF_TOKEN=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2)
    fi
    
    # Create a temporary container to download models
    log_info "Downloading embedding model (bge-m3, ~2.2GB)..."
    log_info "Downloading reranker model (bge-reranker-v2-m3, ~670MB)..."
    
    # Use Python container to download models via transformers
    docker run --rm \
        -v "$(pwd)/data/transformers_cache:/tmp/transformers_cache" \
        -e TRANSFORMERS_CACHE=/tmp/transformers_cache \
        -e HF_TOKEN="${HF_TOKEN}" \
        --entrypoint /bin/bash \
        python:3.11-slim \
        -c "pip install -q transformers sentence-transformers && \
            python3 -c \"
from sentence_transformers import SentenceTransformer
print('Downloading bge-m3 embedding model...')
model = SentenceTransformer('BAAI/bge-m3')
print('bge-m3 downloaded successfully')
\" 2>/dev/null || echo 'Embedding model download skipped (will download on first use)'"
    
    log_success "HuggingFace models cached"
fi

# =============================================================================
# Step 9: Display Status
# =============================================================================

echo ""
echo "=============================================="
echo "  Setup Complete!"
echo "=============================================="
echo ""

log_info "Service Status:"
docker compose ps 2>/dev/null || true

echo ""
log_info "Next Steps:"
echo ""
echo "  1. Verify DNS is configured:"
echo "     dig $DOMAIN +short"
echo "     (Should return this server's IP)"
echo ""
echo "  2. Wait for TLS certificate (2-5 minutes after DNS is ready):"
echo "     docker compose logs -f traefik | grep certificate"
echo ""
echo "  3. Access the application:"
echo "     https://$DOMAIN"
echo ""
echo "  4. Log in with:"
echo "     Email: mailabhirupbanerjee@gmail.com"
echo "     Password: CHANGE_ME_ON_FIRST_LOGIN"
echo ""
echo "  5. Change the admin password immediately after first login!"
echo ""
echo "  6. Add your HF_TOKEN to .env if using gated models:"
echo "     nano .env"
echo "     # Then restart: docker compose restart app"
echo ""

log_info "Useful Commands:"
echo ""
echo "  View logs:        docker compose logs -f"
echo "  View app logs:    docker compose logs -f app"
echo "  Restart all:      docker compose restart"
echo "  Stop all:         docker compose --profile postgres --profile qdrant --profile ollama down"
echo "  Check status:     docker compose ps"
echo ""

log_success "Setup completed successfully!"