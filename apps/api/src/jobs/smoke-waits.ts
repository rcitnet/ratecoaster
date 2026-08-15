/**
 * Live smoke test for the wait-time providers. No database required.
 *
 *   npm run -w @ratecoaster/api smoke:waits
 *
 * Hits both providers for every seeded park and prints what the parsers made of
 * the response. This is the fastest way to answer "is the upstream still shaped
 * the way we think it is" without standing up Postgres.
 */
import { PARKS } from "@ratecoaster/db/src/seed-data.js";
import { fetchQueueTimes, fetchThemeParksWiki } from "../collectors/waits/providers.js";

async function main() {
  let totalParsed = 0;
  let failures = 0;

  for (const park of PARKS) {
    console.log(`\n=== ${park.name} ===`);

    if (park.queueTimesId === null && park.themeParksWikiId === null) {
      console.log("  no provider coverage yet — skipped");
      continue;
    }

    for (const provider of ["themeparks", "queue-times"] as const) {
      try {
        const waits =
          provider === "themeparks"
            ? park.themeParksWikiId
              ? await fetchThemeParksWiki(park.themeParksWikiId)
              : null
            : park.queueTimesId !== null
              ? await fetchQueueTimes(park.queueTimesId)
              : null;

        if (waits === null) {
          console.log(`  ${provider.padEnd(12)} no id configured`);
          continue;
        }

        const rides = waits.filter((w) => w.kind === "ride");
        const open = rides.filter((w) => w.status === "operating" && w.waitMinutes !== null);
        const withSingleRider = waits.filter((w) => w.singleRiderMinutes !== null);
        const longest = [...open].sort((a, b) => (b.waitMinutes ?? 0) - (a.waitMinutes ?? 0))[0];

        totalParsed += waits.length;

        console.log(
          `  ${provider.padEnd(12)} ${String(waits.length).padStart(3)} entities  ` +
            `${String(rides.length).padStart(3)} rides  ` +
            `${String(open.length).padStart(3)} open  ` +
            `${String(withSingleRider.length).padStart(2)} single-rider`
        );
        if (longest) {
          console.log(`  ${" ".repeat(12)} longest: ${longest.name} — ${longest.waitMinutes}m`);
        }
      } catch (err) {
        failures++;
        console.log(`  ${provider.padEnd(12)} FAILED: ${String(err)}`);
      }
    }
  }

  console.log(`\nparsed ${totalParsed} entities across all providers, ${failures} provider failures`);
  // A parser that returns zero rows without throwing is the failure mode worth
  // catching here, so it exits non-zero too.
  if (totalParsed === 0 || failures > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
