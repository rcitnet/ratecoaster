/**
 * Why a park has no posted average.
 *
 * The homepage used to render one message — "no operating attractions
 * reporting" — for three very different situations, and it read as a fault in
 * all of them. A park shut for the night is not a broken feed.
 *
 * Lives here, pure and tested, because the interesting case is the one that is
 * hardest to reproduce on demand: a park that is open with rides posting waits.
 * Verifying that by loading the site only works during park hours.
 */

export type ParkState = "open" | "closed" | "no-standby" | "no-data";

export interface ParkWaitSample {
  status: string;
  waitMinutes: number | null;
}

export function deriveParkState(waits: ParkWaitSample[]): ParkState {
  if (waits.length === 0) return "no-data";

  const posting = waits.some((w) => w.status === "operating" && w.waitMinutes !== null);
  if (posting) return "open";

  /*
   * Shows and character meets report OPERATING with no standby queue — they
   * have showtimes, not a line to measure. A park running only those is open,
   * and saying "closed" would be wrong in the other direction.
   */
  const anyOperating = waits.some((w) => w.status === "operating");
  return anyOperating ? "no-standby" : "closed";
}

export function parkStateMessage(
  state: ParkState,
  rideCount: number,
  walkOnCount: number
): string {
  switch (state) {
    case "open":
      return `${rideCount} rides reporting · ${walkOnCount} at 15 min or less`;
    case "closed":
      return "Closed right now — waits return when the park opens";
    case "no-standby":
      return "Open, but only shows and character meets are running";
    case "no-data":
      return "No report from this park yet";
  }
}
