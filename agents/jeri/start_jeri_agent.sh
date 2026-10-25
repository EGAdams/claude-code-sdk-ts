#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/logs/jeri_agent.pid"
LOG_FILE="$SCRIPT_DIR/logs/jeri_agent.log"

mkdir -p "$SCRIPT_DIR/logs"

# Check for stale PID
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE")
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "jeri-agent is already running (PID $OLD_PID)"
    exit 0
  else
    echo "Removing stale PID file (PID $OLD_PID was not running)"
    rm -f "$PID_FILE"
  fi
fi

cd "$SCRIPT_DIR"

# Ensure SDK is built
if [ ! -f "$SCRIPT_DIR/../../dist/index.js" ]; then
  echo "Building SDK first..."
  (cd "$SCRIPT_DIR/../.." && npm run build)
fi

# Ensure jeri dependencies are installed
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
  echo "Installing jeri-agent dependencies..."
  npm install
fi

echo "Starting jeri-agent..."
nohup npx tsx index.ts >> "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"
echo "jeri-agent started (PID $(cat "$PID_FILE"))"
echo "Logs: $LOG_FILE"
