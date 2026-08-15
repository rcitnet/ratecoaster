#!/usr/bin/env bash
#
# RateCoaster server bootstrap — Parts 5 to 10 of DEPLOYING.md in one run.
#
# Run as the `ubuntu` user on a fresh Ubuntu 24.04 Lightsail instance:
#
#   curl -fsSL https://raw.githubusercontent.com/YOU/ratecoaster/main/deploy/bootstrap.sh -o bootstrap.sh
#   less bootstrap.sh          # read it before running it
#   bash bootstrap.sh
#
# It is idempotent: safe to re-run if a step fails. Everything already done is
# detected and skipped.
#
# It does NOT do: DNS (Part 3), the Lightsail console firewall (Part 2),
# HTTPS certificates (Part 11 — Caddy does that itself once DNS resolves),
# email keys (Part 12), or cron (Part 13).
#
set -euo pipefail

APP_USER="ratecoaster"
APP_DIR="/home/${APP_USER}/app"
DB_NAME="ratecoaster"
DB_USER="ratecoaster"
DOMAIN="ratecoaster.net"
NODE_MAJOR="22"

# ── helpers ──────────────────────────────────────────────────────────────────
c_ok()   { printf '\033[0;32m  ok\033[0m %s\n' "$1"; }
c_do()   { printf '\033[0;36m==>\033[0m %s\n' "$1"; }
c_skip() { printf '\033[0;33m  --\033[0m %s (already done)\n' "$1"; }
c_err()  { printf '\033[0;31mERROR\033[0m %s\n' "$1" >&2; }

die() { c_err "$1"; exit 1; }

[ "$(id -un)" = "ubuntu" ] || die "Run this as the ubuntu user, not $(id -un)."
[ -f /etc/os-release ] && . /etc/os-release
[ "${VERSION_ID:-}" = "24.04" ] || echo "WARNING: expected Ubuntu 24.04, found ${VERSION_ID:-unknown}. Continuing anyway."

# ── 0. what we need from you, up front ───────────────────────────────────────
c_do "Collecting the two things this script can't invent"

if [ -z "${SOURCE_MODE:-}" ]; then
  echo
  echo "How should the code get onto this server?"
  echo "  1) git clone from a repository (recommended)"
  echo "  2) it's already at ${APP_DIR} (you used scp)"
  read -rp "Choice [1/2]: " SOURCE_MODE
fi

if [ "$SOURCE_MODE" = "1" ] && [ ! -d "${APP_DIR}/.git" ]; then
  read -rp "Repository URL: " REPO_URL
  [ -n "$REPO_URL" ] || die "A repository URL is required."
fi

# Read the DB password without echoing it, so it never lands in a log or in
# shell history. Generated for you if you'd rather not pick one.
if [ -z "${DB_PASSWORD:-}" ]; then
  echo
  read -rsp "Database password for '${DB_USER}' (blank = generate one): " DB_PASSWORD
  echo
  if [ -z "$DB_PASSWORD" ]; then
    # hex, not base64 — a / or + in a password breaks the postgres:// URL.
    DB_PASSWORD="$(openssl rand -hex 24)"
    echo "Generated. It will be printed once at the end — save it then."
    GENERATED_PW=1
  fi
fi

case "$DB_PASSWORD" in
  *\'*) die "Password cannot contain a single quote. Pick another." ;;
  *[/@]*) die "Password cannot contain / or @ — those break the postgres:// URL. Use letters and digits." ;;
esac

# ── 1. system packages ───────────────────────────────────────────────────────
c_do "Updating packages"
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq
c_ok "system up to date"

c_do "Installing Node.js ${NODE_MAJOR}"
if command -v node >/dev/null && node --version | grep -q "^v${NODE_MAJOR}\."; then
  c_skip "node $(node --version)"
else
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash - >/dev/null
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs
  c_ok "node $(node --version)"
fi

c_do "Installing PostgreSQL"
if command -v psql >/dev/null; then
  c_skip "postgres present"
else
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql postgresql-contrib
  c_ok "postgres installed"
fi
sudo systemctl enable --now postgresql >/dev/null 2>&1 || true

c_do "Installing Caddy"
if command -v caddy >/dev/null; then
  c_skip "caddy present"
else
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq caddy
  c_ok "caddy installed"
fi

c_do "Installing helpers (git, btop, ncdu, unattended-upgrades)"
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq git btop ncdu unattended-upgrades
c_ok "helpers installed"

# ── 2. swap ──────────────────────────────────────────────────────────────────
c_do "Configuring swap"
if swapon --show | grep -q /swapfile; then
  c_skip "swap active"
else
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile >/dev/null
  sudo swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
  c_ok "2G swap active"
fi

# ── 3. firewall ──────────────────────────────────────────────────────────────
c_do "Configuring ufw"
sudo ufw allow OpenSSH >/dev/null
sudo ufw allow 80/tcp >/dev/null
sudo ufw allow 443/tcp >/dev/null
sudo ufw --force enable >/dev/null
c_ok "ufw allows 22, 80, 443"
echo "    REMINDER: the Lightsail console firewall is separate. Open 80 and 443"
echo "    there too, under your instance -> Networking -> IPv4 Firewall."

# ── 4. application user ──────────────────────────────────────────────────────
c_do "Creating the ${APP_USER} user"
if id "$APP_USER" >/dev/null 2>&1; then
  c_skip "user exists"
else
  sudo adduser --system --group --shell /bin/bash --home "/home/${APP_USER}" "$APP_USER" >/dev/null
  c_ok "user created (no password, no sudo — by design)"
fi
sudo mkdir -p "/home/${APP_USER}/logs"
sudo chown -R "${APP_USER}:${APP_USER}" "/home/${APP_USER}"
# 0750 so members of the ratecoaster group (add yourself with
# `sudo usermod -aG ratecoaster ubuntu`) can read the app's files. Default for a
# --system user is 0700, which locks even you out of your own deployment.
sudo chmod 750 "/home/${APP_USER}"
[ -d "$APP_DIR" ] && sudo chmod 750 "$APP_DIR" || true

# ── 5. database ──────────────────────────────────────────────────────────────
c_do "Setting up the database"
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  c_skip "database ${DB_NAME} exists"
else
  sudo -u postgres createdb "$DB_NAME"
  c_ok "database ${DB_NAME} created"
fi

# The password goes to psql over stdin, not as an argument. Anything on a
# command line is visible to `ps` for as long as the process runs, which on a
# shared or compromised box is a real leak.
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1; then
  sudo -u postgres psql -q <<SQL
ALTER USER ${DB_USER} WITH ENCRYPTED PASSWORD '${DB_PASSWORD}';
SQL
  c_ok "password updated for existing user ${DB_USER}"
else
  sudo -u postgres psql -q <<SQL
CREATE USER ${DB_USER} WITH ENCRYPTED PASSWORD '${DB_PASSWORD}';
SQL
  c_ok "user ${DB_USER} created"
fi

sudo -u postgres psql -q -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
# Easy to miss, and its absence surfaces much later as a confusing
# "permission denied for schema public" during db:push.
sudo -u postgres psql -q -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO ${DB_USER};"
c_ok "privileges granted"

PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT 1;" >/dev/null \
  || die "Could not connect as ${DB_USER}. Check the password and try again."
c_ok "verified connection as ${DB_USER}"

# ── 6. source code ───────────────────────────────────────────────────────────
c_do "Getting the code"
if [ -d "${APP_DIR}/.git" ]; then
  sudo -u "$APP_USER" -H git -C "$APP_DIR" pull --ff-only || true
  c_skip "repo present, pulled latest"
elif [ -f "${APP_DIR}/package.json" ]; then
  c_skip "code present at ${APP_DIR}"
else
  [ -n "${REPO_URL:-}" ] || die "No code at ${APP_DIR} and no repository URL given."
  sudo -u "$APP_USER" -H git clone "$REPO_URL" "$APP_DIR"
  c_ok "cloned"
fi
sudo chown -R "${APP_USER}:${APP_USER}" "$APP_DIR"
sudo chmod 750 "$APP_DIR"
[ -f "${APP_DIR}/package.json" ] || die "No package.json at ${APP_DIR} — is the code really there?"

# ── 7. environment file ──────────────────────────────────────────────────────
c_do "Writing .env"
if [ -f "${APP_DIR}/.env" ]; then
  c_skip ".env exists — leaving it alone"
else
  sudo -u "$APP_USER" tee "${APP_DIR}/.env" >/dev/null <<EOF
NODE_ENV=production
SITE_NAME=RateCoaster

DATABASE_URL=postgres://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5432/${DB_NAME}

API_PORT=8787
API_BASE_URL=http://127.0.0.1:8787
PUBLIC_API_URL=https://${DOMAIN}/api
NEXT_PUBLIC_API_BASE_URL=https://${DOMAIN}/api
WEB_ORIGIN=https://${DOMAIN}
CORS_ORIGINS=https://${DOMAIN},https://www.${DOMAIN}

# Sign-in emails do not work until these are set. See Part 12.
RESEND_API_KEY=
EMAIL_FROM=RateCoaster <hello@${DOMAIN}>

COLLECTOR_MAX_RPM=12
COLLECTOR_USER_AGENT=RateCoasterBot/1.0 (+https://${DOMAIN}/bot; hello@${DOMAIN})
COLLECTOR_DRY_RUN=1
WAITS_PROVIDER=themeparks
WAIT_RAW_RETENTION_DAYS=45

# DEMO_MODE is deliberately absent. Setting it to 1 serves invented hotel
# prices, which must never happen on a public site.
EOF
  sudo chmod 600 "${APP_DIR}/.env"
  sudo chown "${APP_USER}:${APP_USER}" "${APP_DIR}/.env"
  c_ok ".env written (chmod 600)"
fi

# ── 8. install, migrate, build ───────────────────────────────────────────────
c_do "Installing dependencies (this takes a few minutes)"
# NODE_ENV=development is required: with production, npm skips devDependencies
# and the build then fails on missing TypeScript/tsx/drizzle-kit.
sudo -u "$APP_USER" -H bash -c "cd '$APP_DIR' && NODE_ENV=development npm install --include=dev --no-audit --no-fund" >/dev/null
c_ok "dependencies installed"

c_do "Creating database tables"
sudo -u "$APP_USER" -H bash -c "cd '$APP_DIR' && set -a && . ./.env && set +a && npm run db:push"
c_ok "schema applied"

c_do "Seeding reference data"
sudo -u "$APP_USER" -H bash -c "cd '$APP_DIR' && set -a && . ./.env && set +a && npm run db:seed"
c_ok "hotels, parks and ticket products seeded"

c_do "Building the website (1-3 minutes)"
# Must be production here. A development build fails with a misleading error
# about '<Html> should not be imported outside of pages/_document'.
sudo -u "$APP_USER" -H bash -c "cd '$APP_DIR' && set -a && . ./.env && set +a && NODE_ENV=production npm run -w @ratecoaster/web build"
c_ok "website built"

# ── 9. services ──────────────────────────────────────────────────────────────
c_do "Installing systemd services"
sudo cp "${APP_DIR}/deploy/ratecoaster-api.service" /etc/systemd/system/
sudo cp "${APP_DIR}/deploy/ratecoaster-web.service" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ratecoaster-api ratecoaster-web >/dev/null
sleep 4
systemctl is-active --quiet ratecoaster-api || die "API failed to start. See: journalctl -u ratecoaster-api -n 40"
systemctl is-active --quiet ratecoaster-web || die "Web failed to start. See: journalctl -u ratecoaster-web -n 40"
c_ok "both services running"

curl -fsS http://127.0.0.1:8787/health >/dev/null || die "API is up but /health did not respond."
curl -fsS -o /dev/null http://127.0.0.1:3000/ || die "Website is up but did not serve a page."
c_ok "both responded locally"

# ── 10. web server ───────────────────────────────────────────────────────────
c_do "Configuring Caddy"
sudo cp "${APP_DIR}/deploy/Caddyfile" /etc/caddy/Caddyfile
sudo systemctl reload caddy || sudo systemctl restart caddy
c_ok "caddy configured for ${DOMAIN}"

# ── done ─────────────────────────────────────────────────────────────────────
echo
echo "────────────────────────────────────────────────────────────"
echo " Done."
echo
if [ -n "${GENERATED_PW:-}" ]; then
  echo " Database password (save this now, it is not shown again):"
  echo "   ${DB_PASSWORD}"
  echo
fi
echo " Next, in order:"
echo "   1. Point ${DOMAIN} at this server's static IP (Part 3)"
echo "   2. Open 80 and 443 in the Lightsail console firewall (Part 2)"
echo "   3. Visit https://${DOMAIN} — Caddy gets the certificate automatically"
echo "   4. Add RESEND_API_KEY to ${APP_DIR}/.env for sign-in emails (Part 12)"
echo "   5. Install cron for the collectors (Part 13):"
echo "      sudo crontab -u ${APP_USER} ${APP_DIR}/deploy/ratecoaster.cron"
echo
echo " Wait times will work immediately. Hotel, ticket and Express prices stay"
echo " empty until you capture a booking endpoint — COLLECTOR_DRY_RUN is set"
echo " to 1 so nothing is fetched until you deliberately turn it off."
echo "────────────────────────────────────────────────────────────"
