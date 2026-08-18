import { parseMoneyToCents } from "@ratecoaster/shared";
import { and, eq } from "drizzle-orm";
import { rateCurrent } from "@ratecoaster/db/schema";
import { dateRange, daysBetween, todayInTimezone } from "../../framework/dates.js";
import { politeFetch } from "../../framework/http.js";
import type { RateReading } from "../../framework/persist.js";
import { upsertRoomType } from "../room-types.js";
import { selectRotatingDates } from "../schedule.js";
import type { PropertyRow, RateAdapter } from "./types.js";

const IBE_BASE = "https://reservations.universalorlando.com/ibe/details.aspx";
const Y2K = "2000-01-01";

type SupportedRateCode = "STANDARD" | "APH";

const UNIVERSAL_RATE_PLANS: Record<
  SupportedRateCode,
  { engineCode: string; access: string; label: string }
> = {
  STANDARD: { engineCode: "0RACW", access: "", label: "Flexible Rate" },
  APH: { engineCode: "3APHW", access: "APH", label: "Annual Passholder Rate" },
};

export interface UniversalRateOffer {
  roomCode: string;
  roomName: string;
  nightlyCents: number;
  totalCents: number;
  available: true;
}

function decodeHtml(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt);/gi, (match, entity: string) => {
    const normalized = entity.toLowerCase();
    if (normalized === "amp") return "&";
    if (normalized === "quot") return '"';
    if (normalized === "apos") return "'";
    if (normalized === "lt") return "<";
    if (normalized === "gt") return ">";
    const codePoint = normalized.startsWith("#x")
      ? Number.parseInt(normalized.slice(2), 16)
      : Number.parseInt(normalized.slice(1), 10);
    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
  });
}

function attributesOf(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gs)) {
    attributes[match[1]!.toLowerCase()] = decodeHtml(match[3] ?? "");
  }
  return attributes;
}

/** Parse the server-rendered room buttons, which contain the authoritative quote. */
export function parseUniversalRatePage(
  html: string,
  expectedRateCode: SupportedRateCode
): UniversalRateOffer[] {
  const expected = UNIVERSAL_RATE_PLANS[expectedRateCode];
  const offers: UniversalRateOffer[] = [];
  const seen = new Set<string>();

  for (const match of html.matchAll(/<a\b[^>]*\bclass\s*=\s*(["'])[^"']*\bwsViewRateRoom\b[^"']*\1[^>]*>/gi)) {
    const attributes = attributesOf(match[0]);
    if (attributes.ratecode !== expected.engineCode) continue;
    if (attributes.ratetype !== expected.label) continue;
    if (expectedRateCode === "APH" && attributes.access !== "APH") continue;

    const nightlyCents = parseMoneyToCents(attributes.amt ?? null);
    const taxCents = parseMoneyToCents(attributes.tax ?? null) ?? 0;
    const roomCode = attributes.roomcode || attributes.rmid;
    const roomName = attributes.roomtype || attributes.name;
    if (!roomCode || !roomName || nightlyCents === null || nightlyCents <= 0) continue;
    if (seen.has(roomCode)) continue;
    seen.add(roomCode);

    offers.push({
      roomCode,
      roomName,
      nightlyCents,
      totalCents: nightlyCents + taxCents,
      available: true,
    });
  }

  return offers;
}

export function isUniversalRateUnavailablePage(html: string): boolean {
  return /(?:currently unavailable|dates are not available|rate (?:is|has become) (?:no longer |not )available|offer is not available|invalid offer)/i.test(
    html
  );
}

/** Windsurfer's dt1 is an integer day offset from 2000-01-01. */
export function universalDayIndex(stayDate: string): number {
  return daysBetween(Y2K, stayDate);
}

export function buildUniversalRateUrl(
  hotelId: number,
  hotelGroupId: number,
  stayDate: string,
  rateCode: SupportedRateCode,
  adults = 2
): string {
  const plan = UNIVERSAL_RATE_PLANS[rateCode];
  const url = new URL(IBE_BASE);
  url.searchParams.set("access", plan.access);
  url.searchParams.set("rate", plan.engineCode);
  url.searchParams.set("currID", "1");
  url.searchParams.set("hgID", String(hotelGroupId));
  url.searchParams.set("hotelID", String(hotelId));
  url.searchParams.set("lang", "en-us");
  url.searchParams.set("dt1", String(universalDayIndex(stayDate)));
  url.searchParams.set("nights", "1");
  url.searchParams.set("rooms", "1");
  url.searchParams.set("adults", String(adults));
  url.searchParams.set("voucher", "");
  return url.toString();
}

function configOf(property: PropertyRow): { hotelId: number; hotelGroupId: number } | null {
  const cfg = (property.collectorConfig ?? {}) as Record<string, unknown>;
  if (cfg.adapter !== "universal-ibe") return null;
  const hotelId = Number(cfg.hotelId);
  const hotelGroupId = Number(cfg.hotelGroupId);
  if (!Number.isInteger(hotelId) || hotelId <= 0) return null;
  if (!Number.isInteger(hotelGroupId) || hotelGroupId <= 0) return null;
  return { hotelId, hotelGroupId };
}

/** Direct, observed STANDARD and APH rates from Universal's own reservation engine. */
export const universalIbeAdapter: RateAdapter = {
  source: "observed",
  name: "universal-ibe",

  async isReady(_ctx, property) {
    return configOf(property)
      ? { ready: true }
      : { ready: false, reason: "missing Universal hotelId or hotelGroupId" };
  },

  async collect(ctx, property, params, emit) {
    const config = configOf(property);
    if (!config) return;

    // The page labels multi-night quotes as an average. One-night requests are
    // mandatory so every stored stayDate remains an actual nightly price.
    if (params.nights !== 1) {
      throw new Error("Universal IBE collection only supports one-night quotes");
    }

    const allDates = dateRange(todayInTimezone("America/New_York"), params.lookaheadDays);
    const dates = selectRotatingDates(allDates, params.sliceFraction);
    const readings: RateReading[] = [];

    for (const stayDate of dates) {
      for (const rateCode of ["STANDARD", "APH"] as const) {
        const url = buildUniversalRateUrl(
          config.hotelId,
          config.hotelGroupId,
          stayDate,
          rateCode
        );

        try {
          ctx.stats.requestCount++;
          const response = await politeFetch(url, {
            rpm: 12,
            headers: { accept: "text/html,application/xhtml+xml" },
            requestKey: `universal-ibe:${property.slug}:${stayDate}:${rateCode}`,
          });
          if (response.skipped) continue;

          const offers = parseUniversalRatePage(response.body, rateCode);
          if (offers.length === 0) {
            if (!isUniversalRateUnavailablePage(response.body)) {
              throw new Error("Universal rate page contained no recognizable room offers");
            }
            ctx.stats.notes[`${property.slug}.${rateCode}.unavailable`] =
              ((ctx.stats.notes[`${property.slug}.${rateCode}.unavailable`] as number) ?? 0) + 1;
          }

          const seenRoomTypeIds = new Set<string>();
          for (const offer of offers) {
            const roomTypeId = await upsertRoomType(
              ctx,
              property.id,
              offer.roomCode,
              offer.roomName,
              null
            );
            seenRoomTypeIds.add(roomTypeId);
            readings.push({
              propertyId: property.id,
              roomTypeId,
              rateCode,
              stayDate,
              nights: 1,
              adults: 2,
              children: 0,
              nightlyCents: offer.nightlyCents,
              totalCents: offer.totalCents,
              currency: "USD",
              available: true,
              source: "observed",
              isEstimated: false,
              merchant: null,
            });
          }

          // A room disappearing from an otherwise valid response means it is
          // no longer bookable for this rate/date. Carry forward its last
          // price only so availability can transition to false accurately.
          const previous = await ctx.db
            .select({
              roomTypeId: rateCurrent.roomTypeId,
              nightlyCents: rateCurrent.nightlyCents,
              totalCents: rateCurrent.totalCents,
              currency: rateCurrent.currency,
            })
            .from(rateCurrent)
            .where(
              and(
                eq(rateCurrent.propertyId, property.id),
                eq(rateCurrent.rateCode, rateCode),
                eq(rateCurrent.stayDate, stayDate),
                eq(rateCurrent.nights, 1),
                eq(rateCurrent.adults, 2),
                eq(rateCurrent.children, 0),
                eq(rateCurrent.available, true)
              )
            );

          for (const prior of previous) {
            if (prior.roomTypeId === null || seenRoomTypeIds.has(prior.roomTypeId)) continue;
            readings.push({
              propertyId: property.id,
              roomTypeId: prior.roomTypeId,
              rateCode,
              stayDate,
              nights: 1,
              adults: 2,
              children: 0,
              nightlyCents: prior.nightlyCents,
              totalCents: prior.totalCents,
              currency: prior.currency,
              available: false,
              source: "observed",
              isEstimated: false,
              merchant: null,
            });
          }
        } catch (error) {
          ctx.stats.errorCount++;
          ctx.logger.warn(`${property.slug} ${stayDate} ${rateCode}: ${String(error)}`);
        }
      }

      if (readings.length >= 200) await emit(readings.splice(0));
    }

    if (readings.length > 0) await emit(readings);
    ctx.logger.info(`${property.slug}: covered ${dates.length} dates for STANDARD and APH`);
  },
};
