import { build } from "esbuild";
import { rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

rmSync(resolve(root, "dist"), { recursive: true, force: true });

const externalThirdParty = {
  name: "external-third-party",
  setup(buildCtx) {
    buildCtx.onResolve({ filter: /^[^./]/ }, (args) => {
      // Inline workspace packages (@ratecoaster/db, @ratecoaster/shared) so
      // `node dist/index.js` runs with zero runtime TypeScript transpilation,
      // while keeping native/npm runtime dependencies (sharp, postgres, hono) external.
      if (args.path.startsWith("@ratecoaster/")) return undefined;
      return { path: args.path, external: true };
    });
  },
};

const entryPoints = [
  "src/index.ts",
  "src/jobs/run.ts",
  "src/jobs/rollup.ts",
  "src/jobs/archive-crowds.ts",
  "src/jobs/dispatch-alerts.ts",
  "src/jobs/publish-social.ts",
  "src/jobs/grant-admin.ts",
  "src/jobs/login-link.ts",
  "src/jobs/verify-endpoint.ts",
  "src/jobs/probe-flights.ts",
  "src/jobs/seed-affiliate-links.ts",
  "src/jobs/smoke-waits.ts",
  "src/collectors/hotels/har-import.ts",
];

await build({
  absWorkingDir: root,
  entryPoints,
  outdir: "dist",
  outbase: "src",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: true,
  splitting: true,
  chunkNames: "chunks/[name]-[hash]",
  plugins: [externalThirdParty],
  logLevel: "info",
});
