import assert from "node:assert/strict";
import test from "node:test";
import { CrowdCalendarDay, CrowdCalendarQuery } from "@ratecoaster/shared";
import { addDays, dateRange } from "../collectors/framework/dates.js";
import { archiveScheduleIssues, crowdMonthWindows, evaluateCrowdCoverage, mergeArchivedCrowds } from "./crowd-archive-rules.js";

const today = "2026-09-30";
const now = new Date("2026-09-30T18:00:00Z");
const estimate = (date: string, score = 3): CrowdCalendarDay => ({ date, score, level: "low", confidence: "high", signals: ["ticket", "express", "hotel"] });

test("saved history remains stable when live pricing changes or disappears", () => {
  const stored = { ...estimate("2026-08-18", 3.2), reconstructed: true };
  const changed = estimate("2026-08-18", 8);
  assert.equal(mergeArchivedCrowds([changed], [stored], today)[0]?.score, 3.2);
  assert.equal(mergeArchivedCrowds([], [stored], today)[0]?.score, 3.2);
  assert.equal(mergeArchivedCrowds([], [stored], today)[0]?.reconstructed, true);
});

test("fresh future estimates replace saved forecasts while missing live signals use the archive", () => {
  const saved = estimate("2026-10-01", 3.2);
  assert.equal(mergeArchivedCrowds([estimate(saved.date, 4)], [saved], today)[0]?.score, 4);
  assert.equal(mergeArchivedCrowds([{ ...estimate(saved.date), signals: [] }], [saved], today)[0]?.score, 3.2);
  assert.equal(mergeArchivedCrowds([{ ...estimate(saved.date), signals: [] }], [], today).length, 0);
});

test("archive scoring uses full months, including leap years and December boundaries", () => {
  assert.deepEqual(crowdMonthWindows("2024-02-15", "2024-03-03"), [{ from: "2024-02-01", to: "2024-02-29" }, { from: "2024-03-01", to: "2024-03-03" }]);
  assert.deepEqual(crowdMonthWindows("2026-12-01", "2027-01-31"), [{ from: "2026-12-01", to: "2026-12-31" }, { from: "2027-01-01", to: "2027-01-31" }]);
});

function healthyCoverage() {
  const days = dateRange(addDays(today, -1), 31).map(date => estimate(date));
  const sourceTimes = Object.fromEntries(days.map(day => [day.date, { ticket: now.toISOString(), express: now.toISOString(), hotel: now.toISOString() }]));
  return { today, days, sourceTimes, now };
}

test("healthy archival coverage does not create alerts", () => {
  assert.deepEqual(evaluateCrowdCoverage(healthyCoverage()), []);
});

test("a missed date is reported with the affected date even if other dates are healthy", () => {
  const coverage = healthyCoverage();
  coverage.days = coverage.days.filter(day => day.date !== "2026-10-02");
  const issue = evaluateCrowdCoverage(coverage).find(issue => issue.kind === "missing-data");
  assert.deepEqual(issue?.dates, ["2026-10-02"]);
});

test("retained estimates prevent gaps while stale or missing source signals still raise alerts", () => {
  const coverage = healthyCoverage();
  coverage.sourceTimes[today]!.express = "2026-09-29T00:00:00Z";
  delete (coverage.sourceTimes["2026-10-01"] as { ticket?: string }).ticket;
  const issues = evaluateCrowdCoverage(coverage);
  assert.equal(issues.some(issue => issue.kind === "missing-data"), false);
  assert.equal(issues.filter(issue => issue.kind === "stale-signals").length, 2);
});

test("a never-run or stopped archive is reported independently of saved data", () => {
  assert.equal(archiveScheduleIssues(null, now)[0]?.kind, "archive-late");
  assert.equal(archiveScheduleIssues(new Date("2026-09-30T14:59:00Z"), now)[0]?.kind, "archive-late");
  assert.deepEqual(archiveScheduleIssues(new Date("2026-09-30T17:00:00Z"), now), []);
});

test("archive flags survive response validation without changing the relative-score contract", () => {
  const stored = CrowdCalendarDay.parse({ ...estimate(today), archived: true, reconstructed: true });
  assert.equal(stored.archived, true);
  assert.equal(stored.reconstructed, true);
  assert.equal(CrowdCalendarQuery.safeParse({ from: "2015-08-01", to: "2015-08-31" }).success, true);
});

test("crowd data alerts cannot be read without an admin session", async () => {
  const { adminRouter } = await import("../routes/admin.js");
  const response = await adminRouter.request("/crowd-archive");
  assert.equal(response.status, 404);
});
