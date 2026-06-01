#!/usr/bin/env bash
# Install the lyrics-mem container stack on the HOST.
#
#   sudo bash /tank/projects/lyrics-mem/scripts/systemd/install.sh        # tear down old units, install new
#   sudo bash /tank/projects/lyrics-mem/scripts/systemd/install.sh start  # also `systemctl start` and probe
#
# What "install" does (no container is started unless you pass `start`):
#   1. Stops & disables any older host-python lyrics-mem units, removes their files.
#   2. Drops the new (compose-based) lyrics-mem.service into /etc/systemd/system/.
#   3. systemctl daemon-reload + enable. Does NOT start.
#
# `start` (optional) additionally:
#   4. systemctl start lyrics-mem.service  -> runs `docker compose up -d`.
#   5. Probes the local origin (what cloudflared sees) and the public URLs.
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
	echo "must be run as root (use sudo)" >&2
	exit 1
fi

PROJECT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="$PROJECT/scripts/systemd"
DEST=/etc/systemd/system

# Sanity checks
if ! command -v docker >/dev/null; then
	echo "docker not on PATH" >&2; exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
	echo "docker compose v2 plugin missing — install docker-compose-plugin or upgrade docker" >&2
	exit 1
fi
if [[ ! -f "$PROJECT/compose.yaml" ]]; then
	echo "missing $PROJECT/compose.yaml" >&2; exit 1
fi
if [[ ! -f "$PROJECT/dist/index.html" || ! -f "$PROJECT/dist-public/index.html" ]]; then
	echo "missing $PROJECT/dist/index.html or $PROJECT/dist-public/index.html — run 'npm run build' and 'npm run build:public' first" >&2
	exit 1
fi

echo "==> tearing down any older host-python lyrics-mem units"
systemctl disable --now lyrics-mem.service        2>/dev/null || true
systemctl disable --now lyrics-mem-public.service 2>/dev/null || true
rm -f "$DEST/lyrics-mem-public.service"
# We're about to overwrite lyrics-mem.service with the new (compose) unit; old host-python version had the same filename so no separate cleanup is needed.

echo "==> installing $SRC/lyrics-mem.service into $DEST"
install -m 0644 "$SRC/lyrics-mem.service" "$DEST/lyrics-mem.service"

echo "==> systemctl daemon-reload + enable (NOT starting unless you pass 'start')"
systemctl daemon-reload
systemctl enable lyrics-mem.service

if [[ "${1:-}" != "start" ]]; then
	echo
	echo "Done. Unit installed and enabled (will start at next boot)."
	echo "To start it now:"
	echo "  sudo systemctl start lyrics-mem.service"
	echo "Or re-run this script with the 'start' arg:"
	echo "  sudo bash $0 start"
	exit 0
fi

echo "==> systemctl start lyrics-mem.service"
systemctl start lyrics-mem.service

# Wait for the containers to come up + healthchecks to pass.
sleep 4

echo
echo "==> docker ps"
docker ps --filter name=lyrics-mem --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo
echo "==> origin probe (what cloudflared sees on host loopback)"
curl -sS --max-time 5 -o /dev/null -w "127.0.0.1:8081  %{http_code}\n" http://127.0.0.1:8081/ || true
curl -sS --max-time 5 -o /dev/null -w "127.0.0.1:8082  %{http_code}\n" http://127.0.0.1:8082/ || true

echo
echo "==> external probe (through Cloudflare)"
curl -sS --max-time 10 -o /dev/null -w "lyrics.perken.tv         %{http_code}\n" https://lyrics.perken.tv/        || true
curl -sS --max-time 10 -o /dev/null -w "public-lyrics.perken.tv  %{http_code}\n" https://public-lyrics.perken.tv/ || true

echo
echo "Done. To verify reboot survival:"
echo "  systemctl is-enabled lyrics-mem.service"
