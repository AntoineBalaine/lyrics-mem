#!/usr/bin/env bash
# Start/stop the lyrics-mem static server.
# Usage: scripts/serve.sh {start|stop|status|restart}
set -euo pipefail

PORT="${LYRICS_PORT:-8081}"
DIR="$(cd "$(dirname "$0")/.." && pwd)/dist"
PIDFILE="/tmp/lyrics-mem.pid"
LOGFILE="/tmp/lyrics-mem.log"

is_running() {
  [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null
}

case "${1:-}" in
  start)
    if is_running; then
      echo "already running (pid $(cat "$PIDFILE")) on http://127.0.0.1:${PORT}"
      exit 0
    fi
    if [ ! -d "$DIR" ]; then
      echo "no dist/ directory at $DIR — run 'npm run build' first" >&2
      exit 1
    fi
    nohup python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$DIR" \
      >> "$LOGFILE" 2>&1 &
    echo $! > "$PIDFILE"
    sleep 0.5
    if is_running; then
      echo "started (pid $(cat "$PIDFILE")) on http://127.0.0.1:${PORT}"
      echo "log: $LOGFILE"
    else
      echo "failed to start; check $LOGFILE" >&2
      rm -f "$PIDFILE"
      exit 1
    fi
    ;;
  stop)
    if is_running; then
      kill "$(cat "$PIDFILE")"
      rm -f "$PIDFILE"
      echo "stopped"
    else
      echo "not running"
      rm -f "$PIDFILE"
    fi
    ;;
  status)
    if is_running; then
      echo "running (pid $(cat "$PIDFILE")) on http://127.0.0.1:${PORT}"
    else
      echo "not running"
    fi
    ;;
  restart)
    "$0" stop || true
    sleep 1
    "$0" start
    ;;
  *)
    echo "Usage: $0 {start|stop|status|restart}" >&2
    exit 1
    ;;
esac
