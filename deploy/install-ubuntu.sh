#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
    echo "Run this installer with sudo." >&2
    exit 1
fi

SOURCE_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
SITE_ROOT="/var/www/echomother.ca"
APP_ROOT="/var/www/echomother"
NGINX_SITE="/etc/nginx/sites-available/echomother.ca"
SNIPPET_PATH="/etc/nginx/snippets/echomother-api.conf"

for command_name in node nginx systemctl python3; do
    if ! command -v "$command_name" >/dev/null 2>&1; then
        echo "Required command not found: $command_name" >&2
        exit 1
    fi
done

if [[ ! -f "$SOURCE_DIR/server.js" || ! -f "$SOURCE_DIR/package.json" || ! -f "$SOURCE_DIR/dist/index.html" ]]; then
    echo "Expected server.js, package.json, and dist/index.html beside the deploy directory." >&2
    exit 1
fi

if [[ ! -d "$SITE_ROOT" || ! -f "$NGINX_SITE" ]]; then
    echo "The existing echomother.ca Nginx site was not found; no changes made." >&2
    exit 1
fi

python3 - "$NGINX_SITE" <<'PY'
from pathlib import Path
import sys

config = Path(sys.argv[1]).read_text(encoding="utf-8")
include = "    include /etc/nginx/snippets/echomother-api.conf;"
location = "    location / {\n        try_files $uri $uri/ =404;\n    }"
if include not in config and config.count(location) != 1:
    raise SystemExit("Expected exactly one static Nginx location; no changes made.")
PY

NODE_PATH="$(command -v node)"
if [[ "$NODE_PATH" != "/usr/bin/node" ]]; then
    echo "Update ExecStart in deploy/echomother.service to use $NODE_PATH, then retry." >&2
    exit 1
fi

if ! getent passwd echomother >/dev/null; then
    useradd --system --no-create-home --home-dir "$APP_ROOT" --shell /usr/sbin/nologin echomother
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="/home/jklair/echomother-backups/$STAMP"
install -d -o jklair -g jklair "$BACKUP_DIR/site"
cp -a "$SITE_ROOT/." "$BACKUP_DIR/site/"
cp -a "$NGINX_SITE" "$BACKUP_DIR/echomother.ca.nginx"
chown -R jklair:jklair "$BACKUP_DIR"

install -d -o echomother -g echomother "$APP_ROOT"
rm -rf "$APP_ROOT/dist"
install -o echomother -g echomother -m 0644 "$SOURCE_DIR/server.js" "$APP_ROOT/server.js"
install -o echomother -g echomother -m 0644 "$SOURCE_DIR/package.json" "$APP_ROOT/package.json"
cp -a "$SOURCE_DIR/dist" "$APP_ROOT/dist"
chown -R echomother:echomother "$APP_ROOT"
cp -a "$APP_ROOT/dist/." "$SITE_ROOT/"

install -d -m 0755 /etc/echomother
if [[ ! -f /etc/echomother/echomother.env ]]; then
    printf 'OPENAI_MODEL=gpt-4o-mini\n' > /etc/echomother/echomother.env
fi
chown root:root /etc/echomother/echomother.env
chmod 0600 /etc/echomother/echomother.env

install -D -m 0644 "$SOURCE_DIR/deploy/echomother.service" /etc/systemd/system/echomother.service
install -D -m 0644 "$SOURCE_DIR/deploy/nginx-api-location.conf" "$SNIPPET_PATH"

python3 - "$NGINX_SITE" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
config = path.read_text(encoding="utf-8")
include = "    include /etc/nginx/snippets/echomother-api.conf;"
location = "    location / {\n        try_files $uri $uri/ =404;\n    }"
if include not in config:
    path.write_text(config.replace(location, f"{include}\n\n{location}", 1), encoding="utf-8")
PY

systemctl daemon-reload
systemctl enable --now echomother

if ! nginx -t; then
    cp -a "$BACKUP_DIR/echomother.ca.nginx" "$NGINX_SITE"
    echo "Nginx validation failed. Restored the original site config; backup: $BACKUP_DIR" >&2
    exit 1
fi

systemctl reload nginx
echo "EchoMother deployed. Backup: $BACKUP_DIR"
echo "Add OPENAI_API_KEY to /etc/echomother/echomother.env to enable model replies."