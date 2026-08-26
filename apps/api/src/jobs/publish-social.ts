import { closeDb } from "@ratecoaster/db";
import { runSocialPublisher } from "../social/publisher.js";

const send = process.argv.includes("--send");

runSocialPublisher({ send })
  .then((result) => {
    console.log(
      `[social] ${send ? "send" : "preview"} — ${result.generated} generated, ` +
        `${result.queued} queued, ${result.published} published, ${result.failed} failed`
    );
    for (const preview of result.previews) console.log(`\n[${preview.kind}]\n${preview.text}`);
    if (result.failed > 0) process.exitCode = 1;
  })
  .catch((error) => {
    console.error(`[social] failed: ${error instanceof Error ? error.stack : String(error)}`);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
