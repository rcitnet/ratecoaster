import type { GateInfo } from "@ratecoaster/shared";

/**
 * The upgrade prompt shown where the free window runs out.
 *
 * Written to be generous rather than nagging. It names exactly what is waiting
 * (a specific number of days, not "more"), says plainly that it costs nothing,
 * and never blocks the content already on screen. People planning a big trip
 * are being asked to trust this site with a real purchase decision; an
 * aggressive wall reads as a bait-and-switch and loses that trust.
 */
export function Paywall({
  gate,
  what = "rates",
  returnTo = "/",
}: {
  gate: GateInfo;
  what?: string;
  returnTo?: string;
}) {
  if (!gate.gated) return null;

  const proTier = gate.requiredTier === "pro";

  return (
    <section className="paywall" style={{ marginTop: 28 }}>
      <div className="hero-kicker" style={{ marginBottom: 14 }}>
        {proTier ? "Coming soon" : "Free — no card needed"}
      </div>

      <h2>
        {proTier
          ? "Deeper insights are coming with Pro"
          : `${gate.withheldDays} more days of ${what} are waiting`}
      </h2>

      <p>
        {proTier
          ? "Cross-hotel comparisons and best-time-to-book modelling will arrive with the Pro plan."
          : `You're seeing the next ${gate.visibleDays} days. Create a free account and the full 365-day calendar unlocks instantly — including the quiet weeks next autumn when rooms are cheapest.`}
      </p>

      {!proTier ? (
        <>
          <div className="paywall-actions">
            <a
              href={`/join?next=${encodeURIComponent(returnTo)}`}
              className="btn btn-primary btn-lg"
            >
              Unlock the full year — free
            </a>
            <a href={`/join?next=${encodeURIComponent(returnTo)}`} className="btn btn-ghost btn-lg"
               style={{ borderColor: "rgba(255,255,255,0.3)", color: "#fff" }}>
              I already have an account
            </a>
          </div>

          <div className="paywall-perks">
            <span className="paywall-perk">
              <b>365 days</b> of rates
            </span>
            <span className="paywall-perk">
              <b>Price history</b> charts
            </span>
            <span className="paywall-perk">
              <b>Drop alerts</b> by email
            </span>
            <span className="paywall-perk">
              <b>5 trips</b> watched at once
            </span>
          </div>
        </>
      ) : null}
    </section>
  );
}

/** Compact inline variant for sidebars and narrow slots. */
export function PaywallInline({ gate, returnTo = "/" }: { gate: GateInfo; returnTo?: string }) {
  if (!gate.gated) return null;
  return (
    <div className="notice" style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
      <span style={{ flex: 1, minWidth: 220 }}>
        <b>{gate.withheldDays} more days</b> are available with a free account.
      </span>
      <a href={`/join?next=${encodeURIComponent(returnTo)}`} className="btn btn-blue btn-sm">
        Unlock free
      </a>
    </div>
  );
}
