import { fetchJson } from "../framework/http.js";

/**
 * Adapter for the Aviasales (Travelpayouts) flight price calendar.
 *
 * Why this source: it is the only flight feed at our scale that is free to
 * query and monetised by referral rather than by the call. Per-call pricing is
 * the wrong shape for a planner — a browse-heavy, booking-light product would
 * pay for every idle calendar scroll. Here we pay nothing and earn on the
 * clicks that convert.
 *
 * What it is NOT: live shopping. Responses come from an aggregated cache, so a
 * quote is "this fare existed recently", not "this fare is bookable now". Every
 * value that leaves this module keeps its `expiresAt` for exactly that reason.
 *
 * Endpoint contract (v1/prices/calendar):
 *   GET https://api.travelpayouts.com/v1/prices/calendar
 *     ?origin=NYC&destination=MCO&departure_date=2026-11
 *     &calendar_type=departure_date&length=5&currency=USD
 *   header: x-access-token: <token>
 *
 *   { "success": true, "data": { "2026-11-03": { price, transfers, airline,
 *     flight_number, departure_at, return_at, expires_at }, ... } }
 *
 * One request returns a whole month, which is what makes a 365-day catalogue
 * affordable: 30 origins x 12 months is 360 requests, not 11,000.
 */

const API_HOST = "https://api.travelpayouts.com";

export interface TravelpayoutsCredentials {
  token: string;
  /** Affiliate marker, used only to build outbound booking links. */
  marker: string | null;
}

export class MissingCredentialsError extends Error {
  constructor() {
    super("AVIASALES_API_TOKEN is not set");
    this.name = "MissingCredentialsError";
  }
}

function isPlaceholder(value: string | undefined): boolean {
  if (!value) return true;
  const v = value.trim();
  if (v === "") return true;
  return /^(change_?me|your[-_]?(token|key)|placeholder|todo|xxx+)/i.test(v);
}

/**
 * Placeholders are treated as absent, not as a value.
 *
 * The same lesson as the Resend key: a `.env` left at `CHANGE_ME_...` produced
 * a 401 that read like a broken integration for a day. Config that was never
 * filled in should say so, not fail downstream wearing someone else's error.
 */
export function readCredentials(): TravelpayoutsCredentials | null {
  // Prefer the names shown in the current Aviasales/Travelpayouts dashboard.
  // Keep the older names as a migration path for existing deployments.
  const token = process.env.AVIASALES_API_TOKEN ?? process.env.TRAVELPAYOUTS_TOKEN;
  if (isPlaceholder(token)) return null;
  const marker =
    process.env.TRAVELPAYOUTS_PARTNER_ID ?? process.env.TRAVELPAYOUTS_MARKER;
  return { token: token!.trim(), marker: isPlaceholder(marker) ? null : marker!.trim() };
}

export interface CalendarEntry {
  departDate: string;
  priceCents: number;
  airline: string | null;
  transfers: number | null;
  expiresAt: string | null;
}

interface RawCalendarRow {
  price?: unknown;
  value?: unknown;
  airline?: unknown;
  transfers?: unknown;
  number_of_changes?: unknown;
  expires_at?: unknown;
}

/** `2026-11-03` — the keys of the `data` object. */
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/**
 * Parse the calendar response into normalised entries.
 *
 * Split out from the fetch so it can be unit-tested against a captured payload
 * without a token or a network — the same arrangement that let the wait-time
 * parsers be verified against real bytes.
 *
 * Tolerant on purpose. The feed has had at least two shapes in the wild
 * (`price` and `value`, `transfers` and `number_of_changes`), and a calendar
 * that drops a month because a key was renamed is worse than one that reads
 * both.
 */
export function parseCalendar(payload: unknown): CalendarEntry[] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as { success?: unknown; data?: unknown };

  // `success: false` carries an error message rather than data; surfacing it is
  // more useful than returning an empty array that looks like "no flights".
  if (root.success === false) {
    const message =
      asString((payload as { error?: unknown }).error) ?? "upstream reported success: false";
    throw new Error(`Travelpayouts: ${message}`);
  }

  const data = root.data;
  if (!data || typeof data !== "object") return [];

  const out: CalendarEntry[] = [];

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (!DATE_KEY.test(key)) continue;
    if (!value || typeof value !== "object") continue;

    const row = value as RawCalendarRow;
    const price = asNumber(row.price) ?? asNumber(row.value);
    if (price === null || price <= 0) continue;

    /*
     * Prices arrive in whole currency units; we store cents everywhere. Rounding
     * rather than truncating, because `Math.trunc(199.999)` is 199 and a fare
     * that reads $1 cheap in a comparison table is the kind of error nobody
     * reports and everybody notices.
     */
    out.push({
      departDate: key,
      priceCents: Math.round(price * 100),
      airline: asString(row.airline),
      transfers: asNumber(row.transfers) ?? asNumber(row.number_of_changes),
      expiresAt: asString(row.expires_at),
    });
  }

  return out.sort((a, b) => a.departDate.localeCompare(b.departDate));
}

export interface CalendarRequest {
  origin: string;
  destination: string;
  /** `YYYY-MM`. One request covers the whole month. */
  month: string;
  /** Nights away. Omitted means one-way, which is never what we want here. */
  tripLengthDays: number;
  currency?: string;
}

export async function fetchCalendarMonth(
  req: CalendarRequest,
  creds: TravelpayoutsCredentials
): Promise<CalendarEntry[]> {
  const url = new URL(`${API_HOST}/v1/prices/calendar`);
  url.searchParams.set("origin", req.origin);
  url.searchParams.set("destination", req.destination);
  url.searchParams.set("departure_date", req.month);
  url.searchParams.set("calendar_type", "departure_date");
  url.searchParams.set("length", String(req.tripLengthDays));
  url.searchParams.set("currency", req.currency ?? "USD");

  /*
   * Token in the header, not the query string. The API accepts either, but a
   * token in a URL ends up in access logs, in `raw_snapshots`, and in any error
   * message that echoes the request — three copies of a credential we would
   * then have to rotate.
   */
  const payload = await fetchJson(url.toString(), {
    headers: { "x-access-token": creds.token },
    requestKey: `tp:${req.origin}:${req.destination}:${req.month}:${req.tripLengthDays}`,
    // 300 RPM is the documented ceiling for this endpoint; stay well under it.
    rpm: 120,
  });

  // Null means the dry-run guard swallowed the request.
  if (payload === null) return [];
  return parseCalendar(payload);
}

/**
 * Build an outbound search link carrying the affiliate marker.
 *
 * Aviasales search URLs encode the itinerary in the path:
 *   /search/NYC0311MCO0811 2  ->  NYC on 03 Mar, MCO on 08 Mar, 2 passengers
 * i.e. ORIGIN + DDMM + DESTINATION + DDMM + passenger count.
 *
 * Returns null without a marker rather than emitting an unattributed link: an
 * outbound click that earns nothing is the one part of this feature that has a
 * direct cost, since it is traffic given away for free.
 */
export function buildBookingUrl(params: {
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string;
  passengers: number;
  marker: string | null;
}): string | null {
  if (!params.marker) return null;

  const ddmm = (iso: string) => {
    const [, m, d] = iso.split("-");
    if (!m || !d) return null;
    return `${d}${m}`;
  };

  const out = ddmm(params.departDate);
  const back = ddmm(params.returnDate);
  if (!out || !back) return null;

  const passengers = Math.min(Math.max(params.passengers, 1), 9);
  const path = `${params.origin}${out}${params.destination}${back}${passengers}`;
  return `https://www.aviasales.com/search/${path}?marker=${encodeURIComponent(params.marker)}`;
}
