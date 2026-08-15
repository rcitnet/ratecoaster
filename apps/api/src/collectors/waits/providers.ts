import { z } from "zod";
import { fetchJson } from "../framework/http.js";

/**
 * Two independent wait-time providers, both free and unauthenticated.
 *
 * Keeping both is cheap insurance. These are volunteer-run services; when one
 * has an outage or drops a park, the other usually still has it, and the
 * collector can fail over without any of the downstream tables caring which
 * one produced the number.
 */

export type NormalizedWait = {
  externalId: string;
  name: string;
  kind: "ride" | "show" | "meet-and-greet" | "other";
  land: string | null;
  waitMinutes: number | null;
  singleRiderMinutes: number | null;
  status: "operating" | "down" | "closed" | "refurbishment" | "unknown";
  observedAt: string;
};

/* ---------------------------------------------------------------- *
 * Queue-Times
 * ---------------------------------------------------------------- */

const QueueTimesRide = z.object({
  id: z.number(),
  name: z.string(),
  is_open: z.boolean(),
  wait_time: z.number(),
  last_updated: z.string(),
});

const QueueTimesResponse = z.object({
  lands: z.array(z.object({ id: z.number(), name: z.string(), rides: z.array(QueueTimesRide) })),
  rides: z.array(QueueTimesRide),
});

/**
 * Queue-Times requires visible attribution. This is not optional and it is not
 * onerous — the API is free and they ask only that you link back.
 */
export const QUEUE_TIMES_ATTRIBUTION = {
  source: "queue-times",
  text: "Powered by Queue-Times.com",
  url: "https://queue-times.com/",
};

const SINGLE_RIDER_SUFFIX = /\s+single\s+rider\s*$/i;

export async function fetchQueueTimes(parkId: number): Promise<NormalizedWait[]> {
  const json = await fetchJson(`https://queue-times.com/parks/${parkId}/queue_times.json`, {
    // Public API that welcomes traffic, so it bypasses the dry-run guard and
    // gets a more generous rate than a booking engine would.
    alwaysSend: true,
    rpm: 60,
  });
  if (!json) return [];
  return parseQueueTimes(json);
}

/**
 * Parsing is separated from fetching so it can be tested against real captured
 * payloads without a network. The interesting logic — single-rider folding,
 * closed-ride handling — lives here, and that is the part that breaks.
 */
export function parseQueueTimes(json: unknown): NormalizedWait[] {
  const parsed = QueueTimesResponse.parse(json);

  type Row = { ride: z.infer<typeof QueueTimesRide>; land: string | null };
  const rows: Row[] = [
    ...parsed.lands.flatMap((land) => land.rides.map((ride) => ({ ride, land: land.name }))),
    ...parsed.rides.map((ride) => ({ ride, land: null })),
  ];

  /*
   * Queue-Times models a single-rider queue as its own ride named
   * "<Attraction> Single Rider". Left alone, that produces phantom attractions
   * that clutter the board and skew any "average wait" you compute. We fold
   * them into the parent by name and keep only the parent row.
   */
  const singleRider = new Map<string, number>();
  for (const { ride } of rows) {
    if (SINGLE_RIDER_SUFFIX.test(ride.name)) {
      singleRider.set(normalizeName(ride.name.replace(SINGLE_RIDER_SUFFIX, "")), ride.wait_time);
    }
  }

  const out: NormalizedWait[] = [];
  for (const { ride, land } of rows) {
    if (SINGLE_RIDER_SUFFIX.test(ride.name)) continue;
    out.push({
      externalId: `qt:${ride.id}`,
      name: ride.name,
      kind: classifyKind(ride.name),
      land,
      // A closed ride reports wait_time 0, which is not a zero-minute wait.
      // Storing 0 here would make "average wait" collapse overnight.
      waitMinutes: ride.is_open ? ride.wait_time : null,
      singleRiderMinutes: singleRider.get(normalizeName(ride.name)) ?? null,
      status: ride.is_open ? "operating" : "closed",
      observedAt: ride.last_updated,
    });
  }
  return out;
}

/* ---------------------------------------------------------------- *
 * ThemeParks.wiki
 * ---------------------------------------------------------------- */

export const THEMEPARKS_WIKI_ATTRIBUTION = {
  source: "themeparks-wiki",
  text: "Wait times from ThemeParks.wiki",
  url: "https://themeparks.wiki/",
};

const TpwLiveItem = z.object({
  id: z.string(),
  name: z.string(),
  entityType: z.string(),
  externalId: z.string().optional(),
  status: z.string().optional(),
  lastUpdated: z.string().optional(),
  queue: z
    .object({
      STANDBY: z.object({ waitTime: z.number().nullable() }).optional(),
      SINGLE_RIDER: z.object({ waitTime: z.number().nullable() }).optional(),
      RETURN_TIME: z.unknown().optional(),
    })
    .optional(),
});

const TpwLiveResponse = z.object({
  id: z.string(),
  name: z.string(),
  timezone: z.string().optional(),
  liveData: z.array(TpwLiveItem),
});

export async function fetchThemeParksWiki(entityId: string): Promise<NormalizedWait[]> {
  const json = await fetchJson(`https://api.themeparks.wiki/v1/entity/${entityId}/live`, {
    alwaysSend: true,
    rpm: 60,
  });
  if (!json) return [];
  return parseThemeParksWiki(json);
}

export function parseThemeParksWiki(json: unknown): NormalizedWait[] {
  const parsed = TpwLiveResponse.parse(json);

  return parsed.liveData.map((item) => ({
    externalId: item.externalId ?? `tpw:${item.id}`,
    name: item.name,
    kind:
      item.entityType === "SHOW"
        ? classifyKind(item.name) === "meet-and-greet"
          ? "meet-and-greet"
          : "show"
        : classifyKind(item.name),
    // The live endpoint carries no land. Land comes from /children and is
    // resolved separately during attraction sync, so we leave it null here
    // rather than guessing from the name.
    land: null,
    waitMinutes: item.queue?.STANDBY?.waitTime ?? null,
    singleRiderMinutes: item.queue?.SINGLE_RIDER?.waitTime ?? null,
    status: mapTpwStatus(item.status),
    observedAt: item.lastUpdated ?? new Date().toISOString(),
  }));
}

function mapTpwStatus(status: string | undefined): NormalizedWait["status"] {
  switch (status?.toUpperCase()) {
    case "OPERATING":
      return "operating";
    case "DOWN":
      return "down";
    case "CLOSED":
      return "closed";
    case "REFURBISHMENT":
      return "refurbishment";
    default:
      return "unknown";
  }
}

function classifyKind(name: string): NormalizedWait["kind"] {
  const n = name.toLowerCase();
  if (/^meet\b|character (meet|greet)|encounter$/.test(n)) return "meet-and-greet";
  if (/\bshow\b|rally|dance party|waterworld|cinematic|spectacular/.test(n)) return "show";
  return "ride";
}

/** Lowercase, strip trademark marks and punctuation, collapse whitespace. */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[™®©]/g, "")
    .replace(/[‘’“”]/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Deterministic, readable slug used as the public identifier for an attraction. */
export function slugify(name: string): string {
  return normalizeName(name).replace(/\s+/g, "-").slice(0, 80);
}
