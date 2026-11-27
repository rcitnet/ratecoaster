# AWS security maintenance — October 21, 2026

The security-20261021-01 release is deployed on the existing Lightsail VPS.

MagicMeter: build for AWS using `npm run build:aws`; the ordinary `npm run build` retains Sites/Cloudflare output. The updated framework's native Node.js server must receive the AWS build. Runtime React/React DOM/React Server DOM Webpack are 19.3.1, Vinext is 1.3.0, and sharp is 0.35.5. The remaining braces CVE-2026-93687 has no published patched version; its six production audit entries are inherited through the framework's build-tool chain. Do not force an obsolete Vinext/shadcn downgrade to silence the scanner.

RateCoaster: Next.js 15.5.28, sharp 0.35.5 and the PostCSS override 8.5.26 are required. The deployed production dependency audit is clean. The local website/API lockfile graph was independently checked; the separate mobile workspace was preserved and is not deployed on the VPS.

Shared server: Node.js 22.23.4, Caddy 2.11.7, running kernel 7.0.0-1014-aws. Configuration/package rollback backups are in /var/backups/website-security-20261021. Previous application releases remain available. The maintenance did not publish changes to Sites hosting or send any social posts.

Full completion report: C:/Users/Rui/Documents/Codex/2026-10-21/do/outputs/AWS-security-update-results-2026-10-21.md
