/**
 * Is this park open, and what should the card say?
 *
 * The first version of this guessed from attraction statuses, and it was
 * wrong: shows and character meets keep reporting OPERATING long after the
 * gates shut, so a park at 11pm with 33 "operating" shows read as open. No
 * arrangement of status counting fixes that, because the upstream data simply
 * does not say what we were asking it.
 *
 * Published hours are the answer. Statuses are now only a fallback for a park
 * whose schedule we have not collected.
 */

export type ParkState = "open" | "closed" | "no-standby" | "no-data";

export interface ParkWaitSample {
  status: string;
  waitMinutes: number | null;
}

/**
 * Just the two fields this module needs.
 *
 * Structural rather than importing the wire schema's ParkHours, so the state
 * logic stays testable with two-line fixtures instead of a full row — and so
 * the two do not collide on a name.
 */
export interface OpeningWindow {
  /** ISO instants. Null means the schedule did not give one. */
  opensAt: string | null;
  closesAt: string | null;
}

export interface ParkStateInput {
  waits: ParkWaitSample[];
  /** Today's hours, when we have them. */
  hours?: OpeningWindow | null;
  now?: Date;
}

export function deriveParkState(input: ParkStateInput): ParkState {
  const { waits, hours } = input;
  const now = input.now ?? new Date();

  /*
   * Hours win over everything.
   *
   * If the schedule says the park is shut, it is shut — whatever the shows
   * claim. And if it says the park is open but nothing is posting a wait, that
   * is a real "open, no waits yet" (first thing in the morning), not a closure.
   */
  if (hours && (hours.opensAt || hours.closesAt)) {
    const opens = hours.opensAt ? new Date(hours.opensAt) : null;
    const closes = hours.closesAt ? new Date(hours.closesAt) : null;
    const beforeOpen = opens !== null && now < opens;
    const afterClose = closes !== null && now >= closes;
    if (beforeOpen || afterClose) return "closed";
  }

  if (waits.length === 0) return "no-data";

  const posting = waits.some((w) => w.status === "operating" && w.waitMinutes !== null);
  if (posting) return "open";

  /*
   * No schedule, nothing posting. Fall back to statuses — imperfect, but it is
   * all we have for a park with no published hours, and it is right during the
   * day when rides genuinely do report closed.
   */
  const anyOperating = waits.some((w) => w.status === "operating");
  return anyOperating ? "no-standby" : "closed";
}

/**
 * Times are rendered in the park's own timezone, in 12-hour form.
 *
 * A guest reads "9:00 AM" and thinks about their morning. Nobody planning a
 * theme-park day thinks in 21:00, and the park's local clock is the only one
 * that matters — a visitor from California still arrives at Orlando's 9am.
 */
export function formatParkTime(iso: string | null | undefined, timezone: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: timezone,
  })
    .format(date)
    // "9:00 AM" reads better than "9:00 AM" with a narrow no-break space,
    // which some runtimes emit and which copies badly.
    .replace(/ /g, " ");
}

/** "9:00 AM to 9:00 PM", or null when the schedule is unknown. */
export function formatParkHours(
  hours: OpeningWindow | null | undefined,
  timezone: string
): string | null {
  if (!hours) return null;
  const opens = formatParkTime(hours.opensAt, timezone);
  const closes = formatParkTime(hours.closesAt, timezone);
  if (opens && closes) return `${opens} to ${closes}`;
  if (opens) return `Opens ${opens}`;
  if (closes) return `Closes ${closes}`;
  return null;
}

export function parkStateMessage(
  state: ParkState,
  rideCount: number,
  walkOnCount: number,
  hours?: OpeningWindow | null,
  timezone = "America/New_York",
  now: Date = new Date()
): string {
  switch (state) {
    case "open":
      return `${rideCount} ${rideCount === 1 ? "ride" : "rides"} reporting · ${walkOnCount} at 15 min or less`;

    case "closed": {
      /*
       * "Closed" alone leaves the visitor to go and look up the hours. If the
       * park opens later today we can say when, which is the thing they were
       * about to ask.
       */
      const opens = hours?.opensAt ? new Date(hours.opensAt) : null;
      if (opens && now < opens) {
        const at = formatParkTime(hours!.opensAt, timezone);
        return at ? `Closed — opens at ${at}` : "Closed right now";
      }
      return "Closed for the day — waits return tomorrow";
    }

    case "no-standby":
      return "Open, but no rides are posting a wait yet";

    case "no-data":
      return "No report from this park yet";
  }
}
