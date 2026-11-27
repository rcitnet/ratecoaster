#!/usr/bin/env bash
# Update RateCoaster to the latest code and restart it.
#
# Run this as the `ubuntu` user (the one you SSH in as):
#   /home/ratecoaster/app/deploy/update.sh
#
# It does the code and build steps as the unprivileged `ratecoaster` user, and
# only the system/service steps as you. That split is deliberate: the app user
# has no sudo on purpose, so a compromise of the website cannot restart or
# reconfigure system services.
set -euo pipefail

APP_USER="ratecoaster"
APP_DIR="/home/ratecoaster/app"

if [ "$(id -un)" = "$APP_USER" ]; then
  echo "Run this as the ubuntu user, not as $APP_USER — it needs sudo to restart services." >&2
  exit 1
fi

run_as_app() {
  sudo -u "$APP_USER" -H bash -c "cd '$APP_DIR' && $1"
}

echo "==> Pulling latest code"
run_as_app "git pull --ff-only"

echo "==> Installing dependencies"
# Sharp's SVG renderer needs fonts even on a headless server for social cards.
if ! dpkg-query -W -f='${Status}' fonts-dejavu-core 2>/dev/null | grep -q 'install ok installed' || ! command -v fc-cache >/dev/null; then
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq fontconfig fonts-dejavu-core
fi
run_as_app "NODE_ENV=development npm ci --include=dev --no-audit --no-fund || NODE_ENV=development npm install --include=dev --no-audit --no-fund"

echo "==> Applying any database changes"
if [ -f "$APP_DIR/packages/db/drizzle/meta/_journal.json" ]; then
  run_as_app "set -a && . ./.env && set +a && npm run db:migrate"
else
  run_as_app "set -a && . ./.env && set +a && npm run db:push"
fi

echo "==> Building API bundle"
run_as_app "set -a && . ./.env && set +a && NODE_ENV=production npm run -w @ratecoaster/api build"

echo "==> Building website"
run_as_app "set -a && . ./.env && set +a && NODE_ENV=production npm run -w @ratecoaster/web build"

echo "==> Syncing system config (systemd, logrotate, cron)"
sudo mkdir -p "/home/${APP_USER}/locks" "/home/${APP_USER}/logs"
sudo chown "${APP_USER}:${APP_USER}" "/home/${APP_USER}/locks" "/home/${APP_USER}/logs"
sudo cp "$APP_DIR/deploy/ratecoaster-api.service" /etc/systemd/system/
sudo cp "$APP_DIR/deploy/ratecoaster-web.service" /etc/systemd/system/
sudo cp "$APP_DIR/deploy/logrotate.ratecoaster" /etc/logrotate.d/ratecoaster
sudo chmod 644 /etc/logrotate.d/ratecoaster
sudo crontab -u "$APP_USER" "$APP_DIR/deploy/ratecoaster.cron"

echo "==> Restarting services"
sudo systemctl daemon-reload
sudo systemctl restart ratecoaster-api
sudo systemctl restart ratecoaster-web

echo "==> Running post-deploy health checks"
API_OK=0
WEB_OK=0
for _ in $(seq 1 15); do
  if [ "$API_OK" -eq 0 ] && curl -fsS http://127.0.0.1:8787/health >/dev/null 2>&1; then
    API_OK=1
  fi
  if [ "$WEB_OK" -eq 0 ] && curl -fsS -o /dev/null http://127.0.0.1:3000/ 2>/dev/null; then
    WEB_OK=1
  fi
  if [ "$API_OK" -eq 1 ] && [ "$WEB_OK" -eq 1 ]; then
    break
  fi
  sleep 1
done

echo "==> Status"
[ "$API_OK" -eq 1 ] && echo "  API  healthy (http://127.0.0.1:8787/health)" || { echo "  API  FAILED HEALTH CHECK" >&2; exit 1; }
[ "$WEB_OK" -eq 1 ] && echo "  web  healthy (http://127.0.0.1:3000/)" || { echo "  web  FAILED HEALTH CHECK" >&2; exit 1; }

echo
echo "Done. Logs: journalctl -u ratecoaster-api -u ratecoaster-web -n 50 --no-pager"
