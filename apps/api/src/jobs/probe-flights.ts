/**
 * Sends one real request to the flight price API and prints what came back.
 *
 *   npm run -w @ratecoaster/api flights:probe -- NYC MCO 5
 *
 * This exists because the parser in `travelpayouts.ts` was written from the
 * published docs, not from a live response. Documented shapes and served shapes
 * drift — that is the single most common way a collector goes quietly wrong —
 * and the honest thing is to say so and give you a one-command way to check
 * before any of it is trusted.
 *
 * It prints the raw body first and the parsed result second, so a mismatch
 * between them is visible rather than inferred.
 */
import { politeFetch } from "../collectors/framework/http.js";
import { parseCalendar, readCredentials } from "../collectors/flights/travelpayouts.js";
import { todayInTimezone } from "../collectors/framework/dates.js";

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const origin = (args[0] ?? "NYC").toUpperCase();
  const destination = (args[1] ?? "MCO").toUpperCase();
  const length = Number(args[2] ?? "5");

  const creds = readCredentials();
  if (!creds) {
    console.error(
      "TRAVELPAYOUTS_TOKEN is not set (or is still a placeholder).\n\n" +
        "  1. Sign up at https://www.travelpayouts.com\n" +
        "  2. Join the Aviasales programme\n" +
        "  3. Copy your API token into .env as TRAVELPAYOUTS_TOKEN=...\n"
    );
    process.exit(1);
  }

  // Two months out: near enough that the cache is warm, far enough that we are
  // not looking at the ragged last-minute end of the curve.
  const today = todayInTimezone("America/New_York");
  const [y, m] = today.split("-").map(Number);
  const month = m! + 2 > 12 ? `${y! + 1}-${String(m! + 2 - 12).padStart(2, "0")}` : `${y}-${String(m! + 2).padStart(2, "0")}`;

  const url = new URL("https://api.travelpayouts.com/v1/prices/calendar");
  url.searchParams.set("origin", origin);
  url.searchParams.set("destination", destination);
  url.searchParams.set("departure_date", month);
  url.searchParams.set("calendar_type", "departure_date");
  url.searchParams.set("length", String(length));
  url.searchParams.set("currency", "USD");

  console.log(`\nGET ${url.toString()}\n`);

  /*
   * `alwaysSend` bypasses the dry-run guard. Justified here and nowhere else:
   * the entire purpose of this command is to send exactly one real request, the
   * operator typed it deliberately, and the endpoint belongs to a partner who
   * wants our traffic.
   */
  const res = await politeFetch(url.toString(), {
    headers: { "x-access-token": creds.token },
    alwaysSend: true,
  });

  console.log(`HTTP ${res.status}\n`);
  console.log("--- raw body (first 2000 chars) ---");
  console.log(res.body.slice(0, 2000));
  console.log("\n--- parsed ---");

  let payload: unknown;
  try {
    payload = JSON.parse(res.body);
  } catch {
    console.error("Response was not JSON. The parser cannot handle this as-is.");
    process.exit(1);
  }

  const entries = parseCalendar(payload);
  if (entries.length === 0) {
    console.error(
      "\nParsed 0 entries.\n\n" +
        "If the raw body above clearly contains prices, the shape has changed and\n" +
        "parseCalendar() needs updating — do NOT switch the collector off dry run\n" +
        "until this prints rows."
    );
    process.exit(1);
  }

  console.table(
    entries.slice(0, 12).map((e) => ({
      date: e.departDate,
      price: `$${(e.priceCents / 100).toFixed(2)}`,
      airline: e.airline ?? "—",
      stops: e.transfers ?? "—",
      expires: e.expiresAt ?? "—",
    }))
  );

  const prices = entries.map((e) => e.priceCents);
  console.log(
    `\n${entries.length} dates parsed for ${origin}->${destination} in ${month}, ` +
      `${length}-night trips. Cheapest $${(Math.min(...prices) / 100).toFixed(2)}, ` +
      `dearest $${(Math.max(...prices) / 100).toFixed(2)}.\n`
  );
  console.log(
    "If those look plausible, the parser is good. Switch the collector off dry run\n" +
      "in the admin portal under Collectors -> flight-prices.\n"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
