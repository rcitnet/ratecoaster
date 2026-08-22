/**
 * Attaches Undercover Tourist destinations to tracked ticket products.
 *
 *   npm run -w @ratecoaster/api affiliate:seed            # show what it would do
 *   npm run -w @ratecoaster/api affiliate:seed -- --apply # write it
 *
 * Why a job rather than a migration: these URLs are operational data that will
 * drift as the merchant reorganises its catalogue, and they should be editable
 * without a deploy. This exists to get from zero to something, once.
 *
 * Note what is deliberately NOT here: the "Save $53 on Universal 2-Day
 * Park-to-Park" creatives from the CJ catalogue. Those amounts were last
 * updated in April 2023, and a site whose entire premise is not showing people
 * stale prices cannot go around quoting three-year-old discounts. The generic
 * product pages also earn several times more per click, so nothing is lost.
 */
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "@ratecoaster/db";
import { ticketProducts } from "@ratecoaster/db/schema";
import { buildAffiliateLink, UNDERCOVER_TOURIST } from "@ratecoaster/shared";

const MERCHANT = UNDERCOVER_TOURIST.merchant;

/**
 * Per-product destinations. Keys must match `ticket_products.slug`.
 *
 * Empty on purpose. It previously held eight paths invented from a naming
 * pattern — `.../universal-orlando-resort/3-day-park-to-park/` and similar —
 * none of which were ever opened. That is not a shortcut worth taking: the
 * merchant returns 200 with a friendly "not found" page, so a wrong path looks
 * indistinguishable from a working link right up until a visitor clicks it.
 *
 * To add one: open the product page on undercovertourist.com, copy the address
 * bar, paste it here. Anything absent falls back to the verified landing page
 * below, which is a worse click-through but an honest one.
 */
const DESTINATIONS: Record<string, string> = {};

/**
 * The catch-all. Products with no specific page still get a tracked link to the
 * merchant's Universal landing page rather than no Book button at all.
 */
const FALLBACK_BY_DESTINATION: Record<string, string> = {
  // Both fetched and confirmed to return real pages.
  "universal-orlando": "https://www.undercovertourist.com/orlando/universal-orlando-resort/",
  "universal-hollywood":
    "https://www.undercovertourist.com/los-angeles/universal-studios-hollywood/",
  // Frisco deliberately absent: the merchant carries no inventory there.
};

async function main() {
  const apply = process.argv.includes("--apply");
  const db = getDb();

  const products = await db
    .select({
      id: ticketProducts.id,
      slug: ticketProducts.slug,
      name: ticketProducts.name,
      destination: ticketProducts.destination,
      kind: ticketProducts.kind,
      existing: ticketProducts.affiliateUrl,
    })
    .from(ticketProducts)
    .where(eq(ticketProducts.active, true));

  if (products.length === 0) {
    console.log("No ticket products found. Run the seed first.");
    await closeDb();
    return;
  }

  let planned = 0;

  for (const p of products) {
    /*
     * Express Pass is sold only by Universal. Pointing a Book button at a
     * merchant that does not carry it would send a family to a dead end and
     * spend the trust the rest of the site is trying to build.
     */
    if (p.kind === "express-pass") continue;

    const url = DESTINATIONS[p.slug] ?? FALLBACK_BY_DESTINATION[p.destination];
    if (!url) continue;

    // Validate through the same allowlist the request path uses, so a typo is
    // caught here rather than becoming a 500 in front of a visitor.
    try {
      buildAffiliateLink({ merchant: MERCHANT, destinationUrl: url, sid: `ticket_${p.slug}` });
    } catch (err) {
      console.error(`  SKIP ${p.slug}: ${String(err)}`);
      continue;
    }

    const specific = Boolean(DESTINATIONS[p.slug]);
    console.log(
      `  ${p.existing ? "update" : "  set "}  ${p.slug.padEnd(28)} ${specific ? "" : "(fallback) "}${url}`
    );
    planned++;

    if (apply) {
      await db
        .update(ticketProducts)
        .set({ affiliateUrl: url, affiliateMerchant: MERCHANT })
        .where(eq(ticketProducts.id, p.id));
    }
  }

  console.log(
    apply
      ? `\nWrote ${planned} link${planned === 1 ? "" : "s"}.`
      : `\n${planned} link${planned === 1 ? "" : "s"} would be written. Re-run with --apply.`
  );

  if (!apply) {
    console.log(
      "\nBefore applying, confirm deep linking is switched on for this advertiser:\n" +
        "open one of the URLs above wrapped in the tracking link and check you land on\n" +
        "that page rather than the merchant's homepage. See AFFILIATE-LINKS.md."
    );
  }

  await closeDb();
}

main().catch(async (err) => {
  console.error(err);
  await closeDb();
  process.exit(1);
});
