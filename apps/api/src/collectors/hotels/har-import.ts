/**
 * Turns a browser HAR capture into an endpoint config skeleton.
 *
 * Usage:
 *   npm run -w @parkpulse/api har:import -- har/loews.har loews-universal
 *
 * The heuristics below are not magic — they find the JSON response that most
 * looks like a list of room offers and guess the paths. You still review the
 * output. The value is that it turns "read someone's minified API by hand" into
 * "check five fields", which is the difference between a task you will actually
 * do and one you will not.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

interface HarEntry {
  request: { method: string; url: string; headers: Array<{ name: string; value: string }>; postData?: { text?: string } };
  response: { status: number; content: { mimeType?: string; text?: string } };
}

/** Field names that suggest a nightly price, in descending order of confidence. */
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
const ROOM_NAME_HINTS = ["roomtypename", "roomname", "name", "title", "description"];
const ROOM_CODE_HINTS = ["roomtypecode", "roomcode", "code", "id", "roomtypeid"];
const TOTAL_HINTS = ["totalamount", "total", "grandtotal", "totalprice", "stevetotal"];

function scoreArrayOfRooms(items: unknown[]): number {
  if (items.length === 0) return 0;
  const sample = items.slice(0, 5).filter((i) => i && typeof i === "object");
  if (sample.length === 0) return 0;

  let score = 0;
  for (const item of sample) {
    const keys = Object.keys(item as Record<string, unknown>).map((k) => k.toLowerCase());
    if (keys.some((k) => PRICE_HINTS.some((h) => k.includes(h)))) score += 3;
    if (keys.some((k) => k.includes("room"))) score += 2;
    if (keys.some((k) => k.includes("rate"))) score += 2;
    if (keys.some((k) => ROOM_NAME_HINTS.includes(k))) score += 1;
  }
  return score * Math.min(items.length, 10);
}

interface RoomsCandidate {
  path: string;
  score: number;
  sample: Record<string, unknown>;
}

/** Walks the JSON tree looking for the array that best resembles room offers. */
function findRoomsPath(root: unknown): { path: string; sample: Record<string, unknown> } | null {
  // Collected into an array rather than tracked in a `let` because the
  // assignment happens inside a closure, where TypeScript's control-flow
  // narrowing cannot see it and would infer the variable is still null.
  const candidates: RoomsCandidate[] = [];

  const visit = (node: unknown, path: string, depth: number) => {
    if (depth > 8 || node === null || typeof node !== "object") return;

    if (Array.isArray(node)) {
      const score = scoreArrayOfRooms(node);
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
  const best = candidates[0]!;
  return { path: best.path, sample: best.sample };
}

/** Finds a nested key matching any hint, returning its dotted path. */
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
      if (key.toLowerCase().includes(hint) && (typeof value === "string" || typeof value === "number")) {
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

/** Replaces literal values from the capture with template placeholders. */
function templatize(url: string): string {
  return url
    .replace(/(\d{4}-\d{2}-\d{2})/, "{checkIn}")
    .replace(/(\d{4}-\d{2}-\d{2})/, "{checkOut}")
    .replace(/([?&](?:promo|promoCode|rateCode|ratePlan|corporateCode)=)[^&]*/i, "$1{rateCode}")
    .replace(/([?&](?:adults|numAdults|adultCount)=)\d+/i, "$1{adults}")
    .replace(/([?&](?:children|numChildren|childCount|kids)=)\d+/i, "$1{children}");
}

async function main() {
  const [harPath, name] = process.argv.slice(2);
  if (!harPath || !name) {
    console.error("usage: har:import -- <file.har> <config-name>");
    process.exit(1);
  }

  const har = JSON.parse(await readFile(harPath, "utf8")) as { log: { entries: HarEntry[] } };

  const candidates: Array<{ entry: HarEntry; json: unknown; score: number; rooms: ReturnType<typeof findRoomsPath> }> = [];

  for (const entry of har.log.entries) {
    const text = entry.response.content.text;
    if (!text || entry.response.status !== 200) continue;
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      continue;
    }
    const rooms = findRoomsPath(json);
    if (rooms) candidates.push({ entry, json, score: text.length, rooms });
  }

  if (candidates.length === 0) {
    console.error(
      "No JSON response in this HAR looked like a list of room offers.\n" +
        "Make sure you captured the availability request itself (Fetch/XHR, status 200)\n" +
        "and that you exported *with content* — a HAR without response bodies cannot be used."
    );
    process.exit(1);
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0]!;
  const sample = best.rooms!.sample;

  const config = {
    name,
    capturedAt: new Date().toISOString().slice(0, 10),
    notes: `Auto-generated from ${harPath}. REVIEW BEFORE USE — especially rateCodeAppliedPath.`,
    request: {
      method: best.entry.request.method === "POST" ? "POST" : "GET",
      urlTemplate: templatize(best.entry.request.url),
      headers: Object.fromEntries(
        best.entry.request.headers
          .filter((h) => ["accept", "content-type", "accept-language"].includes(h.name.toLowerCase()))
          .map((h) => [h.name.toLowerCase(), h.value])
      ),
      ...(best.entry.request.postData?.text
        ? { bodyTemplate: templatize(best.entry.request.postData.text) }
        : {}),
      rpm: 12,
    },
    response: {
      roomsPath: best.rooms!.path,
      fields: {
        roomCode: guessField(sample, ROOM_CODE_HINTS) ?? "code",
        roomName: guessField(sample, ROOM_NAME_HINTS) ?? "name",
        nightly: guessField(sample, PRICE_HINTS) ?? "price",
        total: guessField(sample, TOTAL_HINTS) ?? undefined,
      },
      pricesAreCents: false,
    },
  };

  const outPath = join(process.cwd(), "config", "endpoints", `${name}.json`);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(config, null, 2) + "\n");

  console.log(`Wrote ${outPath}`);
  console.log("\nGuessed paths — verify these against the sample offer below:");
  console.log(JSON.stringify(config.response, null, 2));
  console.log("\nSample offer from the capture:");
  console.log(JSON.stringify(sample, null, 2).slice(0, 1500));
  console.log(
    "\nNext: set rateCodeAppliedPath so a silently-ignored promo code is detected.\n" +
      "See apps/api/src/collectors/hotels/README.md."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
