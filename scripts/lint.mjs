import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOTS = ["apps", "packages"];
const SKIP_DIRS = new Set(["node_modules", "dist", ".next", ".expo", ".turbo"]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

const errors = [];

for (const root of ROOTS) {
  for (const file of walk(root)) {
    const rel = relative(process.cwd(), file).replaceAll("\\", "/");
    if (file.endsWith(".json")) {
      try {
        JSON.parse(readFileSync(file, "utf8"));
      } catch (err) {
        errors.push(`${rel}: invalid JSON (${err.message})`);
      }
      continue;
    }

    if (!/\.(ts|tsx|js|mjs|cjs)$/.test(file)) continue;
    const text = readFileSync(file, "utf8");

    // Prevent cross-app relative imports (e.g. mobile reaching into apps/web).
    if (rel.startsWith("apps/")) {
      const appName = rel.split("/")[1];
      for (const match of text.matchAll(/from\s+["']([^"']+)["']/g)) {
        const spec = match[1];
        if (spec.includes("/apps/") || /\.\.\/(web|api|mobile)\//.test(spec)) {
          errors.push(`${rel}: disallowed cross-app relative import "${spec}" from apps/${appName}`);
        }
      }
    }

    // Prevent global mutation of COLLECTOR_DRY_RUN in runtime source files.
    if (
      rel.startsWith("apps/api/src/") &&
      !rel.endsWith(".test.ts") &&
      /process\.env\.COLLECTOR_DRY_RUN\s*=/.test(text)
    ) {
      errors.push(`${rel}: do not mutate process.env.COLLECTOR_DRY_RUN; use runWithDryRun()`);
    }

    // Prevent stray debugger statements.
    if (!rel.endsWith(".test.ts") && /^\s*debugger;?\s*$/m.test(text)) {
      errors.push(`${rel}: stray debugger statement`);
    }
  }
}

if (errors.length > 0) {
  console.error("Lint checks failed:\n" + errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}

console.log("Lint checks passed.");
