/**
 * Sends exactly ONE request through an endpoint config and prints what the
 * parser made of it. Nothing is written to the database.
 *
 *   npm run -w @parkpulse/api verify:endpoint -- loews-universal PBH
 *
 * This is the step between "I captured a HAR" and "I turned on a 16,000-request
 * crawl". One request tells you whether your paths are right; discovering they
 * were wrong after a full pass means a day of junk data and a day of traffic
 * you cannot take back.
 */
import { closeDb } from "@parkpulse/db";
import { loadEndpointConfig } from "../collectors/hotels/endpoint-config.js";
import { queryOffers } from "../collectors/hotels/index.js";
import { addDays, todayInTimezone } from "../collectors/framework/dates.js";

async function main() {
  const [name, hotelCode, rateCodeArg] = process.argv.slice(2);
  if (!name) {
    console.error("usage: verify:endpoint -- <config-name> [hotelCode] [rateCode]");
    process.exit(1);
  }

  const endpoint = await loadEndpointConfig(name);
  if (!endpoint) {
    console.error(`No config at config/endpoints/${name}.json`);
    console.error("Capture one first — see apps/api/src/collectors/hotels/README.md");
    process.exit(1);
  }

  const rateCode = rateCodeArg ?? "APH";
  // 45 days out: far enough that rates are published, near enough to be real.
  const checkIn = addDays(todayInTimezone("America/New_York"), 45);

  // This is a real outbound request, so the dry-run guard is lifted explicitly
  // for this one call rather than by changing the environment.
  const previous = process.env.COLLECTOR_DRY_RUN;
  process.env.COLLECTOR_DRY_RUN = "0";

  console.log(`config:   ${name}`);
  console.log(`hotel:    ${hotelCode ?? "(none)"}`);
  console.log(`rateCode: ${rateCode}`);
  console.log(`checkIn:  ${checkIn}\n`);

  try {
    const result = await queryOffers(endpoint, {
      hotelCode: hotelCode ?? "",
      checkIn,
      checkOut: addDays(checkIn, 1),
      nights: 1,
      adults: 2,
      children: 0,
      rateCode: rateCode === "STANDARD" ? "" : rateCode,
      currency: "USD",
    });

    if (result === null) {
      console.error("Request was skipped — is COLLECTOR_DRY_RUN forced on elsewhere?");
      process.exit(1);
    }

    if (!result.rateCodeApplied) {
      console.warn(
        `WARNING: rate code ${rateCode} was NOT applied.\n` +
          "The engine quoted the public rate instead. Either the passholder rate is\n" +
          "not published for this date, or rateCodeAppliedPath is pointing at the\n" +
          "wrong field. Offers below would be DISCARDED by the collector.\n"
      );
    }

    console.log(`parsed ${result.offers.length} offers:\n`);
    for (const offer of result.offers) {
      const nightly = (offer.nightlyCents / 100).toFixed(2);
      const total = offer.totalCents ? (offer.totalCents / 100).toFixed(2) : "—";
      console.log(
        `  ${offer.roomCode.padEnd(10)} ${offer.roomName.slice(0, 40).padEnd(42)} $${nightly.padStart(8)}/night   total $${total}`
      );
    }

    if (result.offers.length === 0) {
      console.error(
        "\nZero offers parsed. Usually roomsPath is wrong, or the response was an\n" +
          "error page rather than availability JSON. Re-check against the HAR sample."
      );
      process.exitCode = 1;
    }
  } finally {
    if (previous === undefined) delete process.env.COLLECTOR_DRY_RUN;
    else process.env.COLLECTOR_DRY_RUN = previous;
    await closeDb();
  }
}

main().catch(async (err) => {
  console.error(err);
  await closeDb();
  process.exit(1);
});
