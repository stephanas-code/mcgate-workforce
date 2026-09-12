#!/usr/bin/env bash
set -eo pipefail

# Health check script for Docker and Kubernetes probes
PORT="${PORT:-8000}"
URL="http://127.0.0.1:${PORT}/health/"

RESPONSE=$(curl -sf --max-time 5 "$URL" 2>/dev/null) || {
  echo "CRITICAL: Health check request to $URL failed."
  exit 1
}

echo "OK: $RESPONSE"
exit 0
