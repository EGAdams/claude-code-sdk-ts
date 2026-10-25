#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/logs/jeri_agent.pid"

if [ ! -f "$PID_FILE" ]; then
  echo "jeri-agent is not running (no PID file)"
  exit 0
fi

PID=$(cat "$PID_FILE")

if ! kill -0 "$PID" 2>/dev/null; then
  echo "jeri-agent is not running (PID $PID stale)"
  rm -f "$PID_FILE"
  exit 0
fi

echo "Stopping jeri-agent (PID $PID)..."
kill -SIGTERM "$PID"

for i in $(seq 1 10); do
  sleep 1
  if ! kill -0 "$PID" 2>/dev/null; then
    echo "jeri-agent stopped."
    rm -f "$PID_FILE"
    exit 0
  fi
  echo "Waiting ($i/10)..."
done

echo "Force-killing jeri-agent..."
kill -SIGKILL "$PID" 2>/dev/null || true
rm -f "$PID_FILE"
echo "jeri-agent killed."
