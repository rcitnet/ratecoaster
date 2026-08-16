/**
 * Mints a sign-in link and prints it, without sending any email.
 *
 *   npm run -w @ratecoaster/api login:link -- you@example.com
 *
 * This exists because email delivery is the one dependency that can be broken
 * on launch day while everything else works — an unverified domain, a bad key,
 * a provider outage. Without this you'd be locked out of your own site by a DNS
 * record.
 *
 * Safe because it's server-side only: anyone who can run it already has shell
 * access, at which point they can do far worse than read a link. It is
 * deliberately NOT exposed over HTTP.
 */
import { closeDb, getDb } from "@ratecoaster/db";
import { users } from "@ratecoaster/db/schema";
import { createMagicLink } from "../lib/auth.js";

const PUBLIC_API_URL =
  process.env.PUBLIC_API_URL ?? process.env.API_BASE_URL ?? "http://localhost:8787";

async function main() {
  const email = process.argv.slice(2).find((a) => !a.startsWith("--"))?.trim().toLowerCase();
  if (!email) {
    console.error("usage: login:link -- <email>");
    process.exit(1);
  }

  const { token, expiresInMinutes } = await createMagicLink(email, "/");
  const link = `${PUBLIC_API_URL}/v1/auth/verify?token=${encodeURIComponent(token)}`;

  const db = getDb();
  const existing = await db.select({ id: users.id }).from(users).limit(1);

  console.log(`\nSign-in link for ${email} — valid ${expiresInMinutes} minutes, single use:\n`);
  console.log(`  ${link}\n`);
  console.log("Paste it into your browser. The account is created when you open it.");
  if (existing.length === 0) {
    console.log("\nThis appears to be the first account on this install.");
  }

  await closeDb();
}

main().catch(async (err) => {
  console.error(err);
  await closeDb();
  process.exit(1);
});
