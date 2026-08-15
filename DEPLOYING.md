# Putting RateCoaster on the internet

A complete, no-experience-assumed guide to running the website on your own
server with a real domain and HTTPS.

**Time:** about 2 hours the first time. **Cost:** about $27/month on AWS
Lightsail, plus ~$12/year for the domain.

Take it in order. Each part ends with a **✅ Check** — if that doesn't match what
you see, stop and fix it before moving on. Ninety percent of deployment misery
is carrying a small problem forward into three more steps.

---

## What you're actually building

Four pieces run on one Lightsail instance (a "VPS" — just a computer in an AWS
data centre you rent by the month):

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

- Your AWS account (already done)
- Your domain, ratecoaster.net (already done)
- About 2 hours
- Windows, Mac, or Linux on your own machine

**One Lightsail quirk to hold in your head throughout:** there are **two
firewalls**. The Lightsail console controls what reaches the machine; `ufw` on
the server controls what the machine accepts. A rule missing from either one
produces the same symptom — a site that won't load while every service reports
healthy.

---

## Part 1 — Your domain

You already own **ratecoaster.net**. Every command and config file below is
filled in with it, so there's nothing to substitute as you go.

Two things worth doing at your registrar first:

1. **Turn on WHOIS privacy** if it isn't already. Usually free, and it keeps your
   home address out of a public database that spammers scrape.
2. **Check whether `ratecoaster.com` is available.** People type `.com` from
   habit. If it's free, buying it and pointing it at the same server costs about
   $12 and stops you losing visitors who guessed wrong. If it's taken, just make
   sure every place you write the name — social bios, printed material, word of
   mouth — says `.net` explicitly.

---

## Part 2 — Create the Lightsail instance

1. Go to the [Lightsail console](https://lightsail.aws.amazon.com) and click
   **Create instance**.

2. **Region** — pick **US East (N. Virginia)** or **US East (Ohio)**. Your
   audience is Orlando-heavy, so east coast keeps the site snappy for them.

   > Choose carefully. You cannot move an instance between regions later without
   > rebuilding it from a snapshot.

3. **Platform:** Linux/Unix. **Blueprint:** click **OS Only** → **Ubuntu 24.04 LTS**.

   > Don't pick one of the app blueprints (WordPress, Node.js, etc.). They come
   > with pre-installed software you'd have to work around.

4. **SSH key pair** — this is how you log in, instead of a password.

   The simplest path is the default key: click **Change SSH key pair** →
   **Download**. Lightsail names it `LightsailDefaultKey-<region>.pem` — for
   N. Virginia that's `LightsailDefaultKey-us-east-1.pem`. Save it to
   `C:\Users\Rui\.ssh\`.

   > The region in that filename matters. A key downloaded for one region will
   > not open an instance in another, and the failure looks identical to a
   > wrong-password error.

   > That `.pem` is the only copy. Lose it and you're locked out of the server
   > permanently — you'd rebuild from a snapshot. Back it up.

5. **Instance plan** — choose the **$24/month** plan: 4 GB RAM, 2 vCPU, 80 GB
   SSD, 4 TB transfer.

   > **Why not the $12 (2 GB) plan?** Building the website peaks around 2 GB of
   > RAM. On a 2 GB server every deploy leans on swap, and a build that gets
   > killed halfway is a genuinely confusing thing to debug. Also note Lightsail
   > can upsize but effectively *cannot* downsize — you can't restore a snapshot
   > onto a smaller disk — so it's easier to move up later than down.

6. Name it `ratecoaster` and click **Create instance**. It takes a minute or two
   to show as **Running**.

### Attach a static IP — do not skip this

By default a Lightsail instance gets a **dynamic** public IP that changes every
time the instance stops and starts. Point your domain at that and the site will
mysteriously go dark the first time the instance restarts.

1. In the Lightsail console, open your instance → **Networking** tab.
2. Under **IPv4 Networking**, click **Attach static IP**.
3. Name it `ratecoaster-ip` and attach it to the instance.

Static IPs are **free while attached to a running instance**. AWS charges only
if you reserve one and leave it unattached.

**✅ Check:** the Networking tab shows a static IP. Write it down — that's your
server address for the rest of this guide.

### Open the firewall ports

Lightsail has its **own** firewall in the console, separate from the `ufw`
firewall you'll configure in Part 4. Both must allow traffic or the site simply
won't load — and the server will look perfectly healthy while it doesn't.

Still on the **Networking** tab, under **IPv4 Firewall**, make sure these rules
exist and add any that are missing:

| Application | Protocol | Port |
|---|---|---|
| SSH | TCP | 22 |
| HTTP | TCP | 80 |
| HTTPS | TCP | 443 |

Leave everything else closed. In particular do **not** open 5432 (PostgreSQL),
3000, or 8787 — those are internal only, and exposing the database to the
internet is how databases get ransomed.

**✅ Check:** you have a domain and a static IP address written down.

---

## Part 3 — Point the domain at the server

DNS changes take time to spread, so do this now and it'll be ready when you need
it.

You have two options. Either works — pick one, not both.

**Option A — at your registrar (simplest).** Find **DNS** settings and add two
records:

| Type | Name | Value |
|---|---|---|
| A | `@` | your server IP |
| A | `www` | your server IP |

`@` means the bare domain. Save.

**Option B — Lightsail DNS.** In the Lightsail console under **Networking** →
**Create DNS zone**, add your domain, then point your registrar's nameservers at
the four AWS ones it gives you. Slightly more setup, but it keeps DNS next to
the server and Lightsail gives you three DNS zones at no charge.

Wait 5–30 minutes, then on your own computer:

```bash
ping ratecoaster.net
```

**✅ Check:** it replies from your server's IP. If not, wait longer — some
registrars take a couple of hours. You can continue with Parts 4–9 meanwhile and
come back.

---

## Part 4 — First login, and setting up users

Lightsail differs from a plain VPS in two ways that matter here: you log in as
**`ubuntu`**, not `root`, and you authenticate with the `.pem` file you
downloaded rather than a password.

### Log in

**Windows PowerShell:**

```powershell
icacls "C:\Users\Rui\.ssh\LightsailDefaultKey-us-east-1.pem" /inheritance:r
icacls "C:\Users\Rui\.ssh\LightsailDefaultKey-us-east-1.pem" /grant:r "$($env:USERNAME):(R)"
ssh -i "C:\Users\Rui\.ssh\LightsailDefaultKey-us-east-1.pem" ubuntu@YOUR_STATIC_IP
```

**Mac / Linux:**

```bash
chmod 400 ~/.ssh/LightsailDefaultKey-us-east-1.pem
ssh -i ~/.ssh/LightsailDefaultKey-us-east-1.pem ubuntu@YOUR_STATIC_IP
```

> Those permission commands aren't optional. SSH refuses a key file other
> accounts on your computer can read — the error is "UNPROTECTED PRIVATE KEY
> FILE".
>
> And the `-i` isn't optional either. Without it, SSH never offers this key and
> you get `Permission denied (publickey)`, which reads like the key is wrong
> when in fact it was never tried. Those two are the most common first-connect
> failures, in that order.

Type `yes` when asked about authenticity. You should land at
`ubuntu@ip-172-26-x-x:~$`.

> **Shortcut:** the Lightsail console also has a browser-based SSH terminal —
> click **Connect using SSH** on the instance page. Handy if you ever lose the
> `.pem`, and it's how you'd recover from a locked-out SSH config.

### Update everything

```bash
sudo apt update && sudo apt upgrade -y
```

If asked about keeping config files, accept the default. If it says a reboot is
required, run `sudo reboot`, wait a minute, and SSH back in.

> Everything from here needs `sudo` in front of admin commands, because `ubuntu`
> is a normal user. That's the point — it means a typo can't wreck the system
> without you explicitly asking.

### Create the application user

The site runs as its own user with no login and no sudo. If the website is ever
compromised, the attacker lands in an account that can't become root and can't
SSH in from outside.

```bash
sudo adduser --system --group --shell /bin/bash --home /home/ratecoaster ratecoaster
sudo mkdir -p /home/ratecoaster/logs
sudo chown -R ratecoaster:ratecoaster /home/ratecoaster
sudo chmod 750 /home/ratecoaster
```

`--system` creates an account with no password and no ability to log in
directly. That's deliberate: nothing can log in as the account that runs your
website.

Its home directory is mode `0750` — readable only by `ratecoaster`. Add yourself
to its group so you can browse the app's files when you need to:

```bash
sudo usermod -aG ratecoaster ubuntu
newgrp ratecoaster
```

Without this, `cd /home/ratecoaster/app` fails with "Permission denied" even
though you have sudo — you'd be able to `sudo ls` it but not walk into it.
`newgrp` applies the change to your current shell; otherwise it takes effect the
next time you log in.

You'll have read access, not write. Writes still go through `sudo -u
ratecoaster`, which is the split you want: browse freely, but only the app user
can change the app's files. `.env` stays `chmod 600` and unreadable to you
without sudo either way.

> **Don't run `sudo -u ratecoaster bash` yet.** Part 9 will tell you when to
> switch to that user. If you switch now, the very next `sudo` command will
> prompt for a password that does not exist, because `ratecoaster` has none.
> If that happens, type `exit` to get back to `ubuntu`.

**✅ Check:** `id ratecoaster` prints a uid and group, `whoami` still says
`ubuntu`, and `ls /home/ratecoaster` works without sudo.

### Harden SSH

Lightsail already disables password logins by default, but confirm it and turn
off direct root access:

```bash
sudo nano /etc/ssh/sshd_config
```

`nano` is a simple text editor — arrow keys, no mouse. Use Ctrl+W to search.
Make sure these two lines read exactly:

```
PermitRootLogin no
PasswordAuthentication no
```

If a line starts with `#`, delete the `#`.

> You'll likely find `#PermitRootLogin prohibit-password`. The `#` means it's
> commented, but that value is OpenSSH's built-in default and is already in
> force — so root can't use a password, but root *could* still log in with a
> key. Changing it to `no` closes that off entirely. You lose nothing: `ubuntu`
> has sudo.

Save with **Ctrl+O**, Enter, exit with **Ctrl+X**.

### Check what's actually in effect

Ubuntu cloud images start `sshd_config` with `Include
/etc/ssh/sshd_config.d/*.conf`, and sshd uses **first value wins**. Lightsail's
cloud-init drops a file in that directory which already sets
`PasswordAuthentication no` — so editing that setting in the main file can have
no effect at all, which is baffling if you don't know to look.

Don't guess. Ask sshd:

```bash
sudo sshd -T | grep -E "permitrootlogin|passwordauthentication|pubkeyauthentication"
```

That resolves every include and prints what sshd will really do. You want:

```
permitrootlogin no
passwordauthentication no
pubkeyauthentication yes
```

### Test the config, then restart

```bash
sudo sshd -t
```

Silence means the file is valid. If it prints an error, fix it **before**
restarting — a broken config plus a restart is exactly how people lock
themselves out.

```bash
sudo systemctl restart ssh
```

> Now open a **second** terminal and confirm you can still log in, before
> closing this one. If you do break SSH with no session open, the Lightsail
> console's **Connect using SSH** button is your way back in — but it's much
> less stressful to just not break it.

### Firewall (on the server)

This is the second of the two firewalls. The Lightsail console one from Part 2
controls what reaches the machine; `ufw` controls what the machine itself
accepts. Belt and braces.

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status
```

**✅ Check:** you see `22/tcp`, `80/tcp` and `443/tcp` as `ALLOW`. PostgreSQL on
5432 is deliberately absent — it only ever accepts connections from the machine
itself.

### Automatic security updates

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

Choose **Yes**. Security patches now install themselves.

### Add swap

Emergency memory. With 4 GB you have real headroom, but a build that spikes
during a busy moment shouldn't be able to take the site down:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

**✅ Check:** the `Swap:` row shows `2.0Gi`.

> Lightsail instances don't come with swap configured, unlike some providers.
> Worth doing even on the 4 GB plan.

**You stay logged in as `ubuntu` for the rest of this guide.** Commands that
need to run as the app user are marked with `sudo -u ratecoaster`.

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
CREATE DATABASE ratecoaster;
CREATE USER ratecoaster WITH ENCRYPTED PASSWORD 'pick-a-long-random-password-here';
GRANT ALL PRIVILEGES ON DATABASE ratecoaster TO ratecoaster;
\c ratecoaster
GRANT ALL ON SCHEMA public TO ratecoaster;
\q
```

> Generate a password with `openssl rand -base64 24` and save it — you'll need
> it in Part 8. The `GRANT ALL ON SCHEMA` line is easy to miss and causes a
> "permission denied for schema public" error later if skipped.

**✅ Check:** test the login works:

```bash
psql "postgres://ratecoaster:YOUR_DB_PASSWORD@127.0.0.1:5432/ratecoaster" -c "SELECT 1;"
```

You should see a table with `1` in it.

---

## Part 7 — Get the code onto the server

### The easy way: GitHub

On **your own computer**, in the project folder:

```bash
cd C:\Users\Rui\ratecoaster
git init
git add .
git commit -m "First version"
```

Create an empty repository at [github.com/new](https://github.com/new) — make it
**private** — then follow its "push an existing repository" instructions.

> Check `.gitignore` contains `.env` before pushing. It does in this project, but
> confirm. Pushing secrets to GitHub is the single most common way people leak
> database passwords.

Then on **the server**, clone it as the app user so the files are owned
correctly from the start:

```bash
sudo -u ratecoaster -H git clone https://github.com/YOUR_USERNAME/ratecoaster.git /home/ratecoaster/app
```

For a private repo GitHub will ask for a username and a **personal access
token** (not your password) — create one at Settings → Developer settings →
Personal access tokens.

### The no-GitHub way

From **your own computer** (note the `-i` key, same as when you SSH in):

```bash
scp -i "C:\Users\Rui\.ssh\LightsailDefaultKey-us-east-1.pem" -r C:\Users\Rui\ratecoaster ubuntu@YOUR_STATIC_IP:/tmp/app
```

Then on the server, move it into place with the right ownership:

```bash
sudo mv /tmp/app /home/ratecoaster/app
sudo chown -R ratecoaster:ratecoaster /home/ratecoaster/app
```

Slower, and you'll repeat it for every update, but it works.

**✅ Check:** `ls /home/ratecoaster/app` shows `apps`, `packages`, `package.json`.

---

## Part 8 — Configuration

```bash
cd /home/ratecoaster/app
sudo -u ratecoaster cp deploy/env.production.example .env
sudo -u ratecoaster nano .env
```

The domains are already filled in. Work through the file and replace:

- `CHANGE_ME_DB_PASSWORD` → the database password from Part 6
- `CHANGE_ME_RESEND_KEY` → leave for now, you'll set it in Part 11
- the contact email in `COLLECTOR_USER_AGENT` → your real email

Save (Ctrl+O, Enter, Ctrl+X), then lock the file down so only you can read it:

```bash
sudo chmod 600 /home/ratecoaster/app/.env
sudo chown ratecoaster:ratecoaster /home/ratecoaster/app/.env
```

### The three address settings, explained

These trip up almost everyone:

| Setting | Value | Who uses it |
|---|---|---|
| `API_BASE_URL` | `http://127.0.0.1:8787` | The website, talking to the API inside the server |
| `PUBLIC_API_URL` | `https://ratecoaster.net/api` | Sign-in links in emails — must work from a phone |
| `NEXT_PUBLIC_API_BASE_URL` | `https://ratecoaster.net/api` | The browser, calling the API |

If sign-in emails contain a link to `127.0.0.1`, you set `PUBLIC_API_URL` wrong.

> **`NEXT_PUBLIC_` variables are baked into the website when you build it.**
> Changing one means running the build again — restarting isn't enough.

---

## Part 9 — Install, create tables, build

Everything in this part — and **only** this part — runs as the app user. Switch
to it now:

```bash
sudo -u ratecoaster -H bash
cd /home/ratecoaster/app
```

Your prompt changes to `ratecoaster@...`.

> While you're this user, `sudo` will not work — it asks for a password the
> account doesn't have. That's expected. Nothing in this part needs sudo, and
> you'll `exit` back to `ubuntu` at the end of it.

Now:

```bash
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
NODE_ENV=production npm run -w @ratecoaster/web build
```

> **This one must be `production`.** Building with `NODE_ENV=development` fails
> with a confusing error about `<Html> should not be imported outside of
> pages/_document`. That message has nothing to do with the real problem.

**✅ Check:** ends with a table of routes (`/`, `/hotels`, `/waits`…) and no
errors. Takes 1–3 minutes.

Now return to the `ubuntu` user for the next part:

```bash
exit
```

---

## Part 10 — Run it as a service

"Services" start automatically on boot and restart if they crash.

```bash
sudo cp /home/ratecoaster/app/deploy/ratecoaster-api.service /etc/systemd/system/
sudo cp /home/ratecoaster/app/deploy/ratecoaster-web.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ratecoaster-api ratecoaster-web
```

Check both are running:

```bash
systemctl status ratecoaster-api --no-pager
systemctl status ratecoaster-web --no-pager
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
journalctl -u ratecoaster-api -n 50 --no-pager
```

---

## Part 11 — Go live with HTTPS

```bash
sudo cp /home/ratecoaster/app/deploy/Caddyfile /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile
```

The domain on the first line is already `ratecoaster.net`, so there's usually
nothing to change here. Save and exit, then:

```bash
sudo systemctl reload caddy
```

**Now open `https://ratecoaster.net` in your browser.**

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
   sudo -u ratecoaster nano /home/ratecoaster/app/.env
   ```

   Set:

   ```
   RESEND_API_KEY=re_your_actual_key
   EMAIL_FROM=RateCoaster <hello@ratecoaster.net>
   ```

   Then restart the API:

   ```bash
   sudo systemctl restart ratecoaster-api
   ```

**✅ Check:** go to `https://ratecoaster.net/join`, enter your own email, and see if
the link arrives. Click it — you should land back on the site signed in, with
"Free account" in the header.

If nothing arrives: `journalctl -u ratecoaster-api -n 30 --no-pager` will print the
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
sudo -u ratecoaster mkdir -p /home/ratecoaster/logs
sudo crontab -u ratecoaster /home/ratecoaster/app/deploy/ratecoaster.cron
sudo crontab -u ratecoaster -l
```

**✅ Check:** the schedule prints back.

Run the wait-time collector once by hand to confirm:

```bash
sudo -u ratecoaster -H bash -c 'cd /home/ratecoaster/app && set -a && . ./.env && set +a && npm run collect -- --only wait-times'
```

**✅ Check:** it reports parsed counts per park. Then visit
`https://ratecoaster.net/waits` — real numbers.

Visit `https://ratecoaster.net/status` any time to see when each feed last ran.

---

## Part 14 — Backups

An unbacked-up database is a database you will eventually lose. On Lightsail you
want **both** kinds below — they fail differently.

### Automatic instance snapshots (whole-server)

This is your "the server died" recovery. In the Lightsail console: your instance
→ **Snapshots** tab → enable **Automatic snapshots** and pick a time in the
small hours.

Snapshots cost $0.05/GB-month and are incremental, so in practice expect a few
dollars a month rather than 80 GB worth. Lightsail keeps the most recent seven
automatic snapshots and rotates the rest away.

> Restoring a snapshot creates a **new instance** with a **new** IP. You'd
> re-attach your static IP to it, which takes seconds — another reason Part 2
> insisted on a static IP.

### Database dumps (fine-grained)

Snapshots restore everything or nothing. A database dump lets you recover just
the data after, say, a bad migration — without rolling back your code too.

```bash
sudo mkdir -p /var/backups/ratecoaster
sudo chown postgres:postgres /var/backups/ratecoaster
sudo cp /home/ratecoaster/app/deploy/backup.sh /usr/local/bin/ratecoaster-backup
sudo chmod +x /usr/local/bin/ratecoaster-backup
```

Run it nightly at 2am:

```bash
sudo crontab -e
```

Add this line at the bottom:

```
0 2 * * * sudo -u postgres /usr/local/bin/ratecoaster-backup >> /var/log/ratecoaster-backup.log 2>&1
```

Test it right now — a backup you've never tested isn't a backup:

```bash
sudo -u postgres /usr/local/bin/ratecoaster-backup
ls -lh /var/backups/ratecoaster
```

**✅ Check:** a `.dump` file exists and is more than a few kilobytes.

> **Copy these off the server.** A backup that only lives on the machine it's
> backing up doesn't survive that machine dying. Once a week, from your own
> computer:
> ```bash
> scp ratecoaster@YOUR_SERVER_IP:/var/backups/ratecoaster/*.dump ./backups/
> ```

To restore one:

```bash
sudo -u postgres pg_restore -d ratecoaster --clean /var/backups/ratecoaster/FILE.dump
```

---

## Part 15 — Updating the site later

Once your code is on GitHub, updating is one command:

```bash
/home/ratecoaster/app/deploy/update.sh
```

Run it as `ubuntu`, not as the app user. It does the git pull, install and
build as `ratecoaster`, then restarts the services as you — the app user has no
sudo on purpose, so it can't restart system services itself.

To make it executable the first time:

```bash
sudo chmod +x /home/ratecoaster/app/deploy/update.sh
```

---

## Troubleshooting

### The site doesn't load at all, but the server looks fine

Almost always the **Lightsail console firewall**. There are two firewalls and
people configure only `ufw`. Check the instance → **Networking** → **IPv4
Firewall** has rules for ports 80 and 443.

### "Permission denied" on `cd /home/ratecoaster/app`

Two different causes, so check both. First, are you in the group?

```bash
sudo usermod -aG ratecoaster ubuntu
newgrp ratecoaster
```

If that doesn't fix it, the directory itself is `0700` — owner only, group gets
nothing, regardless of your membership:

```bash
ls -ld /home/ratecoaster /home/ratecoaster/app
sudo chmod 750 /home/ratecoaster/app
```

While you're looking at that `ls`, check the link count in the second column. A
directory showing `2` has no subdirectories — it's empty, and your upload never
landed. "Permission denied" on an unreadable parent looks identical to a missing
directory, so it's worth ruling out before you chase permissions further.

### `sudo` asks for a password

You're logged in as `ratecoaster`, not `ubuntu`. That account has no password on
purpose. Type `exit`, confirm `whoami` says `ubuntu`, and try again. Never set a
password for `ratecoaster` to work around this.

### "UNPROTECTED PRIVATE KEY FILE" when connecting

Your `.pem` is readable by other accounts on your computer and SSH refuses it.
Re-run the `icacls` (Windows) or `chmod 400` (Mac/Linux) commands from Part 4.

### The site worked, then went dark after a restart

You pointed DNS at a **dynamic** IP instead of a static one. Attach a static IP
(Part 2), then update the A records at your registrar to match.

### Locked out of SSH

Use the Lightsail console's **Connect using SSH** button — it opens a browser
terminal that bypasses your key and SSH config entirely. Fix
`/etc/ssh/sshd_config` from there.

### The site shows "502 Bad Gateway"

Caddy is up but the website behind it isn't.

```bash
systemctl status ratecoaster-web --no-pager
journalctl -u ratecoaster-web -n 50 --no-pager
```

### "command not found" during install or build

`NODE_ENV=production` made npm skip the build tools. Re-run:

```bash
sudo -u ratecoaster -H bash -c 'cd /home/ratecoaster/app && NODE_ENV=development npm install --include=dev'
```

### Build fails: "`<Html>` should not be imported outside of `pages/_document`"

Misleading message. You built in development mode. Use:

```bash
NODE_ENV=production npm run -w @ratecoaster/web build
```

### Build gets "Killed" with no explanation

Out of memory. Confirm swap exists (`free -h`) and add more if needed, or resize
the server up for the duration of the build.

### "permission denied for schema public"

The `GRANT ALL ON SCHEMA public` line in Part 6 got skipped:

```bash
sudo -u postgres psql -d ratecoaster -c "GRANT ALL ON SCHEMA public TO ratecoaster;"
```

### Sign-in emails never arrive

1. `journalctl -u ratecoaster-api -n 30 --no-pager` — the real reason is logged.
2. Check the domain shows **Verified** in Resend.
3. Check `EMAIL_FROM` uses the domain you verified there.

### Sign-in link goes to a page that won't load

`PUBLIC_API_URL` is wrong in `.env`. It must be `https://yourdomain.com/api`, not
a `127.0.0.1` address.

### Signed in, but still only seeing 30 days

`NEXT_PUBLIC_API_BASE_URL` is baked in at build time. Fix it in `.env`, then
rebuild:

```bash
sudo -u ratecoaster -H bash -c 'cd /home/ratecoaster/app && NODE_ENV=production npm run -w @ratecoaster/web build'
sudo systemctl restart ratecoaster-web
```

### Useful commands

```bash
systemctl status ratecoaster-api ratecoaster-web caddy   # is it running?
journalctl -u ratecoaster-api -f                        # watch API logs live
sudo systemctl restart ratecoaster-api ratecoaster-web    # restart everything
df -h                                                 # disk space
free -h                                               # memory
htop                                                  # what's busy (apt install htop)
```

---

## What it costs

| Item | Cost |
|---|---|
| Lightsail 4 GB instance | $24/month |
| Static IP (attached) | Free |
| Automatic snapshots | ~$2–4/month |
| Domain | ~$12/year |
| Resend (email) | Free to 3,000/month |
| Wait-time APIs | Free |
| **Total** | **≈ $27–29/month** |

Your plan includes 4 TB of data transfer. Both inbound and outbound count toward
that allowance, but only **outbound** overage is billed, at $0.09/GB. A site of
this size will not come close — the collectors move a few hundred MB a month.

---

## A pre-launch checklist

Before you tell anyone about the site:

- [ ] A **static** IP is attached, and DNS points at it
- [ ] Ports 80 and 443 are open in the **Lightsail console** firewall, not just `ufw`
- [ ] Automatic snapshots are switched on
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
