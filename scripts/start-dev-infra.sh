#!/usr/bin/env bash
set -euo pipefail

# Change to repo root (this script lives in ./scripts)
ROOT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Load environment vars from .env.local from repo root
ENV_FILE="$ROOT_DIR/.env.local"
if [ -f "$ENV_FILE" ]; then
  echo "💉 Loading $ENV_FILE"
  set -a
  . "$ENV_FILE"
  set +a
fi

# Allow overriding the compose command (e.g., DOCKER_COMPOSE="docker-compose")
DOCKER_COMPOSE="${DOCKER_COMPOSE:-docker compose}"

# Check if Docker is installed and on PATH
if ! command -v docker >/dev/null 2>&1; then
  echo "❌ Docker is not installed or not on PATH."
  exit 1
fi

# Check if Docker Compose v2 is installed and on PATH
if ! $DOCKER_COMPOSE version >/dev/null 2>&1; then
  echo "❌ Docker Compose v2 is required (use 'docker compose', not 'docker-compose')."
  exit 1
fi

echo "🚀 Starting local infra with Docker Compose…"

# Pull missing images (no-op if already pulled), then start detached
$DOCKER_COMPOSE pull --ignore-pull-failures || true
$DOCKER_COMPOSE up -d

# --- Wait helpers ------------------------------------------------------------
wait_for_port() {
  local host="$1" port="$2" name="$3" timeout="${4:-60}"
  local start ts_now

  echo -n "⏳ Waiting for ${name} on ${host}:${port} (timeout ${timeout}s)… "
  start=$(date +%s)
  while true; do
    # bash's /dev/tcp works on most systems without netcat
    if (exec 3<>"/dev/tcp/${host}/${port}") 2>/dev/null; then
      exec 3>&- 3<&-
      echo "✅"
      return 0
    fi
    ts_now=$(date +%s)
    if (( ts_now - start >= timeout )); then
      echo "❌ timed out"
      return 1
    fi
    sleep 1
  done
}

# --- Wait for exposed services ----------------------------------------------
# Postgres TCP
wait_for_port "127.0.0.1" 5432 "Postgres"
# Neon wsproxy (WebSocket over HTTP)
wait_for_port "127.0.0.1" 5433 "Neon wsproxy"
# Redis TCP
wait_for_port "127.0.0.1" 6379 "Redis"
# Serverless Redis HTTP (SRH)
wait_for_port "127.0.0.1" 8079 "SRH (Upstash-compatible HTTP)"
# Inngest Dev Server
wait_for_port "127.0.0.1" 8288 "Inngest Dev Server"

# --- Done! (hopefully) ------------------------------------------------------
echo
echo "🎉 Local infra is ready!"
echo "  * Postgres:  postgres://postgres:postgres@localhost:5432/main"
echo "  * wsproxy:   ws://localhost:5433/v1  (driver uses this automatically)"
echo "  * Redis:     redis://localhost:6379"
echo "  * SRH:       http://localhost:8079"
echo "  * Inngest:   http://localhost:8288"
echo

# graceful shutdown on Ctrl+C / SIGTERM
cleanup() {
  echo
  echo "🛑 Ctrl+C detected — shutting down Docker stack…"
  # stop the log tail first (if running)
  if [[ -n "${LOG_PID:-}" ]]; then
    kill "$LOG_PID" 2>/dev/null || true
  fi
  # bring the stack down
  if $DOCKER_COMPOSE down; then
    exit 130  # standard code for user-initiated Ctrl+C
  else
    exit $?   # propagate failure from `down`
  fi
}
trap cleanup INT TERM

echo "📜 Following logs (Ctrl+C to stop AND shut down services)…"
$DOCKER_COMPOSE logs -f --tail=100 &
LOG_PID=$!

# wait on the log tail; if it exits (or you press Ctrl+C), the trap runs
wait "$LOG_PID"
