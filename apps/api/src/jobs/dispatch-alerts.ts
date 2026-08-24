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
import { and, asc, eq, gte, inArray, isNull, lt, or } from "drizzle-orm";
import { closeDb, getDb } from "@ratecoaster/db";
import {
  alertEvents,
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
const DESTINATION_TIMEZONES: Record<string, string> = {
  "universal-orlando": "America/New_York",
  "universal-hollywood": "America/Los_Angeles",
  "universal-kids-frisco": "America/Chicago",
};

function localDate(now: Date, destination: string | null): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DESTINATION_TIMEZONES[destination ?? "universal-orlando"] ?? "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

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
    if (!w.ticketProductId) return null;
    const rows = await db
      .select({
        priceCents: ticketPriceCurrent.priceCents,
        totalCents: ticketPriceCurrent.totalCents,
      })
      .from(ticketPriceCurrent)
      .where(
        and(
          eq(ticketPriceCurrent.productId, w.ticketProductId),
          eq(ticketPriceCurrent.validDate, w.checkIn),
          eq(ticketPriceCurrent.guestCategory, "all-ages"),
          eq(ticketPriceCurrent.available, true)
        )
      )
      .limit(1);

    const each = rows[0] ? (rows[0].totalCents ?? rows[0].priceCents) : undefined;
    if (each === undefined) return null;
    // Express is per person and there is no child rate.
    return each * (w.adults + w.children);
  }

  if (!w.ticketProductId) return null;

  const rows = await db
    .select({
      guestCategory: ticketPriceCurrent.guestCategory,
      priceCents: ticketPriceCurrent.priceCents,
      totalCents: ticketPriceCurrent.totalCents,
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
      .reduce<number | null>((min, r) => {
        const price = r.totalCents ?? r.priceCents;
        return min === null || price < min ? price : min;
      }, null);

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

/** Claim a watch briefly so overlapping cron/manual runs cannot both email it. */
async function claimWatch(db: ReturnType<typeof getDb>, id: string, now: Date): Promise<boolean> {
  const staleClaim = new Date(now.getTime() - 30 * 60_000);
  const claimed = await db
    .update(watches)
    .set({ dispatchClaimedAt: now })
    .where(
      and(
        eq(watches.id, id),
        or(isNull(watches.dispatchClaimedAt), lt(watches.dispatchClaimedAt, staleClaim))
      )
    )
    .returning({ id: watches.id });
  return claimed.length === 1;
}

async function releaseClaim(db: ReturnType<typeof getDb>, id: string): Promise<void> {
  await db.update(watches).set({ dispatchClaimedAt: null }).where(eq(watches.id, id));
}

async function main() {
  const send = process.argv.includes("--send");
  const db = getDb();
  const now = new Date();

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
      propertyDestination: properties.destination,
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
      baselineAt: watches.baselineAt,
      baselineCents: watches.baselineCents,
    })
    .from(watches)
    .innerJoin(users, eq(users.id, watches.userId))
    .leftJoin(properties, eq(properties.id, watches.propertyId))
    .leftJoin(ticketProducts, eq(ticketProducts.id, watches.ticketProductId))
    .where(eq(watches.active, true))
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
    const destination = w.destination ?? w.propertyDestination;
    if (w.checkIn < localDate(now, destination)) {
      if (send) {
        await db.update(watches).set({ active: false }).where(eq(watches.id, w.id));
      }
      skipped++;
      continue;
    }
    const label = `${w.propertyName ?? w.ticketProductName ?? "(any hotel)"} ${w.checkIn}→${w.checkOut}`;

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
          baselineCents: w.baselineCents,
        },
        total,
        now
      );

      const money = (c: number | null) => (c === null ? "—" : `$${(c / 100).toFixed(2)}`);
      if (!decision.notify) {
        console.log(`  skip  ${label} — ${decision.reason}`);
        if (send && total !== null && w.baselineCents === null && w.lastNotifiedCents === null) {
          await db
            .update(watches)
            .set({ baselineCents: total, baselineAt: now })
            .where(eq(watches.id, w.id));
        }
        skipped++;
        continue;
      }
      const previous = w.lastNotifiedCents ?? w.baselineCents;
      console.log(
        `  SEND  ${label} — ${money(previous)} → ${money(total)} (${decision.reason})`
      );
      if (!send) continue;
      if (!w.channels.includes("email")) {
        console.log("        email channel is not enabled, skipping");
        skipped++;
        continue;
      }
      if (!w.email) {
        console.log("        no email on the account, skipping");
        skipped++;
        continue;
      }
      if (!(await claimWatch(db, w.id, now))) {
        console.log("        already claimed by another dispatcher, skipping");
        skipped++;
        continue;
      }

      const url =
        w.kind === "ticket"
          ? `${SITE_URL}/tickets?destination=${destination ?? "universal-orlando"}`
          : `${SITE_URL}/express-pass?destination=${destination ?? "universal-orlando"}`;

      const result = await sendPriceDropEmail({
        to: w.email,
        hotelName:
          w.kind === "ticket"
            ? (w.ticketProductName ?? "Your watched ticket")
            : "Universal Express Pass",
        checkIn: w.checkIn,
        checkOut: w.checkIn,
        currentCents: total!,
        previousCents: previous,
        rateLabel: w.kind === "ticket" ? "Admission" : "Express Pass",
        url,
      });

      if (!result.sent) {
        console.error(`        send failed: ${result.reason}`);
        await releaseClaim(db, w.id);
        continue;
      }

      await db.transaction(async (tx) => {
        await tx.insert(alertEvents).values({
          watchId: w.id,
          kind: decision.kind!,
          previousCents: previous,
          currentCents: total!,
          message: decision.reason,
        });
        await tx
          .update(watches)
          .set({
            lastNotifiedAt: now,
            lastNotifiedCents: total,
            baselineAt: now,
            baselineCents: total,
            dispatchClaimedAt: null,
          })
          .where(eq(watches.id, w.id));
      });
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
                eq(properties.destination, destination ?? "universal-orlando")
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
        // Hotel targets are entered as nightly figures; comparisons are made
        // against a whole-stay total, so normalize the units exactly once.
        thresholdCents: w.thresholdCents === null ? null : w.thresholdCents * nights.length,
        bookedNightlyCents:
          w.bookedNightlyCents === null ? null : w.bookedNightlyCents * nights.length,
        lastNotifiedCents: w.lastNotifiedCents,
        lastNotifiedAt: w.lastNotifiedAt,
        baselineCents: w.baselineCents,
      },
      total,
      now
    );

    if (!decision.notify) {
      console.log(`  skip  ${label} — ${decision.reason}`);
      if (send && total !== null && w.baselineCents === null && w.lastNotifiedCents === null) {
        await db
          .update(watches)
          .set({ baselineCents: total, baselineAt: now })
          .where(eq(watches.id, w.id));
      }
      skipped++;
      continue;
    }

    const money = (c: number | null) => (c === null ? "—" : `$${(c / 100).toFixed(2)}`);
    const previous = w.lastNotifiedCents ?? w.baselineCents;
    console.log(
      `  SEND  ${label} — ${money(previous)} → ${money(total)} (${decision.reason})`
    );

    if (!send) continue;

    if (!w.channels.includes("email")) {
      console.log("        email channel is not enabled, skipping");
      skipped++;
      continue;
    }
    if (!w.email) {
      console.log("        no email on the account, skipping");
      skipped++;
      continue;
    }
    if (!(await claimWatch(db, w.id, now))) {
      console.log("        already claimed by another dispatcher, skipping");
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
      : `${SITE_URL}/hotels?destination=${destination ?? "universal-orlando"}&rateCode=${w.rateCode}`;

    const result = await sendPriceDropEmail({
      to: w.email,
      hotelName:
        w.propertyName ??
        DESTINATION_LABELS[destination ?? "universal-orlando"] ??
        "Your watched hotels",
      checkIn: w.checkIn,
      checkOut: w.checkOut,
      currentCents: total!,
      previousCents: previous,
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
      await releaseClaim(db, w.id);
      continue;
    }

    await db.transaction(async (tx) => {
      await tx.insert(alertEvents).values({
        watchId: w.id,
        kind: decision.kind!,
        previousCents: previous,
        currentCents: total!,
        message: decision.reason,
      });
      await tx
        .update(watches)
        .set({
          lastNotifiedAt: now,
          lastNotifiedCents: total,
          baselineAt: now,
          baselineCents: total,
          dispatchClaimedAt: null,
        })
        .where(eq(watches.id, w.id));
    });

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
