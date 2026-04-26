#!/bin/sh
# Docker entrypoint script
# Ensures proper permissions on mounted volumes before starting the app

set -e

# Fix permissions on transformers cache directory (may be mounted from host)
# The directory might be owned by root if created by Docker before the first run
if [ -d "/tmp/transformers_cache" ]; then
  # Try to fix ownership - this requires running as root initially
  # If we're already running as non-root, this will fail silently
  if [ "$(id -u)" = "0" ]; then
    chown -R nextjs:nodejs /tmp/transformers_cache 2>/dev/null || true
    chmod -R 755 /tmp/transformers_cache 2>/dev/null || true
  fi
fi

# Fix permissions on data directory if needed
if [ -d "/app/data" ]; then
  if [ "$(id -u)" = "0" ]; then
    chown -R nextjs:nodejs /app/data 2>/dev/null || true
  fi
fi

# Drop privileges and run the app as nextjs user
# Using gosu for proper signal handling in containers
exec gosu nextjs "$@"
