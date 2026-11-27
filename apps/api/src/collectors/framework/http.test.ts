import assert from "node:assert/strict";
import { test } from "node:test";
import { isDryRunActive, runWithDryRun } from "./http.js";

test("runWithDryRun isolates concurrent async executions without mutating process.env", async () => {
  const previous = process.env.COLLECTOR_DRY_RUN;
  process.env.COLLECTOR_DRY_RUN = "1";
  try {
    const [dry, live] = await Promise.all([
      runWithDryRun(true, async () => {
        await new Promise((resolve) => setTimeout(resolve, 15));
        return isDryRunActive();
      }),
      runWithDryRun(false, async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return isDryRunActive();
      }),
    ]);

    assert.equal(dry, true);
    assert.equal(live, false);
    assert.equal(process.env.COLLECTOR_DRY_RUN, "1");
  } finally {
    if (previous === undefined) delete process.env.COLLECTOR_DRY_RUN;
    else process.env.COLLECTOR_DRY_RUN = previous;
  }
});
