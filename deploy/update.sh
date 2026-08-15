#!/usr/bin/env bash
# Update RateCoaster to the latest code and restart it.
#
# Run this as the `ubuntu` user (the one you SSH in as):
#   /home/ratecoaster/app/deploy/update.sh
#
# It does the code and build steps as the unprivileged `ratecoaster` user, and
# only the service restarts as you. That split is deliberate: the app user has
# no sudo on purpose, so a compromise of the website cannot restart or reconfigure
# system services.
set -euo pipefail

APP_USER="ratecoaster"
APP_DIR="/home/ratecoaster/app"

if [ "$(id -un)" = "$APP_USER" ]; then
  echo "Run this as the ubuntu user, not as $APP_USER — it needs sudo to restart services." >&2
  exit 1
fi

# Everything the app user can do, it does.
run_as_app() {
  sudo -u "$APP_USER" -H bash -c "cd '$APP_DIR' && $1"
}

echo "==> Pulling latest code"
run_as_app "git pull --ff-only"

echo "==> Installing dependencies"
# --include=dev is REQUIRED. NODE_ENV=production makes npm skip
# devDependencies, and this project needs TypeScript, tsx and drizzle-kit at
# build and run time. Without this the build fails with confusing
# "command not found" errors.
run_as_app "NODE_ENV=development npm install --include=dev --no-audit --no-fund"

echo "==> Applying any database changes"
run_as_app "set -a && . ./.env && set +a && npm run db:push"

echo "==> Building the website"
# Must be production. A development build fails with a misleading error about
# '<Html> should not be imported outside of pages/_document'.
run_as_app "set -a && . ./.env && set +a && NODE_ENV=production npm run -w @ratecoaster/web build"

echo "==> Restarting services"
sudo systemctl restart ratecoaster-api
sudo systemctl restart ratecoaster-web

sleep 3
echo "==> Status"
systemctl is-active --quiet ratecoaster-api && echo "  API  running" || echo "  API  NOT RUNNING"
systemctl is-active --quiet ratecoaster-web && echo "  web  running" || echo "  web  NOT RUNNING"

echo
echo "Done. If something looks wrong:  journalctl -u ratecoaster-web -n 50 --no-pager"
