import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  shouldLoadTravelpayouts,
  TRAVELPAYOUTS_DRIVE_URL,
  travelpayoutsLoaderSource,
} from "./travelpayouts.js";

const webSource = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(path)
      : /\.(?:ts|tsx)$/.test(entry.name)
        ? [path]
        : [];
  });
}

test("Travelpayouts Drive loads on public planning and price pages", () => {
  for (const path of ["/", "/guides", "/guides/hotel-rates", "/hotels", "/plan", "/waits"]) {
    assert.equal(shouldLoadTravelpayouts(path), true, path);
  }
});

test("Travelpayouts Drive stays off private and legal pages", () => {
  for (const path of [
    "/account",
    "/account/trips",
    "/admin",
    "/admin/homepage",
    "/auth/error",
    "/join",
    "/privacy",
    "/terms",
  ]) {
    assert.equal(shouldLoadTravelpayouts(path), false, path);
  }

  assert.equal(shouldLoadTravelpayouts("/administrator-guide"), true);
});

test("the inline loader uses the assigned project and CMP marker", () => {
  const source = travelpayoutsLoaderSource();
  assert.match(source, new RegExp(TRAVELPAYOUTS_DRIVE_URL.replace(/[.?]/g, "\\$&")));
  assert.match(source, /data-cmp-ab/);
  assert.match(source, /script\.async = true/);
});

test("private-route navigation remains a full document load", () => {
  // Travelpayouts is intentionally installed at the document level. Ordinary
  // anchors unload that document before account/admin HTML arrives; converting
  // one to SPA navigation would keep third-party code resident across routes.
  const offenders = sourceFiles(webSource).filter((path) => {
    const source = readFileSync(path, "utf8");
    return /from\s+["']next\/link["']|router\.(?:push|replace)\s*\(/.test(source);
  });
  assert.deepEqual(offenders, []);
});
