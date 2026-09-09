import { deriveParkState, type LiveWaitsResponse } from "@ratecoaster/shared";

const MAX_WAIT_AGE_MS = 30 * 60 * 1000;

export function busiestRides(parks: LiveWaitsResponse["parks"], now = new Date()) {
  return parks
    .filter(({ waits, hours }) => deriveParkState({ waits, hours, now }) !== "closed")
    .flatMap(({ waits }) => waits)
    .filter((wait) => {
      const age = now.getTime() - Date.parse(wait.observedAt);
      return wait.kind === "ride" && wait.status === "operating" &&
        wait.waitMinutes !== null && age >= 0 && age <= MAX_WAIT_AGE_MS;
    })
    .sort((a, b) => (b.waitMinutes ?? 0) - (a.waitMinutes ?? 0) ||
      a.attractionName.localeCompare(b.attractionName))
    .slice(0, 3);
}
