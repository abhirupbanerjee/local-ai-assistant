# Ollama Local Testing Guide (Docker Mode)

This guide covers testing the Ollama deployment in Docker mode only.

## Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ for local dev (optional, for frontend testing)
- At least 8GB RAM available for Ollama models

## Quick Start

### 1. Start Services

```bash
# Start all services (Next.js, Ollama, Qdrant, Redis)
docker-compose -f docker-compose.local.yml up -d

# Or start only Ollama for testing
docker-compose -f docker-compose.local.yml up -d ollama
```

### 2. Verify Ollama is Running

```bash
# Check container is running
docker ps | grep local-ai-assistant-ollama

# Test Ollama API directly
curl http://localhost:11434/api/tags
```

Expected response:
```json
{
  "models": [
    {
      "name": "gemma3:latest",
      "model": "gemma3:latest",
      "size": ...,
      "digest": "..."
    }
  ]
}
```

### 3. Start Next.js Development Server

```bash
# In a new terminal
npm run dev
```

The app will be available at `http://localhost:3000`

## Testing the Admin UI

### 1. Navigate to Ollama Tab

1. Go to `http://localhost:3000/admin`
2. Click "Ollama" in the sidebar
3. You should see:
   - Connection status (should show "Connected to Ollama (docker mode)")
   - List of installed models
   - "Pull New Model" form

### 2. Test Pull Model

1. In the "Pull New Model" input, enter `llama3.2`
2. Click "Pull Model" button
3. Wait for download to complete (can take several minutes)
4. Model should appear in "Installed Models" list

### 3. Verify Connection Status

The connection status card shows:
- ✅ Green checkmark if connected
- ❌ Red X if not connected
- Shows "docker mode" when using containerized Ollama

## Testing the Chat

### 1. Select Ollama Model

1. Go to `http://localhost:3000/chat`
2. In the model dropdown, select an Ollama model (e.g., "gemma3:latest")
3. Start a conversation

### 2. Verify Chat Works

Send a message and verify:
- Response is generated
- No errors in console
- Streaming works correctly

## API Endpoint Testing

### List Models

```bash
curl http://localhost:3000/api/ollama/models
```

### Pull Model

```bash
curl -X POST http://localhost:3000/api/ollama/pull \
  -H "Content-Type: application/json" \
  -d '{"model": "llama3.2"}'
```

## Troubleshooting

### Ollama Container Won't Start

```bash
# Check logs
docker logs local-ai-assistant-ollama

# Common issues:
# - Port 11434 already in use
# - Not enough memory
```

### Connection Refused in Admin UI

1. Verify container is running:
   ```bash
   docker ps | grep ollama
   ```

2. Check OLLAMA_MODE in .env.local:
   ```
   OLLAMA_MODE=docker
   ```

3. Verify network connectivity between containers:
   ```bash
   docker exec local-ai-assistant-web curl http://ollama:11434/api/tags
   ```

### Model Pull Fails

1. Check Ollama logs:
   ```bash
   docker logs local-ai-assistant-ollama
   ```

2. Ensure enough disk space
3. Try a smaller model first (e.g., `phi4` instead of `llama3.2`)

### Chat Not Working with Ollama Model

1. Verify model is installed:
   ```bash
   curl http://localhost:11434/api/tags
   ```

2. Check browser console for errors
3. Verify the model name matches exactly (case-sensitive)

## Stopping Services

```bash
# Stop all services
docker-compose -f docker-compose.local.yml down

# Stop and remove volumes (clean start)
docker-compose -f docker-compose.local.yml down -v
```

## Useful Commands

```bash
# View Ollama container logs
docker logs -f local-ai-assistant-ollama

# Exec into Ollama container
docker exec -it local-ai-assistant-ollama /bin/bash

# Check Ollama API health
curl http://localhost:11434/

# List all containers
docker ps --format "table {{.Names}}\t{{.Status}}"