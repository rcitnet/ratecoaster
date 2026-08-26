import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

/**
 * The site must not promise what it cannot do.
 *
 * This exists because it happened. The signup page said "we email you the
 * moment your dates get cheaper" and "watch 5 trips at once" for weeks while
 * /v1/watches did not exist. Nothing failed: the tables were designed, the
 * types were written, the typed client had createWatch(), and every one of
 * those compiles perfectly against an endpoint that was never mounted.
 *
 * TypeScript cannot tell "this endpoint exists" from "this endpoint was
 * described". So the check has to be this one — read the marketing copy, and
 * assert the thing it claims is actually served.
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const apiIndex = join(repoRoot, "apps/api/src/index.ts");
const webApp = join(repoRoot, "apps/web/src/app");

function mountedRoutes(): string[] {
  const source = readFileSync(apiIndex, "utf8");
  return [...source.matchAll(/app\.route\(\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]!);
}

function pageText(relative: string): string {
  try {
    return readFileSync(join(webApp, relative), "utf8");
  } catch {
    return "";
  }
}

/**
 * Each entry: a promise the site makes, the page that makes it, and the API
 * route that has to exist for the promise to be true.
 *
 * Adding a claim to the site means adding a line here. That is the point — it
 * forces the question "what serves this?" at the moment the copy is written,
 * which is the moment it is cheapest to answer.
 */
const CLAIMS: Array<{ claim: string; page: string; needs: string }> = [
  { claim: "Rate-drop alerts", page: "join/page.tsx", needs: "/v1/watches" },
  { claim: "Watch 5 trips at once", page: "join/page.tsx", needs: "/v1/watches" },
  { claim: "Your watchlist", page: "join/page.tsx", needs: "/v1/watches" },
  { claim: "Rate-drop alerts", page: "account/page.tsx", needs: "/v1/watches" },
  { claim: "Trips you", page: "account/page.tsx", needs: "/v1/watches" },
];

test("every feature the site advertises has a route behind it", () => {
  const routes = mountedRoutes();
  const failures: string[] = [];

  for (const { claim, page, needs } of CLAIMS) {
    const text = pageText(page);
    if (!text.includes(claim)) {
      // The copy changed. Not a failure — but the entry is now dead and should
      // be removed rather than left to rot into a check that tests nothing.
      failures.push(`stale entry: "${claim}" is no longer on ${page}`);
      continue;
    }
    if (!routes.includes(needs)) {
      failures.push(`${page} promises "${claim}" but ${needs} is not mounted`);
    }
  }

  assert.deepEqual(failures, [], `\n  ${failures.join("\n  ")}\n`);
});

test("the routes this project depends on are actually mounted", () => {
  const routes = mountedRoutes();
  for (const required of [
    "/v1/rates",
    "/v1/tickets",
    "/v1/waits",
    "/v1/watches",
    "/v1/auth",
    "/v1/outbound",
  ]) {
    assert.ok(routes.includes(required), `${required} is not mounted in apps/api/src/index.ts`);
  }
});

/**
 * The typed client is the other half of the trap.
 *
 * Its methods are generated from schemas, not from the server's route table, so
 * a method for an unimplemented endpoint looks identical at compile time to one
 * that works. Any client method calling a /v1/ path must have that path mounted.
 */
test("no client method points at an unmounted path", () => {
  const client = readFileSync(join(repoRoot, "packages/shared/src/client.ts"), "utf8");
  const routes = mountedRoutes();

  const paths = [...client.matchAll(/["'`](\/v1\/[a-z-]+)/g)].map((m) => m[1]!);
  const unique = [...new Set(paths)];

  const orphans = unique.filter(
    (p) => !routes.some((r) => p === r || p.startsWith(`${r}/`))
  );

  assert.deepEqual(
    orphans,
    [],
    `client calls paths with no mounted route: ${orphans.join(", ")}`
  );
});

/**
 * The third way a promise goes hollow: the feature exists, and nothing runs it.
 *
 * A scheduled job is invisible when broken. cron reports to nobody, a failed
 * command appends a line to a log file no one opens, and the site goes on
 * advertising a nightly digest that has not run since the script was renamed.
 * Every `npm run` in the crontab is therefore checked against the package.json
 * it would actually resolve against — root for a bare name, the named workspace
 * for `-w`.
 *
 * The trap this closes is specific and real: `alerts:dispatch` is declared in
 * apps/api/package.json and NOT at the root, so `npm run alerts:dispatch` from
 * the repo root fails with "Missing script" while the identical-looking
 * `npm run -w @ratecoaster/api alerts:dispatch` succeeds.
 */
test("every scheduled command resolves to a declared script", () => {
  const cron = readFileSync(join(repoRoot, "deploy/ratecoaster.cron"), "utf8");

  const scriptsOf = (pkg: string): Set<string> => {
    const raw = readFileSync(join(repoRoot, pkg, "package.json"), "utf8");
    return new Set(Object.keys((JSON.parse(raw) as { scripts?: object }).scripts ?? {}));
  };

  const workspaceDirs = new Map([
    ["@ratecoaster/api", "apps/api"],
    ["@ratecoaster/web", "apps/web"],
    ["@ratecoaster/db", "packages/db"],
    ["@ratecoaster/shared", "packages/shared"],
  ]);

  const missing: string[] = [];

  for (const line of cron.split("\n")) {
    if (line.trim().startsWith("#") || !line.includes("npm run")) continue;

    for (const m of line.matchAll(/npm run (?:-w (\S+) )?([\w:-]+)/g)) {
      const [, workspace, script] = m;
      const dir = workspace ? workspaceDirs.get(workspace) : ".";

      if (dir === undefined) {
        missing.push(`unknown workspace ${workspace}`);
        continue;
      }
      if (!scriptsOf(dir).has(script!)) {
        missing.push(workspace ? `${workspace} has no "${script}"` : `root has no "${script}"`);
      }
    }
  }

  assert.deepEqual(missing, [], `crontab calls scripts that do not exist: ${missing.join("; ")}`);
});
