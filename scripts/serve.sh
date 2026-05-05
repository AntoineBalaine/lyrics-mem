#!/usr/bin/env bash
# Start/stop the lyrics-mem static server (caddy with basic auth).
# Usage: scripts/serve.sh {start|stop|status|restart}
#
# Required: caddy installed on PATH, and LYRICS_PASS_HASH set (in env or
# ~/.lyrics-mem.env). Generate the hash once with:
#   caddy hash-password --plaintext yourpassword
set -euo pipefail

PROJECT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${LYRICS_PORT:-8081}"
DIR="$PROJECT/dist"
CADDYFILE="$PROJECT/Caddyfile"
PIDFILE="/tmp/lyrics-mem.pid"
LOGFILE="/tmp/lyrics-mem.log"
ENVFILE="${LYRICS_ENV_FILE:-$HOME/.lyrics-mem.env}"

# Source env file if present (auto-export everything in it)
if [ -f "$ENVFILE" ]; then
	set -a
	# shellcheck disable=SC1090
	. "$ENVFILE"
	set +a
fi

export LYRICS_PORT="$PORT"
export LYRICS_DIR="$DIR"

is_running() {
	[ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null
}

case "${1:-}" in
	start)
		if is_running; then
			echo "already running (pid $(cat "$PIDFILE")) on http://127.0.0.1:${PORT}"
			exit 0
		fi
		if ! command -v caddy >/dev/null; then
			echo "caddy not on PATH — install with: sudo apt install caddy" >&2
			exit 1
		fi
		if [ ! -d "$DIR" ]; then
			echo "no dist/ directory at $DIR — run 'npm run build' first" >&2
			exit 1
		fi
		if [ ! -f "$CADDYFILE" ]; then
			echo "Caddyfile not found at $CADDYFILE" >&2
			exit 1
		fi
		if [ -z "${LYRICS_PASS_HASH:-}" ]; then
			cat >&2 <<EOF
LYRICS_PASS_HASH not set.

Generate a hash and save it to $ENVFILE:
  HASH=\$(caddy hash-password --plaintext 'yourpassword')
  echo "LYRICS_PASS_HASH='\$HASH'" > $ENVFILE
  chmod 600 $ENVFILE

Then re-run: $0 start
EOF
			exit 1
		fi

		nohup caddy run --config "$CADDYFILE" --adapter caddyfile \
			>>"$LOGFILE" 2>&1 &
		echo $! >"$PIDFILE"
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
