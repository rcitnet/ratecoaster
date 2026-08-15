/**
 * Infers an endpoint config from a browser HAR capture.
 *
 * Extracted from the CLI importer so the admin UI can call the same logic. The
 * heuristics are unchanged: find the JSON response that most resembles a list
 * of priced offers, then guess which fields hold the code, name and price.
 *
 * These are guesses, and they are presented as guesses. The UI shows the sample
 * row alongside them so a person can confirm rather than trust.
 */

interface HarEntry {
  request: {
    method: string;
    url: string;
    headers: Array<{ name: string; value: string }>;
    postData?: { text?: string };
  };
  response: { status: number; content: { mimeType?: string; text?: string } };
}

const PRICE_HINTS = [
  "averagenightlyrate",
  "nightlyrate",
  "averagerate",
  "amountpernight",
  "pernight",
  "nightly",
  "rateamount",
  "price",
  "amount",
];
const NAME_HINTS = ["roomtypename", "roomname", "name", "title", "description"];
const CODE_HINTS = ["roomtypecode", "roomcode", "code", "id", "roomtypeid", "date", "validdate"];
const TOTAL_HINTS = ["totalamount", "total", "grandtotal", "totalprice"];

function scoreArrayOfOffers(items: unknown[]): number {
  if (items.length === 0) return 0;
  const sample = items.slice(0, 5).filter((i) => i && typeof i === "object");
  if (sample.length === 0) return 0;

  let score = 0;
  for (const item of sample) {
    const keys = Object.keys(item as Record<string, unknown>).map((k) => k.toLowerCase());
    if (keys.some((k) => PRICE_HINTS.some((h) => k.includes(h)))) score += 3;
    if (keys.some((k) => k.includes("room"))) score += 2;
    if (keys.some((k) => k.includes("rate"))) score += 2;
    if (keys.some((k) => k.includes("date"))) score += 2;
    if (keys.some((k) => NAME_HINTS.includes(k))) score += 1;
  }
  return score * Math.min(items.length, 10);
}

interface Candidate {
  path: string;
  score: number;
  sample: Record<string, unknown>;
}

function findOffersPath(root: unknown): Candidate | null {
  const candidates: Candidate[] = [];

  const visit = (node: unknown, path: string, depth: number) => {
    if (depth > 8 || node === null || typeof node !== "object") return;

    if (Array.isArray(node)) {
      const score = scoreArrayOfOffers(node);
      const first = node.find((i) => i && typeof i === "object");
      if (score > 0 && first) {
        candidates.push({ path: `${path}[*]`, score, sample: first as Record<string, unknown> });
      }
      for (const item of node.slice(0, 3)) visit(item, `${path}[*]`, depth + 1);
      return;
    }

    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      visit(value, path ? `${path}.${key}` : key, depth + 1);
    }
  };

  visit(root, "", 0);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]!;
}

function guessField(sample: Record<string, unknown>, hints: string[], depth = 3): string | null {
  for (const hint of hints) {
    const found = search(sample, hint, "", depth);
    if (found) return found;
  }
  return null;

  function search(node: unknown, hint: string, path: string, remaining: number): string | null {
    if (remaining < 0 || node === null || typeof node !== "object") return null;

    if (Array.isArray(node)) {
      const first = node[0];
      return first ? search(first, hint, `${path}[0]`, remaining - 1) : null;
    }

    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      const here = path ? `${path}.${key}` : key;
      if (
        key.toLowerCase().includes(hint) &&
        (typeof value === "string" || typeof value === "number")
      ) {
        return here;
      }
    }
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      const nested = search(value, hint, path ? `${path}.${key}` : key, remaining - 1);
      if (nested) return nested;
    }
    return null;
  }
}

/** Replaces literal values from the capture with placeholders. */
function templatize(url: string): string {
  return url
    .replace(/(\d{4}-\d{2}-\d{2})/, "{checkIn}")
    .replace(/(\d{4}-\d{2}-\d{2})/, "{checkOut}")
    .replace(/([?&](?:promo|promoCode|rateCode|ratePlan|corporateCode)=)[^&]*/i, "$1{rateCode}")
    .replace(/([?&](?:adults|numAdults|adultCount)=)\d+/i, "$1{adults}")
    .replace(/([?&](?:children|numChildren|childCount|kids)=)\d+/i, "$1{children}");
}

export interface GuessResult {
  name: string;
  candidateCount: number;
  config: Record<string, unknown>;
  sample: Record<string, unknown>;
  sourceUrl: string;
  /** Fields the person must check, in the order they matter. */
  warnings: string[];
}

export function guessConfigFromHar(harText: string, name: string): GuessResult {
  let har: { log: { entries: HarEntry[] } };
  try {
    har = JSON.parse(harText);
  } catch {
    throw new Error("That file isn't valid JSON. Make sure you exported a HAR, not a screenshot.");
  }

  if (!har?.log?.entries?.length) {
    throw new Error("No requests found in this HAR.");
  }

  const candidates: Array<{ entry: HarEntry; size: number; offers: Candidate }> = [];

  for (const entry of har.log.entries) {
    const text = entry.response?.content?.text;
    if (!text || entry.response.status !== 200) continue;
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      continue;
    }
    const offers = findOffersPath(json);
    if (offers) candidates.push({ entry, size: text.length, offers });
  }

  if (candidates.length === 0) {
    throw new Error(
      "No response in this capture looked like a list of prices. Check that you captured the " +
        "availability request itself (Fetch/XHR, status 200) and exported *with content* — a HAR " +
        "without response bodies can't be read."
    );
  }

  candidates.sort((a, b) => b.size - a.size);
  const best = candidates[0]!;
  const sample = best.offers.sample;

  const priceField = guessField(sample, PRICE_HINTS);
  const warnings: string[] = [];

  warnings.push(
    "Set rateCodeAppliedPath — without it, a silently ignored promo code gets stored as a real discount."
  );
  if (!priceField) warnings.push("Couldn't find a price field. Set `nightly` by hand.");
  if (!templatize(best.entry.request.url).includes("{checkIn}")) {
    warnings.push("No date found in the URL to templatise. Replace it with {checkIn} yourself.");
  }

  return {
    name,
    candidateCount: candidates.length,
    sourceUrl: best.entry.request.url,
    sample,
    warnings,
    config: {
      name,
      capturedAt: new Date().toISOString().slice(0, 10),
      notes: "Generated from a HAR capture. Review before use.",
      request: {
        method: best.entry.request.method === "POST" ? "POST" : "GET",
        urlTemplate: templatize(best.entry.request.url),
        headers: Object.fromEntries(
          (best.entry.request.headers ?? [])
            .filter((h) =>
              ["accept", "content-type", "accept-language"].includes(h.name.toLowerCase())
            )
            .map((h) => [h.name.toLowerCase(), h.value])
        ),
        ...(best.entry.request.postData?.text
          ? { bodyTemplate: templatize(best.entry.request.postData.text) }
          : {}),
        rpm: 12,
      },
      response: {
        roomsPath: best.offers.path,
        fields: {
          roomCode: guessField(sample, CODE_HINTS) ?? "code",
          roomName: guessField(sample, NAME_HINTS) ?? "name",
          nightly: priceField ?? "price",
          ...(guessField(sample, TOTAL_HINTS) ? { total: guessField(sample, TOTAL_HINTS)! } : {}),
        },
        pricesAreCents: false,
      },
    },
  };
}
