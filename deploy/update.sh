#!/usr/bin/env bash
# Update ParkPulse to the latest code and restart it.
#   ./deploy/update.sh
#
# set -e stops on the first error. Without it a failed build would sail on and
# restart the site with a half-updated copy of itself.
set -euo pipefail

APP_DIR="/home/parkpulse/app"
cd "$APP_DIR"

echo "==> Pulling latest code"
git pull --ff-only

echo "==> Installing dependencies"
# --include=dev is REQUIRED. NODE_ENV=production makes npm skip
# devDependencies, and this project needs TypeScript, tsx and drizzle-kit at
# build and run time. Without this flag the build fails with confusing
# "command not found" errors.
NODE_ENV=development npm install --include=dev --no-audit --no-fund

echo "==> Applying any database changes"
npm run db:push

echo "==> Building the website"
npm run -w @parkpulse/web build

echo "==> Restarting services"
sudo systemctl restart parkpulse-api
sudo systemctl restart parkpulse-web

sleep 3
echo "==> Status"
systemctl is-active parkpulse-api && echo "  API  running"
systemctl is-active parkpulse-web && echo "  web  running"

echo
echo "Done. If something looks wrong:  journalctl -u parkpulse-web -n 50"
