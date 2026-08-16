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

  const tier = revoke ? "free" : "admin";
  let userId: string;
  let previousTier: string;

  if (existing) {
    userId = existing.id;
    previousTier = existing.tier;
    await db.update(users).set({ tier }).where(eq(users.id, existing.id));
  } else {
    if (revoke) {
      console.error(`No account for ${email} — nothing to revoke.`);
      process.exit(1);
    }
    /*
     * Create the account outright.
     *
     * Requiring a prior sign-in made the first admin depend on working email,
     * which is precisely the thing most likely to be broken on day one. Anyone
     * running this already has shell access on the server, so there is nothing
     * gained by making them jump through the inbox first.
     */
    const [created] = await db
      .insert(users)
      .values({ email, tier: "admin", emailVerifiedAt: new Date() })
      .returning({ id: users.id });
    userId = created!.id;
    previousTier = "(new account)";
    console.log(`Created account for ${email}.`);
  }

  await db.insert(adminAudit).values({
    userId,
    email,
    action: revoke ? "admin.revoke" : "admin.grant",
    target: email,
    detail: { from: previousTier, to: tier, via: "cli" },
  });

  console.log(`${email}: ${previousTier} -> ${tier}`);
  if (!revoke) {
    console.log(
      "\nNow get a sign-in link without needing email:\n" +
        `  npm run -w @ratecoaster/api login:link -- ${email}`
    );
  }

  await closeDb();
}

main().catch(async (err) => {
  console.error(err);
  await closeDb();
  process.exit(1);
});
