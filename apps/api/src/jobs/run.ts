import { closeDb } from "@parkpulse/db";
import { runAll, runCollector } from "../collectors/framework/runner.js";
import { COLLECTORS } from "./registry.js";

export { COLLECTORS };

/**
 * CLI entry point for scheduled collection.
 *
 *   npm run collect                        # every collector once
 *   npm run collect -- --only wait-times   # one collector
 *   npm run collect -- --list              # what exists and how often it runs
 *   npm run collect -- --dry-run           # log requests, send nothing
 *
 * In production, drive this from cron or your platform's scheduler rather than
 * keeping a long-lived process: a crashed scheduler that nobody notices is a
 * worse failure mode than a cron job that visibly did not run.
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--list")) {
    for (const c of COLLECTORS) {
      console.log(`${c.name.padEnd(16)} every ${String(c.intervalMinutes).padStart(4)}m  ${c.description}`);
    }
    return;
  }

  if (args.includes("--dry-run")) process.env.COLLECTOR_DRY_RUN = "1";

  const onlyIndex = args.indexOf("--only");
  const only = onlyIndex >= 0 ? args[onlyIndex + 1] : null;

  const selected = only ? COLLECTORS.filter((c) => c.name === only) : COLLECTORS;
  if (only && selected.length === 0) {
    console.error(`unknown collector: ${only}`);
    console.error(`available: ${COLLECTORS.map((c) => c.name).join(", ")}`);
    process.exit(1);
  }

  const results = selected.length === 1 ? [await runCollector(selected[0]!)] : await runAll(selected);

  console.log("\n--- summary ---");
  for (const r of results) {
    const detail =
      r.status === "skipped"
        ? r.reason ?? ""
        : `${r.parsedCount} parsed, ${r.writtenCount} written, ${r.errorCount} errors`;
    console.log(`${r.status.padEnd(8)} ${r.collector.padEnd(16)} ${detail}`);
  }

  // A failed run should fail the job so your scheduler surfaces it. "Skipped"
  // is not a failure — an unconfigured collector is an expected state here.
  const failed = results.some((r) => r.status === "failed");
  await closeDb();
  process.exit(failed ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await closeDb();
  process.exit(1);
});
