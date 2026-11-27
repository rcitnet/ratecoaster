import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Cross-platform test file discovery for Node's built-in test runner.
 *
 * Avoids both Windows cmd.exe glob limitations and brittle hand-maintained file
 * lists that silently drop newly added `*.test.ts` files.
 */
function findTests(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".next") {
      continue;
    }
    const full = join(dir, entry.name);
    if (entry.isDirectory()) findTests(full, out);
    else if (entry.isFile() && entry.name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

const targetDir = process.argv[2] ?? "src";
const files = findTests(targetDir).sort().map((file) => relative(process.cwd(), file));

if (files.length === 0) {
  console.log(`No *.test.ts files found under ${targetDir}`);
  process.exit(0);
}

const result = spawnSync(process.execPath, ["--import", "tsx", "--test", ...files], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);
