import { closeDb } from "@ratecoaster/db";
import { archiveCrowds } from "../lib/crowd-archive.js";

try {
  const result = await archiveCrowds({ backfill: process.argv.includes("--backfill") });
  console.log(JSON.stringify(result));
  // Persisted warnings appear in the admin dashboard; cron also reports an unhealthy run.
  process.exitCode = result.parks.some(park => park.issues.length > 0) ? 2 : 0;
} catch (error) {
  console.error(`Crowd archive failed (${error instanceof Error ? error.name : "unknown error"}). The last completed check remains visible in admin status.`);
  process.exitCode = 1;
} finally {
  await closeDb();
}
