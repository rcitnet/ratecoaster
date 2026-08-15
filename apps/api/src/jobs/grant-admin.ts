/**
 * Grants (or revokes) admin on an account.
 *
 *   npm run -w @ratecoaster/api admin:grant -- you@example.com
 *   npm run -w @ratecoaster/api admin:grant -- you@example.com --revoke
 *
 * Deliberately a command-line tool rather than a button. The first admin has to
 * come from somewhere, and "anyone who can reach the server" is a far better
 * answer than a self-service upgrade path on a public web form.
 */
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "@ratecoaster/db";
import { adminAudit, users } from "@ratecoaster/db/schema";

async function main() {
  const args = process.argv.slice(2);
  const email = args.find((a) => !a.startsWith("--"))?.trim().toLowerCase();
  const revoke = args.includes("--revoke");

  if (!email) {
    console.error("usage: admin:grant -- <email> [--revoke]");
    console.error("\nThe account must already exist — sign in once first.");
    process.exit(1);
  }

  const db = getDb();
  const [existing] = await db
    .select({ id: users.id, tier: users.tier })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!existing) {
    console.error(`No account for ${email}.`);
    console.error("Sign in at /join first so the account exists, then re-run this.");
    process.exit(1);
  }

  const tier = revoke ? "free" : "admin";
  await db.update(users).set({ tier }).where(eq(users.id, existing.id));

  await db.insert(adminAudit).values({
    userId: existing.id,
    email,
    action: revoke ? "admin.revoke" : "admin.grant",
    target: email,
    detail: { from: existing.tier, to: tier, via: "cli" },
  });

  console.log(`${email}: ${existing.tier} -> ${tier}`);
  if (!revoke) {
    console.log("\nSign out and back in for the change to take effect in your session.");
  }

  await closeDb();
}

main().catch(async (err) => {
  console.error(err);
  await closeDb();
  process.exit(1);
});
