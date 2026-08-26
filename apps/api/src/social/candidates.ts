import { and, asc, desc, eq, gt, gte } from "drizzle-orm";
import type { Db } from "@ratecoaster/db";
import {
  attractions,
  collectorRuns,
  parkHours,
  parks,
  properties,
  rateCurrent,
  waitCurrent,
} from "@ratecoaster/db/schema";
import { buildHotelDealPost, buildWaitPost, type SocialCandidate } from "./content.js";

const SITE_URL = (process.env.WEB_ORIGIN ?? "https://www.ratecoaster.net").replace(/\/$/, "");
const DEAL_TIERS = ["premier", "preferred", "prime-value", "value"] as const;
const TIER_LABELS: Record<(typeof DEAL_TIERS)[number], string> = {
  premier: "Premier",
  preferred: "Preferred",
  "prime-value": "Prime Value",
  value: "Value",
};

function zonedParts(now: Date, timezone: string): { date: string; hour: number; hourKey: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  const date = `${value("year")}-${value("month")}-${value("day")}`;
  const hour = Number(value("hour"));
  return { date, hour, hourKey: `${date}T${String(hour).padStart(2, "0")}` };
}

async function waitCandidate(db: Db, now: Date): Promise<SocialCandidate | null> {
  const [latestRun] = await db
    .select({ notes: collectorRuns.notes })
    .from(collectorRuns)
    .where(eq(collectorRuns.collector, "wait-times"))
    .orderBy(desc(collectorRuns.startedAt))
    .limit(1);
  const providerNotes = latestRun?.notes ?? {};
  const parkRows = await db
    .select({ id: parks.id, slug: parks.slug, name: parks.name, timezone: parks.timezone })
    .from(parks)
    .where(eq(parks.active, true))
    .orderBy(asc(parks.name));
  const cutoff = new Date(now.getTime() - 15 * 60_000);
  const eligible: Array<{
    park: (typeof parkRows)[number];
    hourKey: string;
    dataSource: string;
    waits: Array<{ name: string; minutes: number; observedAt: Date }>;
  }> = [];

  for (const park of parkRows) {
    const local = zonedParts(now, park.timezone);
    // Do not publish overnight, even if an upstream feed has stale OPERATING
    // rows. Published park hours are the authority for whether a guest can ride.
    const [hours] = await db
      .select({ opensAt: parkHours.opensAt, closesAt: parkHours.closesAt })
      .from(parkHours)
      .where(
        and(
          eq(parkHours.parkId, park.id),
          eq(parkHours.date, local.date),
          eq(parkHours.kind, "OPERATING")
        )
      )
      .limit(1);
    if (!hours?.opensAt || !hours.closesAt || now < hours.opensAt || now >= hours.closesAt) continue;

    const waits = await db
      .select({
        name: attractions.name,
        minutes: waitCurrent.waitMinutes,
        observedAt: waitCurrent.observedAt,
      })
      .from(waitCurrent)
      .innerJoin(attractions, eq(attractions.id, waitCurrent.attractionId))
      .where(
        and(
          eq(attractions.parkId, park.id),
          eq(attractions.active, true),
          eq(attractions.kind, "ride"),
          eq(waitCurrent.status, "operating"),
          gte(waitCurrent.observedAt, cutoff)
        )
      )
      .orderBy(asc(waitCurrent.waitMinutes));
    const complete = waits
      .filter((row): row is typeof row & { minutes: number } => row.minutes !== null)
      .slice(0, 3);
    const provider = providerNotes[`${park.slug}.provider`];
    const dataSource =
      provider === "queue-times"
        ? "Queue-Times.com"
        : provider === "themeparks"
          ? "ThemeParks.wiki"
          : "ThemeParks.wiki + Queue-Times.com";
    if (complete.length >= 3) {
      eligible.push({ park, hourKey: local.hourKey, dataSource, waits: complete });
    }
  }

  if (eligible.length === 0) return null;
  // Deterministic hourly rotation gives variety without true randomness causing
  // one park to be selected repeatedly or making a cron retry produce new copy.
  const chosen = eligible[Math.floor(now.getTime() / 3_600_000) % eligible.length]!;
  const observedAt = new Date(Math.min(...chosen.waits.map((wait) => wait.observedAt.getTime())));
  return buildWaitPost({
    parkName: chosen.park.name,
    parkSlug: chosen.park.slug,
    waits: chosen.waits.map((wait) => ({ name: wait.name, minutes: wait.minutes })),
    observedAt,
    timezone: chosen.park.timezone,
    dataSource: chosen.dataSource,
    hourKey: chosen.hourKey,
    siteUrl: SITE_URL,
    expiresAt: new Date(now.getTime() + 50 * 60_000),
  });
}

async function hotelDealCandidate(db: Db, now: Date): Promise<SocialCandidate | null> {
  const eastern = zonedParts(now, "America/New_York");
  // One daily deal, after the morning hotel collection. The hourly job handles
  // the wall-clock conversion so cron itself can remain in the server timezone.
  if (eastern.hour !== 8) return null;

  const [year, month, day] = eastern.date.split("-").map(Number) as [number, number, number];
  const dayNumber = Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
  const tier = DEAL_TIERS[Math.abs(dayNumber) % DEAL_TIERS.length]!;
  const preferredRate = dayNumber % 2 === 0 ? "STANDARD" : "APH";
  const today = eastern.date;

  const findDeal = async (rateCode: "STANDARD" | "APH") => {
    const rows = await db
      .select({
        slug: properties.slug,
        name: properties.name,
        stayDate: rateCurrent.stayDate,
        nightlyCents: rateCurrent.nightlyCents,
        historicalLowCents: rateCurrent.historicalLowCents,
        observedAt: rateCurrent.observedAt,
      })
      .from(rateCurrent)
      .innerJoin(properties, eq(properties.id, rateCurrent.propertyId))
      .where(
        and(
          eq(properties.active, true),
          eq(properties.destination, "universal-orlando"),
          eq(properties.tier, tier),
          eq(rateCurrent.rateCode, rateCode),
          eq(rateCurrent.available, true),
          eq(rateCurrent.nights, 1),
          eq(rateCurrent.adults, 2),
          eq(rateCurrent.children, 0),
          gt(rateCurrent.historicalLowCents, 0),
          gte(rateCurrent.stayDate, today),
          // The rotating hotel crawl covers the active Orlando set in roughly
          // one day. Older observations are not a responsible "deal today."
          gte(rateCurrent.observedAt, new Date(now.getTime() - 30 * 60 * 60_000))
        )
      );
    const row = rows.sort((a, b) => {
      const score = (row: (typeof rows)[number]) =>
        row.historicalLowCents && row.historicalLowCents > 0
          ? (row.nightlyCents - row.historicalLowCents) / row.historicalLowCents
          : Number.POSITIVE_INFINITY;
      return score(a) - score(b) || a.nightlyCents - b.nightlyCents;
    })[0];
    if (!row?.historicalLowCents) return undefined;
    const percentAboveLow = (row.nightlyCents - row.historicalLowCents) / row.historicalLowCents;
    // "Deal of the day" should mean something. If an entire category is far
    // above its own collected low, skip the social post instead of manufacturing
    // excitement around an ordinary or expensive date.
    return percentAboveLow <= 0.15 ? { ...row, rateCode } : undefined;
  };

  const rateCode = preferredRate as "STANDARD" | "APH";
  const deal = (await findDeal(rateCode)) ?? (await findDeal(rateCode === "APH" ? "STANDARD" : "APH"));
  if (!deal) return null;

  return buildHotelDealPost({
    tierLabel: TIER_LABELS[tier],
    propertyName: deal.name,
    propertySlug: deal.slug,
    stayDate: deal.stayDate,
    nightlyCents: deal.nightlyCents,
    rateCode: deal.rateCode,
    rateLabel: deal.rateCode === "APH" ? "Annual Passholder rate" : "Standard public rate",
    dateKey: eastern.date,
    siteUrl: SITE_URL,
    observedAt: deal.observedAt,
    expiresAt: new Date(now.getTime() + 24 * 60 * 60_000),
  });
}

export async function generateSocialCandidates(db: Db, now = new Date()): Promise<SocialCandidate[]> {
  const candidates = await Promise.all([waitCandidate(db, now), hotelDealCandidate(db, now)]);
  return candidates.filter((candidate): candidate is SocialCandidate => candidate !== null);
}
