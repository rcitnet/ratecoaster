import { parseMoneyToCents } from "@ratecoaster/shared";
import { fetchJson } from "../framework/http.js";
import {
  extractOne,
  extractPath,
  renderTemplate,
  type EndpointConfig,
} from "./endpoint-config.js";

/**
 * Booking-engine scraping primitives.
 *
 * These moved out of index.ts unchanged when the collector gained an adapter
 * layer, so the `observed` adapter, the endpoint-verification job, the admin
 * endpoint tester, and the tests can all share one implementation. They are
 * re-exported from ./index.ts, so every existing import path still resolves.
 */
export interface ParsedOffer {
  roomCode: string;
  roomName: string;
  nightlyCents: number;
  totalCents: number | null;
  available: boolean;
  maxOccupancy: number | null;
}

/**
 * Issues one booking-engine query and maps the response through the endpoint
 * config. All operator-specific knowledge lives in the JSON; this function is
 * generic across Loews, Hilton, Marriott, and anything else you capture.
 */
export async function queryOffers(
  endpoint: EndpointConfig,
  vars: Record<string, string | number>
): Promise<{ offers: ParsedOffer[]; rateCodeApplied: boolean } | null> {
  const url = renderTemplate(endpoint.request.urlTemplate, vars);
  const body = endpoint.request.bodyTemplate
    ? renderTemplate(endpoint.request.bodyTemplate, vars)
    : undefined;

  const json = await fetchJson(url, {
    method: endpoint.request.method,
    headers: endpoint.request.headers,
    body,
    rpm: endpoint.request.rpm,
  });
  if (json === null) return null;

  return { offers: parseOffers(endpoint, json), rateCodeApplied: checkRateCode(endpoint, json) };
}

export function checkRateCode(endpoint: EndpointConfig, json: unknown): boolean {
  const { rateCodeAppliedPath, rateCodeAppliedEquals } = endpoint.response;
  // No verification configured: trust the engine. Documented as a known gap
  // rather than silently assumed correct.
  if (!rateCodeAppliedPath) return true;
  const actual = extractOne(json, rateCodeAppliedPath);
  if (rateCodeAppliedEquals === undefined) return actual !== null && actual !== false;
  return String(actual) === String(rateCodeAppliedEquals);
}

export function parseOffers(endpoint: EndpointConfig, json: unknown): ParsedOffer[] {
  const { roomsPath, fields, pricesAreCents } = endpoint.response;
  const rooms = extractPath(json, roomsPath);
  const offers: ParsedOffer[] = [];

  for (const room of rooms) {
    const rawNightly = extractOne(room, fields.nightly);
    const nightlyCents = pricesAreCents
      ? typeof rawNightly === "number"
        ? Math.round(rawNightly)
        : null
      : parseMoneyToCents(rawNightly as string | number | null);

    // A room with no parseable price is not a zero-dollar room; it is a parse
    // failure or a sold-out entry. Either way it must not enter the dataset.
    if (nightlyCents === null || nightlyCents <= 0) continue;

    const rawTotal = extractOne(room, fields.total);
    const totalCents = pricesAreCents
      ? typeof rawTotal === "number"
        ? Math.round(rawTotal)
        : null
      : parseMoneyToCents(rawTotal as string | number | null);

    const availableRaw = extractOne(room, fields.available);
    const maxOcc = extractOne(room, fields.maxOccupancy);

    offers.push({
      roomCode: String(extractOne(room, fields.roomCode) ?? "unknown"),
      roomName: String(extractOne(room, fields.roomName) ?? "Room"),
      nightlyCents,
      totalCents,
      available: availableRaw === null ? true : Boolean(availableRaw),
      maxOccupancy: typeof maxOcc === "number" ? maxOcc : null,
    });
  }

  return offers;
}
