#!/usr/bin/env bash
# Start/stop the lyrics-mem static server.
# Usage: scripts/serve.sh {start|stop|status|restart}
#
# LYRICS_MODE controls which build is served:
#   (unset)          → private: dist/        on port 8081
#   LYRICS_MODE=public → public:  dist-public/ on port 8082
#
# Each mode keeps its own PID/log files so the two servers can run side-by-side.
set -euo pipefail

PROJECT="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${LYRICS_MODE:-private}"

case "$MODE" in
	private)
		DEFAULT_PORT=8081
		DEFAULT_DIR="$PROJECT/dist"
		TAG="private"
		;;
	public)
		DEFAULT_PORT=8082
		DEFAULT_DIR="$PROJECT/dist-public"
		TAG="public"
		;;
	*)
		echo "LYRICS_MODE must be unset, 'private', or 'public' (got: $MODE)" >&2
		exit 1
		;;
esac

PORT="${LYRICS_PORT:-$DEFAULT_PORT}"
DIR="${LYRICS_DIR:-$DEFAULT_DIR}"
PIDFILE="/tmp/lyrics-mem-${TAG}.pid"
LOGFILE="/tmp/lyrics-mem-${TAG}.log"

is_running() {
	[ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null
}

case "${1:-}" in
	start)
		if is_running; then
			echo "${TAG}: already running (pid $(cat "$PIDFILE")) on http://127.0.0.1:${PORT}"
			exit 0
		fi
		if [ ! -d "$DIR" ]; then
			echo "${TAG}: no $DIR — run 'npm run build${MODE:+:$MODE}' first" >&2
			exit 1
		fi
		nohup python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$DIR" \
			>>"$LOGFILE" 2>&1 &
		echo $! >"$PIDFILE"
		sleep 0.5
		if is_running; then
			echo "${TAG}: started (pid $(cat "$PIDFILE")) on http://127.0.0.1:${PORT}"
			echo "${TAG}: log: $LOGFILE"
		else
			echo "${TAG}: failed to start; check $LOGFILE" >&2
			rm -f "$PIDFILE"
			exit 1
		fi
		;;
	stop)
		if is_running; then
			kill "$(cat "$PIDFILE")"
			rm -f "$PIDFILE"
			echo "${TAG}: stopped"
		else
			echo "${TAG}: not running"
			rm -f "$PIDFILE"
		fi
		;;
	status)
		if is_running; then
			echo "${TAG}: running (pid $(cat "$PIDFILE")) on http://127.0.0.1:${PORT}"
		else
			echo "${TAG}: not running"
		fi
		;;
	restart)
		"$0" stop || true
		sleep 1
		"$0" start
		;;
	*)
		echo "Usage: $0 {start|stop|status|restart}" >&2
		echo "       LYRICS_MODE=public $0 start  # public variant" >&2
		exit 1
		;;
esac
