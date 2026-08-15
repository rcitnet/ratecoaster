# Putting ParkPulse on the internet

A complete, no-experience-assumed guide to running the website on your own
server with a real domain and HTTPS.

**Time:** about 2 hours the first time. **Cost:** roughly $6/month plus ~$12/year
for a domain.

Take it in order. Each part ends with a **✅ Check** — if that doesn't match what
you see, stop and fix it before moving on. Ninety percent of deployment misery
is carrying a small problem forward into three more steps.

---

## What you're actually building

Four pieces run on one rented computer (a "VPS" — just a computer in a data
centre you rent by the month):

| Piece | What it does | Port |
|---|---|---|
| **Caddy** | Answers the internet, handles HTTPS, passes requests inward | 80, 443 |
| **Website** | The pages people see | 3000 |
| **API** | Fetches and serves the data | 8787 |
| **PostgreSQL** | Stores the prices | 5432 |

Only Caddy is reachable from outside. The other three listen on `127.0.0.1`,
which means "this machine only" — nobody on the internet can reach your database
directly, no matter what.

Requests flow like this:

```
someone's browser
   │  https://yourdomain.com/hotels
   ▼
 Caddy ──────────────► Website (3000) ──► API (8787) ──► PostgreSQL
   │
   └── /api/* ───────► API (8787)
```

**Why the API lives at `/api` on the same domain**, rather than
`api.yourdomain.com`: signing in uses a cookie, and browsers treat cookies
across different subdomains as suspicious. Same domain means the cookie just
works, with no CORS or SameSite fighting. This one decision saves hours.

---

## Before you start: an honest word about VPS

You picked a VPS over a managed platform. That gives you full control and the
lowest cost, and it means **you** are responsible for security updates,
backups, and fixing things at 11pm. This guide covers all three, including the
security steps most tutorials skip. Do not skip Part 3.

You'll need:

- A credit card
- An email address
- About 2 hours
- Windows, Mac, or Linux on your own machine

---

## Part 1 — Buy a domain

A domain is your address, like `parkpulse.com`.

1. Go to [Cloudflare Registrar](https://dash.cloudflare.com) (sells at cost, no
   upsells) or [Namecheap](https://namecheap.com).
2. Search for a name and buy it. Expect $10–15/year for a `.com`.
3. **Turn on WHOIS privacy** if offered. It's usually free and keeps your home
   address out of a public database.

Write your domain down. Everywhere below that says `example.com`, you'll use
yours instead.

---

## Part 2 — Create the server

I'll use [Hetzner](https://hetzner.com) — the best price for the specs.
[DigitalOcean](https://digitalocean.com) works identically and is slightly
friendlier, at roughly double the price.

1. Sign up and verify your account (Hetzner sometimes asks for ID — this is
   normal, and can take a few hours).
2. Create a project, then **Add Server**.
3. Choose:
   - **Location:** closest to your visitors. US East for a Universal Orlando
     audience.
   - **Image:** **Ubuntu 24.04**
   - **Type:** **CX22** (2 vCPU, 4 GB RAM, 40 GB disk) — about €4/month.

   > **Don't go smaller.** Building the website needs roughly 2 GB of RAM. On a
   > 1 GB server the build dies with a confusing "killed" message. Part 4 adds
   > swap as a safety net, but real memory is better.

4. **SSH keys** — this is how you log in securely, instead of a password.

   On your own computer, open PowerShell (Windows) or Terminal (Mac) and run:

   ```bash
   ssh-keygen -t ed25519 -C "your@email.com"
   ```

   Press Enter three times to accept the defaults. Then print the *public* half:

   ```bash
   # Windows PowerShell
   Get-Content ~\.ssh\id_ed25519.pub

   # Mac / Linux
   cat ~/.ssh/id_ed25519.pub
   ```

   Copy that whole line (it starts `ssh-ed25519`) and paste it into Hetzner's
   **SSH keys** box.

   > The file *without* `.pub` is your private key. Never share or upload it.

5. Name the server `parkpulse` and click **Create & Buy Now**.
6. Copy the **IPv4 address** it gives you. Something like `95.217.44.12`.

**✅ Check:** you have a domain and an IP address written down.

---

## Part 3 — Point the domain at the server

DNS changes take time to spread, so do this now and it'll be ready when you need
it.

At your domain registrar, find **DNS** settings and add two records:

| Type | Name | Value |
|---|---|---|
| A | `@` | your server IP |
| A | `www` | your server IP |

`@` means the bare domain. Save.

Wait 5–30 minutes, then on your own computer:

```bash
ping example.com
```

**✅ Check:** it replies from your server's IP. If not, wait longer — some
registrars take a couple of hours. You can continue with Parts 4–9 meanwhile and
come back.

---

## Part 4 — First login, and locking the server down

New servers get scanned by automated attacks within minutes of existing. This
part is not optional.

### Log in

```bash
ssh root@YOUR_SERVER_IP
```

Type `yes` when asked about authenticity. You should land at a `root@parkpulse:~#`
prompt.

### Update everything

```bash
apt update && apt upgrade -y
```

If asked about keeping config files, accept the default. If it says a reboot is
required, run `reboot`, wait a minute, and `ssh` back in.

### Create a normal user

Running everything as `root` means any mistake is unlimited. Make a regular user:

```bash
adduser parkpulse
```

Give it a strong password when prompted (save it in a password manager), and
press Enter through the name/phone questions.

Let it run admin commands with `sudo`:

```bash
usermod -aG sudo parkpulse
```

Copy your SSH key over so you can log in as the new user:

```bash
rsync --archive --chown=parkpulse:parkpulse ~/.ssh /home/parkpulse
```

**Now test it in a second terminal window, before closing this one:**

```bash
ssh parkpulse@YOUR_SERVER_IP
```

> Keep the root session open until this works. If you lock yourself out with the
> only session closed, you're rebuilding the server from scratch.

### Turn off root login and passwords

Back in the root session:

```bash
nano /etc/ssh/sshd_config
```

`nano` is a simple text editor. Use arrow keys; there's no mouse. Find these
lines (Ctrl+W searches) and set them:

```
PermitRootLogin no
PasswordAuthentication no
```

If a line starts with `#`, delete the `#`. Save with **Ctrl+O**, Enter, then exit
with **Ctrl+X**.

```bash
systemctl restart ssh
```

Now only your SSH key gets in. Password-guessing attacks become impossible.

### Firewall

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status
```

**✅ Check:** you see `22/tcp`, `80/tcp` and `443/tcp` as `ALLOW`. Everything
else — including PostgreSQL — is blocked from the outside.

### Automatic security updates

```bash
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
```

Choose **Yes**. Security patches now install themselves.

### Add swap

Emergency memory, so the website build can't run out and get killed:

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
free -h
```

**✅ Check:** the `Swap:` row shows `2.0Gi`.

Now close the root session and log back in as `parkpulse`:

```bash
exit
ssh parkpulse@YOUR_SERVER_IP
```

**Everything from here runs as `parkpulse`, not root.**

---

## Part 5 — Install the software

### Node.js 22

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node --version
```

**✅ Check:** prints `v22.x.x`.

### PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl status postgresql --no-pager
```

**✅ Check:** shows `active`. Press `q` to exit.

### Caddy — the web server that does HTTPS for you

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
caddy version
```

Caddy gets and renews your HTTPS certificate automatically, forever. There is no
certbot step and no renewal reminder to miss.

### Git

```bash
sudo apt install -y git
```

---

## Part 6 — Create the database

```bash
sudo -u postgres psql
```

You're now in the database prompt (`postgres=#`). Run these three lines, using
your own password:

```sql
CREATE DATABASE parkpulse;
CREATE USER parkpulse WITH ENCRYPTED PASSWORD 'pick-a-long-random-password-here';
GRANT ALL PRIVILEGES ON DATABASE parkpulse TO parkpulse;
\c parkpulse
GRANT ALL ON SCHEMA public TO parkpulse;
\q
```

> Generate a password with `openssl rand -base64 24` and save it — you'll need
> it in Part 8. The `GRANT ALL ON SCHEMA` line is easy to miss and causes a
> "permission denied for schema public" error later if skipped.

**✅ Check:** test the login works:

```bash
psql "postgres://parkpulse:YOUR_DB_PASSWORD@127.0.0.1:5432/parkpulse" -c "SELECT 1;"
```

You should see a table with `1` in it.

---

## Part 7 — Get the code onto the server

### The easy way: GitHub

On **your own computer**, in the project folder:

```bash
cd C:\Users\Rui\parkpulse
git init
git add .
git commit -m "First version"
```

Create an empty repository at [github.com/new](https://github.com/new) — make it
**private** — then follow its "push an existing repository" instructions.

> Check `.gitignore` contains `.env` before pushing. It does in this project, but
> confirm. Pushing secrets to GitHub is the single most common way people leak
> database passwords.

Then on **the server**:

```bash
cd ~
git clone https://github.com/YOUR_USERNAME/parkpulse.git app
cd app
```

For a private repo GitHub will ask for a username and a **personal access
token** (not your password) — create one at Settings → Developer settings →
Personal access tokens.

### The no-GitHub way

From **your own computer**:

```bash
scp -r C:\Users\Rui\parkpulse parkpulse@YOUR_SERVER_IP:~/app
```

Slower, and you'll repeat it for every update, but it works.

**✅ Check:** on the server, `ls ~/app` shows `apps`, `packages`, `package.json`.

---

## Part 8 — Configuration

```bash
cd ~/app
cp deploy/env.production.example .env
nano .env
```

Work through the file and replace:

- every `example.com` → your real domain
- `CHANGE_ME_DB_PASSWORD` → the database password from Part 6
- `CHANGE_ME_RESEND_KEY` → leave for now, you'll set it in Part 11
- the contact email in `COLLECTOR_USER_AGENT` → your real email

Save (Ctrl+O, Enter, Ctrl+X), then lock the file down so only you can read it:

```bash
chmod 600 .env
```

### The three address settings, explained

These trip up almost everyone:

| Setting | Value | Who uses it |
|---|---|---|
| `API_BASE_URL` | `http://127.0.0.1:8787` | The website, talking to the API inside the server |
| `PUBLIC_API_URL` | `https://example.com/api` | Sign-in links in emails — must work from a phone |
| `NEXT_PUBLIC_API_BASE_URL` | `https://example.com/api` | The browser, calling the API |

If sign-in emails contain a link to `127.0.0.1`, you set `PUBLIC_API_URL` wrong.

> **`NEXT_PUBLIC_` variables are baked into the website when you build it.**
> Changing one means running the build again — restarting isn't enough.

---

## Part 9 — Install, create tables, build

```bash
cd ~/app
NODE_ENV=development npm install --include=dev --no-audit --no-fund
```

> **Why `NODE_ENV=development` on an install?** When `NODE_ENV=production`, npm
> skips devDependencies — and this project needs TypeScript, tsx and drizzle-kit
> to build and run. Without this you get baffling "command not found" errors.
> It's only for the install; everything else runs in production mode.

Create the database tables:

```bash
npm run db:push
```

Load the hotels, parks and ticket products:

```bash
npm run db:seed
```

**✅ Check:** prints `seeded 16 properties`, `seeded 6 parks`, `seeded 8 ticket products`.

Build the website:

```bash
NODE_ENV=production npm run -w @parkpulse/web build
```

> **This one must be `production`.** Building with `NODE_ENV=development` fails
> with a confusing error about `<Html> should not be imported outside of
> pages/_document`. That message has nothing to do with the real problem.

**✅ Check:** ends with a table of routes (`/`, `/hotels`, `/waits`…) and no
errors. Takes 1–3 minutes.

---

## Part 10 — Run it as a service

"Services" start automatically on boot and restart if they crash.

```bash
sudo cp ~/app/deploy/parkpulse-api.service /etc/systemd/system/
sudo cp ~/app/deploy/parkpulse-web.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now parkpulse-api parkpulse-web
```

Check both are running:

```bash
systemctl status parkpulse-api --no-pager
systemctl status parkpulse-web --no-pager
```

**✅ Check:** both say `active (running)`. Press `q` to exit each.

Test them directly:

```bash
curl http://127.0.0.1:8787/health
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/
```

**✅ Check:** the first prints `{"ok":true,...}`, the second prints `200`.

If either failed, read the logs — they'll tell you exactly what's wrong:

```bash
journalctl -u parkpulse-api -n 50 --no-pager
```

---

## Part 11 — Go live with HTTPS

```bash
sudo cp ~/app/deploy/Caddyfile /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile
```

Replace both `example.com` entries on the first line with your domain. Save and
exit, then:

```bash
sudo systemctl reload caddy
```

**Now open `https://example.com` in your browser.**

**✅ Check:** the site loads, with a padlock in the address bar. Caddy fetched a
certificate the moment it saw the domain pointing at it.

If you get a certificate error, your DNS from Part 3 hasn't finished spreading.
Wait and reload. Watch what Caddy is doing with:

```bash
sudo journalctl -u caddy -n 50 --no-pager
```

---

## Part 12 — Sign-in emails

Free accounts are the heart of this site, and they don't work without email.

1. Sign up at [resend.com](https://resend.com) — free tier is 3,000 emails/month.
2. **Domains** → **Add Domain** → enter your domain.
3. Resend shows you several DNS records. Add each one at your registrar exactly
   as shown, then click **Verify**. This usually takes a few minutes.

   > These records prove to Gmail and Outlook that you're allowed to send from
   > your domain. Skip them and your emails go to spam, or vanish.

4. **API Keys** → **Create API Key** → copy it (shown only once).
5. On the server:

   ```bash
   nano ~/app/.env
   ```

   Set:

   ```
   RESEND_API_KEY=re_your_actual_key
   EMAIL_FROM=ParkPulse <hello@example.com>
   ```

   Then restart the API:

   ```bash
   sudo systemctl restart parkpulse-api
   ```

**✅ Check:** go to `https://example.com/join`, enter your own email, and see if
the link arrives. Click it — you should land back on the site signed in, with
"Free account" in the header.

If nothing arrives: `journalctl -u parkpulse-api -n 30 --no-pager` will print the
exact reason Resend rejected it.

---

## Part 13 — Turn on data collection

### What works immediately, and what doesn't

**Be clear-eyed about this before you launch:**

- ✅ **Wait times work now.** Free public APIs, no setup.
- ⚠️ **Hotel, ticket and Express prices do not.** Those collectors need a
  booking endpoint captured from your browser first — see
  `apps/api/src/collectors/hotels/README.md`. Until then those pages show an
  honest empty state.

> **Never set `DEMO_MODE=1` on the live site.** It serves invented prices. On
> your own machine that's a preview; on a public site it's misinformation about
> a purchase families are saving up for. The empty state is the honest option.

### Schedule the jobs

```bash
mkdir -p ~/logs
sudo crontab -u parkpulse ~/app/deploy/parkpulse.cron
sudo crontab -u parkpulse -l
```

**✅ Check:** the schedule prints back.

Run the wait-time collector once by hand to confirm:

```bash
cd ~/app && set -a && . ./.env && set +a && npm run collect -- --only wait-times
```

**✅ Check:** it reports parsed counts per park. Then visit
`https://example.com/waits` — real numbers.

Visit `https://example.com/status` any time to see when each feed last ran.

---

## Part 14 — Backups

An unbacked-up database is a database you will eventually lose.

```bash
sudo mkdir -p /var/backups/parkpulse
sudo chown postgres:postgres /var/backups/parkpulse
sudo cp ~/app/deploy/backup.sh /usr/local/bin/parkpulse-backup
sudo chmod +x /usr/local/bin/parkpulse-backup
```

Run it nightly at 2am:

```bash
sudo crontab -e
```

Add this line at the bottom:

```
0 2 * * * sudo -u postgres /usr/local/bin/parkpulse-backup >> /var/log/parkpulse-backup.log 2>&1
```

Test it right now — a backup you've never tested isn't a backup:

```bash
sudo -u postgres /usr/local/bin/parkpulse-backup
ls -lh /var/backups/parkpulse
```

**✅ Check:** a `.dump` file exists and is more than a few kilobytes.

> **Copy these off the server.** A backup that only lives on the machine it's
> backing up doesn't survive that machine dying. Once a week, from your own
> computer:
> ```bash
> scp parkpulse@YOUR_SERVER_IP:/var/backups/parkpulse/*.dump ./backups/
> ```

To restore one:

```bash
sudo -u postgres pg_restore -d parkpulse --clean /var/backups/parkpulse/FILE.dump
```

---

## Part 15 — Updating the site later

Once your code is on GitHub, updating is one command:

```bash
cd ~/app && ./deploy/update.sh
```

That pulls the latest code, installs anything new, applies database changes,
rebuilds, and restarts both services.

To make it executable the first time:

```bash
chmod +x ~/app/deploy/update.sh
```

---

## Troubleshooting

### The site shows "502 Bad Gateway"

Caddy is up but the website behind it isn't.

```bash
systemctl status parkpulse-web --no-pager
journalctl -u parkpulse-web -n 50 --no-pager
```

### "command not found" during install or build

`NODE_ENV=production` made npm skip the build tools. Re-run:

```bash
cd ~/app && NODE_ENV=development npm install --include=dev
```

### Build fails: "`<Html>` should not be imported outside of `pages/_document`"

Misleading message. You built in development mode. Use:

```bash
NODE_ENV=production npm run -w @parkpulse/web build
```

### Build gets "Killed" with no explanation

Out of memory. Confirm swap exists (`free -h`) and add more if needed, or resize
the server up for the duration of the build.

### "permission denied for schema public"

The `GRANT ALL ON SCHEMA public` line in Part 6 got skipped:

```bash
sudo -u postgres psql -d parkpulse -c "GRANT ALL ON SCHEMA public TO parkpulse;"
```

### Sign-in emails never arrive

1. `journalctl -u parkpulse-api -n 30 --no-pager` — the real reason is logged.
2. Check the domain shows **Verified** in Resend.
3. Check `EMAIL_FROM` uses the domain you verified there.

### Sign-in link goes to a page that won't load

`PUBLIC_API_URL` is wrong in `.env`. It must be `https://yourdomain.com/api`, not
a `127.0.0.1` address.

### Signed in, but still only seeing 30 days

`NEXT_PUBLIC_API_BASE_URL` is baked in at build time. Fix it in `.env`, then
rebuild:

```bash
cd ~/app && NODE_ENV=production npm run -w @parkpulse/web build && sudo systemctl restart parkpulse-web
```

### Locked out by SSH

Use your provider's web console (Hetzner and DigitalOcean both have one in the
dashboard) to log in directly and fix `/etc/ssh/sshd_config`.

### Useful commands

```bash
systemctl status parkpulse-api parkpulse-web caddy   # is it running?
journalctl -u parkpulse-api -f                        # watch API logs live
sudo systemctl restart parkpulse-api parkpulse-web    # restart everything
df -h                                                 # disk space
free -h                                               # memory
htop                                                  # what's busy (apt install htop)
```

---

## What it costs

| Item | Cost |
|---|---|
| Hetzner CX22 | ~€4.50/month |
| Domain | ~$12/year |
| Resend (email) | Free to 3,000/month |
| Wait-time APIs | Free |
| **Total** | **≈ $7/month** |

---

## A pre-launch checklist

Before you tell anyone about the site:

- [ ] `https://` works and shows a padlock
- [ ] `http://` redirects to `https://` (Caddy does this automatically)
- [ ] You can sign in with a real email and see the full year afterwards
- [ ] `DEMO_MODE` is **not** set — no invented prices on a public site
- [ ] `/status` shows wait times healthy
- [ ] A backup file exists and you've copied one to your own computer
- [ ] `.env` is `chmod 600` and not in git
- [ ] The footer disclaimer is accurate for what you're actually showing
- [ ] You've re-checked the Express Pass flags in `seed-data.ts` — that field
      drives real spending decisions
