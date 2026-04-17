#!/usr/bin/env bash
# Local "distributed" stack: researcher (8001), judge (8002), content_builder (8003),
# orchestrator (8004). Optional ADK Web UI for orchestrator on 8000.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

UV="${UV:-uv}"
"$UV" run python scripts/bootstrap_local_a2a_layout.py

LAYOUT="$ROOT/.local-a2a-servers"

export RESEARCHER_AGENT_CARD_URL="${RESEARCHER_AGENT_CARD_URL:-http://127.0.0.1:8001/a2a/researcher/.well-known/agent-card.json}"
export JUDGE_AGENT_CARD_URL="${JUDGE_AGENT_CARD_URL:-http://127.0.0.1:8002/a2a/judge/.well-known/agent-card.json}"
export CONTENT_BUILDER_AGENT_CARD_URL="${CONTENT_BUILDER_AGENT_CARD_URL:-http://127.0.0.1:8003/a2a/content_builder/.well-known/agent-card.json}"

pids=()
cleanup() {
  for pid in "${pids[@]:-}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
}
trap cleanup EXIT INT TERM

start_server() {
  local port="$1"
  local dir="$2"
  "$UV" run adk api_server --no-reload --host 127.0.0.1 --port "$port" --a2a "$dir" &
  pids+=("$!")
}

echo "Starting A2A api_server processes..."
start_server 8001 "$LAYOUT/8001"
start_server 8002 "$LAYOUT/8002"
start_server 8003 "$LAYOUT/8003"
# Give worker agents a moment so orchestrator can fetch agent cards on startup.
sleep 2
start_server 8004 "$LAYOUT/8004"

if [[ "${START_ADK_WEB:-1}" == "1" ]]; then
  sleep 1
  echo "Starting ADK Web UI on http://127.0.0.1:8000 (orchestrator only)..."
  "$UV" run adk web --no-reload --host 127.0.0.1 --port 8000 "$LAYOUT/ui" &
  pids+=("$!")
fi

echo ""
echo "Ready:"
echo "  - Agent cards: curl http://127.0.0.1:8001/a2a/researcher/.well-known/agent-card.json"
echo "  - Web UI:      http://127.0.0.1:8000"
echo "  - Stop:        Ctrl+C"
echo ""

wait
