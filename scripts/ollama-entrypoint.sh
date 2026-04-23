#!/bin/bash
# Start Ollama server in the background, pull models, then keep serving.
ollama serve &
OLLAMA_PID=$!

# Wait for server to be ready
echo "[entrypoint] Waiting for Ollama server..."
until curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; do
  sleep 1
done
echo "[entrypoint] Ollama server is ready."

# Pull default model if not already present
MODEL="${OLLAMA_MODEL:-gemma3:latest}"
echo "[entrypoint] Checking for model: ${MODEL}"
# Use fixed-string grep (-F) to avoid regex issues with dots in model names
if ollama list 2>/dev/null | grep -qF "${MODEL}"; then
  echo "[entrypoint] Model ${MODEL} already present."
else
  echo "[entrypoint] Pulling model: ${MODEL}..."
  ollama pull "${MODEL}"
  echo "[entrypoint] Model ${MODEL} pull complete."
fi

# Pull additional models from OLLAMA_PULL_MODELS (comma-separated)
ADDITIONAL_MODELS="${OLLAMA_PULL_MODELS:-gemma4:2b,qwen2.5:2b}"
if [ -n "$ADDITIONAL_MODELS" ]; then
  echo "[entrypoint] Checking for additional models: ${ADDITIONAL_MODELS}"
  IFS=',' read -ra MODELS <<< "$ADDITIONAL_MODELS"
  for ADD_MODEL in "${MODELS[@]}"; do
    # Trim whitespace
    ADD_MODEL=$(echo "$ADD_MODEL" | xargs)
    if ollama list 2>/dev/null | grep -qF "${ADD_MODEL}"; then
      echo "[entrypoint] Model ${ADD_MODEL} already present."
    else
      echo "[entrypoint] Pulling additional model: ${ADD_MODEL}..."
      ollama pull "${ADD_MODEL}"
      echo "[entrypoint] Model ${ADD_MODEL} pull complete."
    fi
  done
fi

# Pre-warm default model into memory so first request doesn't cold-start
echo "[entrypoint] Warming up model: ${MODEL}"
curl -sf http://localhost:11434/api/generate -d "{\"model\":\"${MODEL}\",\"prompt\":\"hi\",\"stream\":false}" > /dev/null 2>&1
echo "[entrypoint] Model ${MODEL} warm-up complete."

# Wait for the server process
wait $OLLAMA_PID
