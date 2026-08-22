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
import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";
import { closeDb, getDb } from "@ratecoaster/db";
import {
  alertEvents,
  expressPassPrices,
  properties,
  rateCurrent,
  ticketPriceCurrent,
  ticketProducts,
  users,
  watches,
} from "@ratecoaster/db/schema";
import { RATE_CODE_LABELS } from "@ratecoaster/shared";
import { addDays } from "../collectors/framework/dates.js";
import { evaluateWatch, totalForStay } from "../lib/alerts.js";
import { emailConfigured, sendPriceDropEmail } from "../lib/email.js";

const SITE_URL = process.env.WEB_ORIGIN ?? "https://ratecoaster.net";

/** What to call a destination-wide watch in a subject line. */
const DESTINATION_LABELS: Record<string, string> = {
  "universal-orlando": "Universal Orlando hotels",
  "universal-hollywood": "Universal Hollywood hotels",
  "universal-kids-frisco": "Universal Kids Resort hotels",
};

/**
 * What a ticket or Express Pass watch costs today, for the whole party.
 *
 * Returns null rather than a partial figure when a price is missing, matching
 * the rule everywhere else: an alert built on an incomplete number is worse
 * than no alert.
 */
async function priceAdmissionWatch(
  db: ReturnType<typeof getDb>,
  w: {
    kind: string;
    ticketProductId: string | null;
    destination: string | null;
    checkIn: string;
    adults: number;
    children: number;
  }
): Promise<number | null> {
  if (w.kind === "express") {
    const rows = await db
      .select({ priceCents: expressPassPrices.priceCents })
      .from(expressPassPrices)
      .where(
        and(
          eq(expressPassPrices.destination, (w.destination ?? "universal-orlando") as "universal-orlando"),
          eq(expressPassPrices.validDate, w.checkIn),
          eq(expressPassPrices.available, true)
        )
      )
      .orderBy(asc(expressPassPrices.priceCents))
      .limit(1);

    const each = rows[0]?.priceCents;
    if (each === undefined) return null;
    // Express is per person and there is no child rate.
    return each * (w.adults + w.children);
  }

  if (!w.ticketProductId) return null;

  const rows = await db
    .select({
      guestCategory: ticketPriceCurrent.guestCategory,
      priceCents: ticketPriceCurrent.priceCents,
    })
    .from(ticketPriceCurrent)
    .where(
      and(
        eq(ticketPriceCurrent.productId, w.ticketProductId),
        eq(ticketPriceCurrent.validDate, w.checkIn),
        eq(ticketPriceCurrent.available, true)
      )
    );

  const cheapest = (category: string) =>
    rows
      .filter((r) => r.guestCategory === category)
      .reduce<number | null>((min, r) => (min === null || r.priceCents < min ? r.priceCents : min), null);

  const adult = cheapest("adult") ?? cheapest("all-ages");
  if (adult === null) return null;
  // Where no child price is published, the adult one is used. Overstating a
  // child ticket is the safe direction to be wrong.
  const child = cheapest("child") ?? adult;

  return adult * w.adults + child * w.children;
}

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
      kind: watches.kind,
      propertyId: watches.propertyId,
      ticketProductId: watches.ticketProductId,
      ticketProductName: ticketProducts.name,
      propertySlug: properties.slug,
      propertyName: properties.name,
      destination: watches.destination,
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
    .leftJoin(ticketProducts, eq(ticketProducts.id, watches.ticketProductId))
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

    /*
     * Ticket and Express watches price a single park date rather than a stay,
     * so they take an entirely different query and short-circuit here.
     */
    if (w.kind === "ticket" || w.kind === "express") {
      const total = await priceAdmissionWatch(db, w);
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

      const money = (c: number | null) => (c === null ? "—" : `$${(c / 100).toFixed(2)}`);
      if (!decision.notify) {
        console.log(`  skip  ${label} — ${decision.reason}`);
        skipped++;
        continue;
      }
      console.log(
        `  SEND  ${label} — ${money(w.lastNotifiedCents)} → ${money(total)} (${decision.reason})`
      );
      if (!send) continue;
      if (!w.email) {
        console.log("        no email on the account, skipping");
        skipped++;
        continue;
      }

      const url =
        w.kind === "ticket"
          ? `${SITE_URL}/tickets?destination=${w.destination ?? "universal-orlando"}`
          : `${SITE_URL}/express-pass?destination=${w.destination ?? "universal-orlando"}`;

      const result = await sendPriceDropEmail({
        to: w.email,
        hotelName:
          w.kind === "ticket"
            ? (w.ticketProductName ?? "Your watched ticket")
            : "Universal Express Pass",
        checkIn: w.checkIn,
        checkOut: w.checkIn,
        currentCents: total!,
        previousCents: w.lastNotifiedCents,
        rateLabel: w.kind === "ticket" ? "Admission" : "Express Pass",
        url,
      });

      if (!result.sent) {
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
      continue;
    }

    const nights = nightsBetween(w.checkIn, w.checkOut);

    /*
     * A watch names either one hotel or a whole destination. The destination
     * case is what someone sets when they want "anywhere on-site, cheapest" —
     * which is most families — so skipping it silently, as this did, left the
     * most common intent unserved.
     */
    const scope = w.propertyId
      ? eq(rateCurrent.propertyId, w.propertyId)
      : inArray(
          rateCurrent.propertyId,
          db
            .select({ id: properties.id })
            .from(properties)
            .where(
              and(
                eq(properties.active, true),
                eq(properties.destination, w.destination ?? "universal-orlando")
              )
            )
        );

    const priceRows = await db
      .select({
        stayDate: rateCurrent.stayDate,
        nightlyCents: rateCurrent.nightlyCents,
        propertyId: rateCurrent.propertyId,
      })
      .from(rateCurrent)
      .where(
        and(
          scope,
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

    /*
     * Group by property first, then total each stay separately, and take the
     * cheapest property that can cover every night.
     *
     * Taking the cheapest room per night across all hotels would produce a
     * total nobody can actually book — it would quietly assume the family
     * changes hotel every morning. Same rule as the trip planner.
     */
    const byProperty = new Map<string, Map<string, number>>();
    for (const row of priceRows) {
      let nightly = byProperty.get(row.propertyId);
      if (!nightly) {
        nightly = new Map();
        byProperty.set(row.propertyId, nightly);
      }
      // Rows arrive price-ascending, so the first sighting of a date is the
      // cheapest room type for that night at that hotel.
      if (!nightly.has(row.stayDate)) nightly.set(row.stayDate, row.nightlyCents);
    }

    let total: number | null = null;
    for (const nightly of byProperty.values()) {
      const stay = totalForStay(nightly, nights);
      if (stay !== null && (total === null || stay < total)) total = stay;
    }
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

    /*
     * A destination-wide watch has no single hotel to link to, so it goes to
     * the grid filtered to that destination. Linking to /hotels/null was the
     * obvious bug waiting in the previous version of this line.
     */
    const url = w.propertySlug
      ? `${SITE_URL}/hotels/${w.propertySlug}?rateCode=${w.rateCode}&stayDate=${w.checkIn}`
      : `${SITE_URL}/hotels?destination=${w.destination ?? "universal-orlando"}&rateCode=${w.rateCode}`;

    const result = await sendPriceDropEmail({
      to: w.email,
      hotelName:
        w.propertyName ??
        DESTINATION_LABELS[w.destination ?? "universal-orlando"] ??
        "Your watched hotels",
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
