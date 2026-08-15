import { cookies, headers } from "next/headers";
import { ENTITLEMENTS, RateCoasterClient, type Entitlements, type GateInfo } from "@ratecoaster/shared";

const BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8787";

/**
 * Server-side API client that forwards the caller's session cookie.
 *
 * This is the piece that makes server-rendered pages respect the paywall. Next
 * fetches run on the server with no browser cookie jar, so without explicitly
 * passing the cookie through, every page would render as anonymous — and a
 * signed-in user would still see the 30-day wall.
 */
export async function getClient(): Promise<RateCoasterClient> {
  const cookieHeader = (await cookies()).toString();
  return new RateCoasterClient({
    baseUrl: BASE_URL,
    fetch: (input, init) =>
      fetch(input, {
        ...init,
        headers: { ...(init?.headers as Record<string, string>), cookie: cookieHeader },
        cache: "no-store",
      }),
  });
}

/** Raw fetch for endpoints not on the typed client yet. */
export async function apiFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    const cookieHeader = (await cookies()).toString();
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch (err) {
    console.error(`[web] ${path} failed:`, err);
    return fallback;
  }
}

export interface Me {
  user: { id: string; email: string | null; tier: string; displayName: string | null } | null;
  entitlements: Entitlements;
}

export async function getMe(): Promise<Me> {
  return apiFetch<Me>("/v1/auth/me", { user: null, entitlements: ENTITLEMENTS.anonymous });
}

/**
 * Wraps a fetch so a dead API renders an empty state rather than a crash.
 * A trip planner that shows a calm empty page beats one that 500s.
 */
export async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch (err) {
    console.error("[web] API call failed:", err);
    return fallback;
  }
}

export const EMPTY_GATE: GateInfo = {
  gated: false,
  tier: "anonymous",
  requiredTier: null,
  visibleDays: 0,
  withheldDays: 0,
  visibleThrough: null,
  reason: null,
};

/* ---------- formatting ---------- */

export function relativeTime(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} days ago`;
}

/** Dates are rendered in UTC so the label always matches the stored stay date. */
function utcDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

export function formatStayDate(date: string): string {
  return utcDate(date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatLongDate(date: string): string {
  return utcDate(date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function dayOfWeekLabel(date: string): string {
  return utcDate(date).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
}

export function dayNumber(date: string): string {
  return utcDate(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Stable colour per park, so the same park reads the same everywhere. */
export const PARK_COLORS: Record<string, string> = {
  "universal-studios-florida": "#3355ee",
  "islands-of-adventure": "#0fb5a5",
  "epic-universe": "#e6218c",
  "volcano-bay": "#ff6a45",
  "universal-studios-hollywood": "#8b5cf6",
  "universal-kids-resort": "#ffc53d",
};

export const TIER_COLORS: Record<string, string> = {
  premier: "linear-gradient(135deg, #e6218c, #8b5cf6)",
  preferred: "linear-gradient(135deg, #3355ee, #0fb5a5)",
  "universal-classic": "linear-gradient(135deg, #0fb5a5, #3355ee)",
  "prime-value": "linear-gradient(135deg, #ff6a45, #ffc53d)",
  value: "linear-gradient(135deg, #ffc53d, #0fb5a5)",
  partner: "linear-gradient(135deg, #8b5cf6, #3355ee)",
};

export const TIER_LABELS: Record<string, string> = {
  premier: "Premier",
  preferred: "Preferred",
  "universal-classic": "Classic",
  "prime-value": "Prime Value",
  value: "Value",
  partner: "Partner hotel",
};
