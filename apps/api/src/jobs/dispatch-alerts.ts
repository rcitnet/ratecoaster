/**
 * Sends the rate-drop alerts the site has been promising.
 *
 *   npm run -w @ratecoaster/api alerts:dispatch            # decide, send nothing
 *   npm run -w @ratecoaster/api alerts:dispatch -- --send  # actually send
 *
 * Dry by default, deliberately. The first run of anything that emails real
 * people should print what it would do. Getting this wrong does not throw an
 * exception — it lands in someone's inbox.
 *
 * Runs after the hotel collector, since it can only act on prices that have
 * already been written.
 */
import { and, asc, eq, gte, inArray, lt, lte } from "drizzle-orm";
import { closeDb, getDb } from "@ratecoaster/db";
import { alertEvents, properties, rateCurrent, users, watches } from "@ratecoaster/db/schema";
import { RATE_CODE_LABELS } from "@ratecoaster/shared";
import { addDays } from "../collectors/framework/dates.js";
import { evaluateWatch, totalForStay } from "../lib/alerts.js";
import { emailConfigured, sendPriceDropEmail } from "../lib/email.js";

const SITE_URL = process.env.WEB_ORIGIN ?? "https://ratecoaster.net";

/** The nights of a stay: check-in inclusive, check-out exclusive. */
function nightsBetween(checkIn: string, checkOut: string): string[] {
  const out: string[] = [];
  let cursor = checkIn;
  // Bounded so a corrupt row cannot spin forever.
  for (let i = 0; i < 60 && cursor < checkOut; i++) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return out;
}

async function main() {
  const send = process.argv.includes("--send");
  const db = getDb();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  if (send && !emailConfigured()) {
    console.error("Email is not configured — refusing to run with --send.");
    console.error("Set RESEND_API_KEY and EMAIL_FROM, then try again.");
    await closeDb();
    process.exit(1);
  }

  /*
   * Only watches whose stay has not already started. Alerting someone about a
   * price drop for a trip that began yesterday is noise at best and a painful
   * reminder at worst.
   */
  const rows = await db
    .select({
      id: watches.id,
      userId: watches.userId,
      email: users.email,
      propertyId: watches.propertyId,
      propertySlug: properties.slug,
      propertyName: properties.name,
      rateCode: watches.rateCode,
      checkIn: watches.checkIn,
      checkOut: watches.checkOut,
      adults: watches.adults,
      children: watches.children,
      thresholdCents: watches.thresholdCents,
      bookedNightlyCents: watches.bookedNightlyCents,
      channels: watches.channels,
      lastNotifiedAt: watches.lastNotifiedAt,
      lastNotifiedCents: watches.lastNotifiedCents,
    })
    .from(watches)
    .innerJoin(users, eq(users.id, watches.userId))
    .leftJoin(properties, eq(properties.id, watches.propertyId))
    .where(and(eq(watches.active, true), gte(watches.checkIn, today)))
    .orderBy(asc(watches.checkIn));

  if (rows.length === 0) {
    console.log("No active watches.");
    await closeDb();
    return;
  }

  console.log(`${rows.length} active watch${rows.length === 1 ? "" : "es"}${send ? "" : " (dry run)"}\n`);

  let sent = 0;
  let skipped = 0;

  for (const w of rows) {
    const label = `${w.propertyName ?? "(any hotel)"} ${w.checkIn}→${w.checkOut}`;

    if (!w.propertyId) {
      // Destination-wide watches need a different query shape; not built yet,
      // and quietly skipping is better than silently mis-pricing them.
      console.log(`  skip  ${label} — destination-wide watches aren't supported yet`);
      skipped++;
      continue;
    }

    const nights = nightsBetween(w.checkIn, w.checkOut);

    const priceRows = await db
      .select({ stayDate: rateCurrent.stayDate, nightlyCents: rateCurrent.nightlyCents })
      .from(rateCurrent)
      .where(
        and(
          eq(rateCurrent.propertyId, w.propertyId),
          eq(rateCurrent.rateCode, w.rateCode),
          eq(rateCurrent.nights, 1),
          eq(rateCurrent.adults, w.adults),
          eq(rateCurrent.children, w.children),
          eq(rateCurrent.available, true),
          gte(rateCurrent.stayDate, w.checkIn),
          lt(rateCurrent.stayDate, w.checkOut)
        )
      )
      .orderBy(asc(rateCurrent.nightlyCents));

    // Cheapest room type per night — rows arrive price-ascending.
    const cheapestByNight = new Map<string, number>();
    for (const row of priceRows) {
      if (!cheapestByNight.has(row.stayDate)) {
        cheapestByNight.set(row.stayDate, row.nightlyCents);
      }
    }

    const total = totalForStay(cheapestByNight, nights);
    const decision = evaluateWatch(
      {
        thresholdCents: w.thresholdCents,
        bookedNightlyCents: w.bookedNightlyCents,
        lastNotifiedCents: w.lastNotifiedCents,
        lastNotifiedAt: w.lastNotifiedAt,
      },
      total,
      now
    );

    if (!decision.notify) {
      console.log(`  skip  ${label} — ${decision.reason}`);
      skipped++;
      continue;
    }

    const money = (c: number | null) => (c === null ? "—" : `$${(c / 100).toFixed(2)}`);
    console.log(
      `  SEND  ${label} — ${money(w.lastNotifiedCents)} → ${money(total)} (${decision.reason})`
    );

    if (!send) continue;

    if (!w.email) {
      console.log("        no email on the account, skipping");
      skipped++;
      continue;
    }

    const url = `${SITE_URL}/hotels/${w.propertySlug}?rateCode=${w.rateCode}&stayDate=${w.checkIn}`;
    const result = await sendPriceDropEmail({
      to: w.email,
      hotelName: w.propertyName ?? "Your watched hotel",
      checkIn: w.checkIn,
      checkOut: w.checkOut,
      currentCents: total!,
      previousCents: w.lastNotifiedCents,
      rateLabel: RATE_CODE_LABELS[w.rateCode] ?? w.rateCode,
      url,
    });

    if (!result.sent) {
      /*
       * A failed send must NOT advance lastNotifiedCents. Otherwise the watch
       * believes it has already told the user about this price, and the alert
       * they actually wanted is suppressed forever by a transient outage.
       */
      console.error(`        send failed: ${result.reason}`);
      continue;
    }

    await db.insert(alertEvents).values({
      watchId: w.id,
      kind: decision.kind!,
      previousCents: w.lastNotifiedCents,
      currentCents: total!,
      message: decision.reason,
    });

    await db
      .update(watches)
      .set({ lastNotifiedAt: now, lastNotifiedCents: total })
      .where(eq(watches.id, w.id));

    sent++;
  }

  console.log(
    send
      ? `\nSent ${sent}, skipped ${skipped}.`
      : `\nWould send ${rows.length - skipped}, skip ${skipped}. Re-run with --send.`
  );

  await closeDb();
}

main().catch(async (err) => {
  console.error(err);
  await closeDb();
  process.exit(1);
});
