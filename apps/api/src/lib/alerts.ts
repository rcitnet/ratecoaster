/**
 * When to send a price-drop alert — and, far more often, when not to.
 *
 * The hard part of alerting is not detecting a drop. It is not sending five
 * emails about the same drop. A tracker that cries wolf gets filtered to spam
 * within a week, and then it cannot deliver the one alert that mattered.
 *
 * Kept free of the database so every rule below can be tested directly against
 * known inputs, rather than only through a live Postgres with real collector
 * data in it.
 */

export type AlertKind = "price-drop" | "new-low" | "beats-booking";

export interface WatchState {
  /** What the user asked to be told about. Null means "any drop". */
  thresholdCents: number | null;
  /** What they already paid, if they told us. */
  bookedNightlyCents: number | null;
  /** The figure in the last alert we sent for this watch. */
  lastNotifiedCents: number | null;
  lastNotifiedAt: Date | null;
}

export interface AlertDecision {
  notify: boolean;
  kind: AlertKind | null;
  /** Human-readable, and the reason is recorded whether or not we send. */
  reason: string;
}

/**
 * Minimum gap between alerts for one watch.
 *
 * Hotel rates can oscillate by a few dollars many times a day. Without a floor,
 * a single volatile date would generate a dozen emails before lunch.
 */
export const COOLDOWN_HOURS = 12;

/**
 * How much cheaper a price must be than the last alerted one to be worth a
 * second email. Five dollars on a room is noise; nobody re-books for it.
 */
export const MIN_IMPROVEMENT_CENTS = 500;

export function evaluateWatch(
  watch: WatchState,
  currentTotalCents: number | null,
  now: Date = new Date()
): AlertDecision {
  if (currentTotalCents === null) {
    return { notify: false, kind: null, reason: "no complete price for the stay" };
  }

  /*
   * Cooldown first, before any of the interesting logic.
   *
   * Checking it last would mean a genuine new low silently resets nothing and
   * the next run alerts anyway. Gating at the top makes the quiet period
   * actually quiet.
   */
  if (watch.lastNotifiedAt) {
    const hours = (now.getTime() - watch.lastNotifiedAt.getTime()) / 3_600_000;
    if (hours < COOLDOWN_HOURS) {
      return { notify: false, kind: null, reason: `cooling down (${hours.toFixed(1)}h of ${COOLDOWN_HOURS}h)` };
    }
  }

  /*
   * Never repeat a price we have already sent, and require the improvement to
   * be meaningful. This is what stops the same drop generating an alert every
   * time the collector runs.
   */
  if (watch.lastNotifiedCents !== null) {
    const improvement = watch.lastNotifiedCents - currentTotalCents;
    if (improvement < MIN_IMPROVEMENT_CENTS) {
      return {
        notify: false,
        kind: null,
        reason: `not meaningfully below the last alert (${improvement} cents)`,
      };
    }
  }

  /*
   * An explicit threshold is an instruction, so it wins over everything else.
   * The user said "tell me at this number" — not "tell me when it moves".
   */
  if (watch.thresholdCents !== null) {
    return currentTotalCents <= watch.thresholdCents
      ? { notify: true, kind: "price-drop", reason: "at or below your target" }
      : { notify: false, kind: null, reason: "above your target" };
  }

  /*
   * Beating a booking the user already holds is the single most valuable alert
   * this product can send, so it is checked before a generic drop and labelled
   * differently — the email can say "you can rebook and save $340".
   */
  if (watch.bookedNightlyCents !== null) {
    return currentTotalCents < watch.bookedNightlyCents
      ? { notify: true, kind: "beats-booking", reason: "cheaper than what you booked" }
      : { notify: false, kind: null, reason: "not below your booked rate" };
  }

  // No threshold, no booking: any meaningful drop below the last alert.
  if (watch.lastNotifiedCents === null) {
    /*
     * First-ever evaluation. Deliberately silent: alerting on the first price
     * we happen to see would be an alert about nothing having changed, which
     * teaches the recipient that our emails are not worth opening.
     */
    return { notify: false, kind: null, reason: "first observation, nothing to compare" };
  }

  return { notify: true, kind: "new-low", reason: "lower than the last price we told you about" };
}

/** Sum a stay, refusing to guess across nights we never collected. */
export function totalForStay(
  nightlyByDate: Map<string, number>,
  nights: string[]
): number | null {
  let total = 0;
  for (const night of nights) {
    const cents = nightlyByDate.get(night);
    // One missing night invalidates the total. Extrapolating would invent a
    // price, and an alert built on an invented price is worse than no alert.
    if (cents === undefined) return null;
    total += cents;
  }
  return nights.length > 0 ? total : null;
}
