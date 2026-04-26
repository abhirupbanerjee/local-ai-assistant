#!/bin/bash
# =============================================================================
# Local AI Assistant - Azure VM Setup Script
# =============================================================================
#
# This script sets up and deploys Local AI Assistant on an Azure VM.
#
# Usage:
#   ./setup.sh                    # Full setup with Docker and model download
#   ./setup.sh down               # Stop all containers
#   ./setup.sh restart            # Restart all containers
#   ./setup.sh start              # Fresh start (down + up -d, no rebuild)
#   ./setup.sh build              # Rebuild containers with --no-cache
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
PROFILES="--profile postgres --profile qdrant --profile ollama"

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

# =============================================================================
# Docker Management Functions
# =============================================================================

do_down() {
    echo ""
    echo "=============================================="
    echo "  Stopping All Containers"
    echo "=============================================="
    echo ""
    
    log_info "Stopping containers..."
    docker compose $PROFILES down
    log_success "All containers stopped"
}

do_restart() {
    echo ""
    echo "=============================================="
    echo "  Restarting All Containers"
    echo "=============================================="
    echo ""
    
    log_info "Restarting containers..."
    docker compose restart
    log_success "All containers restarted"
    
    echo ""
    log_info "Container status:"
    docker compose ps
}

do_start() {
    echo ""
    echo "=============================================="
    echo "  Starting Containers (Fresh Start)"
    echo "=============================================="
    echo ""
    
    log_info "Stopping existing containers..."
    docker compose $PROFILES down 2>/dev/null || true
    
    log_info "Starting containers..."
    docker compose $PROFILES up -d
    
    log_success "Containers started"
    
    echo ""
    log_info "Waiting for services to be healthy..."
    wait_for_services
    
    echo ""
    log_info "Container status:"
    docker compose ps
}

do_build() {
    echo ""
    echo "=============================================="
    echo "  Rebuilding Containers (No Cache)"
    echo "=============================================="
    echo ""
    
    log_info "Stopping existing containers..."
    docker compose $PROFILES down 2>/dev/null || true
    
    log_info "Building containers with --no-cache..."
    docker compose $PROFILES build --no-cache
    
    log_info "Starting containers..."
    docker compose $PROFILES up -d
    
    log_success "Containers rebuilt and started"
    
    echo ""
    log_info "Waiting for services to be healthy..."
    wait_for_services
    
    echo ""
    log_info "Container status:"
    docker compose ps
}

wait_for_services() {
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
}

show_help() {
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  (default)       Full setup with Docker build and model download"
    echo "  down            Stop all containers"
    echo "  restart         Restart all containers"
    echo "  start           Fresh start (down + up -d, no rebuild)"
    echo "  build           Rebuild containers with --no-cache"
    echo ""
    echo "Options:"
    echo "  --skip-docker   Skip Docker build and start (for setup mode only)"
    echo "  --skip-models   Skip HuggingFace model download (for setup mode only)"
    echo "  --help, -h      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0              # Full setup on fresh VM"
    echo "  $0 down         # Stop all services"
    echo "  $0 restart      # Quick restart without rebuild"
    echo "  $0 start        # Fresh start without rebuild"
    echo "  $0 build        # Full rebuild (after code changes)"
}

# =============================================================================
# Parse Arguments
# =============================================================================

COMMAND=""
SKIP_DOCKER=false
SKIP_MODELS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        down|restart|start|build)
            COMMAND="$1"
            shift
            ;;
        --skip-docker)
            SKIP_DOCKER=true
            shift
            ;;
        --skip-models)
            SKIP_MODELS=true
            shift
            ;;
        --help|-h)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            echo "Run '$0 --help' for usage information"
            exit 1
            ;;
    esac
done

# =============================================================================
# Execute Commands
# =============================================================================

# Handle simple commands first
case $COMMAND in
    down)
        do_down
        exit 0
        ;;
    restart)
        do_restart
        exit 0
        ;;
    start)
        do_start
        exit 0
        ;;
    build)
        do_build
        exit 0
        ;;
esac

# =============================================================================
# Full Setup Mode
# =============================================================================

echo ""
echo "=============================================="
echo "  Local AI Assistant - Azure VM Setup"
echo "=============================================="
echo ""

# =============================================================================
# Step 1: Check Prerequisites
# =============================================================================

log_info "Step 1: Checking prerequisites..."

check_command docker
check_command curl
check_command jq

# Check Docker is running
if ! docker info &> /dev/null; then
    log_error "Docker is not running. Please start Docker first."
    exit 1
fi

log_success "All prerequisites satisfied"

# Check available disk space (minimum 10GB recommended)
log_info "Checking disk space..."
AVAILABLE_SPACE=$(df -BG . | tail -1 | awk '{print $4}' | tr -d 'G')
if [ "$AVAILABLE_SPACE" -lt 10 ]; then
    log_warning "Low disk space: ${AVAILABLE_SPACE}GB available"
    log_warning "Recommended minimum: 10GB for Docker images + models"
    log_warning "Consider running: docker system prune -a --volumes -f"
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_error "Setup aborted. Free up disk space and try again."
        exit 1
    fi
else
    log_success "Disk space OK: ${AVAILABLE_SPACE}GB available"
fi

# =============================================================================
# Step 2: Create Data Directories
# =============================================================================

log_info "Step 2: Creating data directories..."

mkdir -p ./data/app
mkdir -p ./data/transformers_cache
mkdir -p ./data/qdrant
mkdir -p ./data/redis

# Set permissions for transformers cache (needs to be writable by container user)
# Handle case where directory was created by Docker (root owned)
if ! chmod 777 ./data/transformers_cache 2>/dev/null; then
    log_info "Fixing permissions (requires sudo for Docker-created directories)..."
    sudo chown -R $USER:$USER ./data
    chmod 777 ./data/transformers_cache
fi

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
    docker compose $PROFILES down 2>/dev/null || true
    
    # Build and start
    log_info "Building containers (this may take a few minutes)..."
    docker compose $PROFILES build
    
    log_info "Starting containers..."
    docker compose $PROFILES up -d
    
    log_success "Containers started"
    
    # =============================================================================
    # Step 7: Wait for Services
    # =============================================================================
    
    log_info "Step 7: Waiting for services to be healthy..."
    wait_for_services
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
    log_info "Downloading embedding model (bge-base-en-v1.5, ~438MB)..."
    log_info "Downloading reranker model (bge-reranker-base, ~1.3GB)..."
    
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
print('Downloading bge-base-en-v1.5 embedding model...')
model = SentenceTransformer('BAAI/bge-base-en-v1.5')
print('bge-base-en-v1.5 downloaded successfully')
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
echo "     # Then restart: ./setup.sh restart"
echo ""

log_info "Useful Commands:"
echo ""
echo "  ./setup.sh down      # Stop all containers"
echo "  ./setup.sh restart   # Restart all containers"
echo "  ./setup.sh start     # Fresh start (no rebuild)"
echo "  ./setup.sh build     # Rebuild with --no-cache"
echo "  docker compose logs -f app   # View app logs"
echo "  docker compose ps            # Check status"
echo ""

log_success "Setup completed successfully!"