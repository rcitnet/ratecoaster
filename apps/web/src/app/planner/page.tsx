import { centsToDisplay, ORIGINS, RATE_CODE_LABELS, type TripCostDay } from "@ratecoaster/shared";
import {
  dayNumber,
  dayOfWeekLabel,
  EMPTY_GATE,
  formatLongDate,
  getClient,
  getMe,
  safe,
} from "@/lib/api";
import { AffiliateDisclosure } from "@/components/AffiliateDisclosure";
import { CompareButton } from "@/components/CompareButton";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Trip cost calendar — when is Universal cheapest?",
  description:
    "Hotel, tickets and travel added up for every possible start date, so you can see the weeks that cost thousands less before you book anything.",
  path: "/planner",
});

export const revalidate = 300;

const EMPTY = {
  days: [] as TripCostDay[],
  summary: {
    pricedDays: 0,
    totalDays: 0,
    cheapestStartDate: null,
    cheapestTotalCents: null,
    medianTotalCents: null,
    maxSavingCents: null,
    parkDays: 0,
    partySize: 0,
  },
  notes: [] as string[],
  gate: EMPTY_GATE,
};

/**
 * Colour the calendar against the *median*, not the mean.
 *
 * Christmas and spring break are extreme enough to drag an average well above a
 * normal week, which would paint most of the year green and tell a family
 * nothing. Banding against the median keeps "cheap" meaning cheap.
 */
function band(totalCents: number | null, median: number | null): "low" | "high" | "" {
  if (totalCents === null || median === null) return "";
  if (totalCents <= median * 0.85) return "low";
  if (totalCents >= median * 1.2) return "high";
  return "";
}

export default async function PlannerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;

  const origin = sp.origin ?? "";
  const adults = sp.adults ?? "2";
  const children = sp.children ?? "2";
  const nights = sp.nights ?? "4";
  const rateCode = sp.rateCode ?? "APH";

  const client = await getClient();
  const [me, result] = await Promise.all([
    getMe(),
    safe(
      client.tripCost({
        destination: "universal-orlando",
        origin: origin || undefined,
        adults: Number(adults),
        children: Number(children),
        nights: Number(nights),
        rateCode: rateCode as "APH",
      }),
      EMPTY
    ),
  ]);

  const { days, summary, notes } = result;
  const gate = result.gate ?? EMPTY_GATE;
  const priced = days.filter((d) => d.totalCents !== null);
  const partySize = Number(adults) + Number(children);
  const best = priced.find((d) => d.startDate === summary.cheapestStartDate) ?? null;

  return (
    <main className="section">
      <h1>What will the whole trip cost?</h1>
      <p className="lede" style={{ marginTop: 12 }}>
        Flights, hotel and park tickets added up for every possible start date — so you can see the
        weeks that cost thousands less, before you book anything. Hotel prices use the{" "}
        {RATE_CODE_LABELS[rateCode as "APH"] ?? "passholder"} rate.
      </p>

      {/* A plain GET form: no JavaScript required, every result is a shareable
          URL, and a family can send "look at this week" to a partner. */}
      <form className="card" method="get" style={{ padding: 22, marginTop: 24 }}>
        <div className="grid grid-3" style={{ gap: 16, alignItems: "end" }}>
          <label>
            <div className="tiny muted" style={{ fontWeight: 700, marginBottom: 6 }}>
              FLYING FROM
            </div>
            <select className="field" name="origin" defaultValue={origin}>
              <option value="">We&apos;re driving — no flights</option>
              {ORIGINS.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <div className="tiny muted" style={{ fontWeight: 700, marginBottom: 6 }}>
              NIGHTS
            </div>
            <select className="field" name="nights" defaultValue={nights}>
              {[3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>
                  {n} nights
                </option>
              ))}
            </select>
          </label>

          <label>
            <div className="tiny muted" style={{ fontWeight: 700, marginBottom: 6 }}>
              RATE
            </div>
            <select className="field" name="rateCode" defaultValue={rateCode}>
              <option value="APH">Annual Passholder</option>
              <option value="STANDARD">Standard (public)</option>
              <option value="FLR">Florida Resident</option>
            </select>
          </label>

          <label>
            <div className="tiny muted" style={{ fontWeight: 700, marginBottom: 6 }}>
              ADULTS
            </div>
            <select className="field" name="adults" defaultValue={adults}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          <label>
            <div className="tiny muted" style={{ fontWeight: 700, marginBottom: 6 }}>
              CHILDREN
            </div>
            <select className="field" name="children" defaultValue={children}>
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          <button className="btn btn-primary" type="submit">
            Update the calendar
          </button>
        </div>
      </form>

      {priced.length === 0 ? (
        <div className="notice" style={{ marginTop: 26 }}>
          <b>The trip planner isn&apos;t live yet.</b> It needs hotel rates, ticket prices and
          fares in place before it can total a trip honestly — and half a total is worse than none.
          {notes.length > 0 ? (
            <ul style={{ margin: "10px 0 0", paddingLeft: 20 }}>
              {notes.map((n) => (
                <li key={n} style={{ fontSize: 14 }}>
                  {n}
                </li>
              ))}
            </ul>
          ) : null}
          {/* Also here, not only in the priced breakdown below. Until the
              collectors fill in, that breakdown never renders — so the CTA
              would be invisible on the exact page a planning family lands on. */}
          <div style={{ marginTop: 14 }}>
            <CompareButton linkKey="tickets-orlando" />
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-3" style={{ margin: "28px 0", gap: 16 }}>
            <div
              className="card"
              style={{ background: "var(--teal-tint)", borderColor: "transparent" }}
            >
              <div className="tiny" style={{ fontWeight: 700, color: "#077368" }}>
                CHEAPEST START DATE
              </div>
              <div className="cal-price" style={{ fontSize: 32, color: "#077368" }}>
                {centsToDisplay(summary.cheapestTotalCents)}
              </div>
              <div className="tiny muted">
                {summary.cheapestStartDate ? formatLongDate(summary.cheapestStartDate) : ""}
              </div>
            </div>

            <div
              className="card"
              style={{ background: "var(--blue-tint)", borderColor: "transparent" }}
            >
              <div className="tiny" style={{ fontWeight: 700, color: "var(--blue-dark)" }}>
                TYPICAL WEEK
              </div>
              <div className="cal-price" style={{ fontSize: 32, color: "var(--blue-dark)" }}>
                {centsToDisplay(summary.medianTotalCents)}
              </div>
              <div className="tiny muted">middle of everything we can see</div>
            </div>

            <div
              className="card"
              style={{ background: "var(--coral-tint)", borderColor: "transparent" }}
            >
              <div className="tiny" style={{ fontWeight: 700, color: "#b03514" }}>
                PICKING WELL SAVES
              </div>
              <div className="cal-price" style={{ fontSize: 32, color: "#b03514" }}>
                {centsToDisplay(summary.maxSavingCents)}
              </div>
              <div className="tiny muted">
                for {summary.partySize} {summary.partySize === 1 ? "person" : "people"}, same trip
              </div>
            </div>
          </div>

          {best ? (
            <div className="card" style={{ marginBottom: 28 }}>
              <h3 style={{ marginTop: 0 }}>
                Your cheapest {nights} nights: {formatLongDate(best.startDate)}
              </h3>
              <div className="table-wrap" style={{ marginTop: 12 }}>
                <table>
                  <thead>
                    <tr>
                      <th>What</th>
                      <th>Detail</th>
                      <th className="num">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Flights</td>
                      <td className="muted">
                        {origin
                          ? `${origin} return for ${partySize}${best.airline ? ` · ${best.airline}` : ""}${
                              best.transfers === 0 ? " · non-stop" : ""
                            }`
                          : "Driving"}
                      </td>
                      <td className="num">{centsToDisplay(best.components.flightsCents)}</td>
                    </tr>
                    <tr>
                      <td>Hotel</td>
                      <td className="muted">
                        {best.hotelName ?? "—"}
                        {best.hotelIncludesExpressPass ? (
                          <span className="badge badge-express" style={{ marginLeft: 8 }}>
                            Free Express Unlimited
                          </span>
                        ) : null}
                      </td>
                      <td className="num">{centsToDisplay(best.components.hotelCents)}</td>
                    </tr>
                    <tr>
                      <td>Tickets</td>
                      <td className="muted">
                        {summary.parkDays}-day admission for {partySize}
                        {/* Beside the line item, not stranded at the bottom of
                            the page — this is the row they are pricing. */}
                        <CompareButton linkKey="tickets-orlando" />
                      </td>
                      <td className="num">{centsToDisplay(best.components.ticketsCents)}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 700 }}>Total</td>
                      <td className="muted tiny">
                        {centsToDisplay(best.perPersonPerDayCents)} per person per day
                      </td>
                      <td className="num" style={{ fontWeight: 700 }}>
                        {centsToDisplay(best.totalCents)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {best.hotelIncludesExpressPass ? (
                <p className="tiny muted" style={{ marginTop: 12, marginBottom: 0 }}>
                  This hotel includes Express Unlimited for everyone in the room. On a busy week
                  that perk alone is worth more than the difference in room rate — it is not
                  included in the total above, so the real gap is wider than it looks.
                </p>
              ) : null}
            </div>
          ) : null}

          <h2>Every start date</h2>
          <p className="muted" style={{ marginTop: 6, fontSize: 15 }}>
            Green is the cheapest sixth or so, red is a peak week. Each square is the whole trip for
            your family, not a nightly rate.
          </p>

          <div className="cal" style={{ marginTop: 16 }}>
            {days.map((day) => {
              const b = band(day.totalCents, summary.medianTotalCents);
              const isBest = day.startDate === summary.cheapestStartDate;
              return (
                <div
                  key={day.startDate}
                  className={`cal-day ${b === "low" ? "cal-low" : b === "high" ? "cal-high" : ""} ${
                    isBest ? "cal-best" : ""
                  }`}
                  title={
                    day.totalCents === null
                      ? `We can't price this date yet — missing ${day.missing.join(", ")}`
                      : `${day.hotelName ?? ""} · ${centsToDisplay(day.perPersonPerDayCents)} per person per day`
                  }
                >
                  <div className="cal-dow">{dayOfWeekLabel(day.startDate)}</div>
                  <div className="tiny muted">{dayNumber(day.startDate)}</div>
                  <div className="cal-price">
                    {day.totalCents === null ? (
                      <span className="muted" style={{ fontSize: 13 }}>
                        —
                      </span>
                    ) : (
                      centsToDisplay(day.totalCents)
                    )}
                  </div>
                  {isBest ? (
                    <span className="badge badge-hot" style={{ marginTop: 6 }}>
                      Best
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>

          {days.length > priced.length ? (
            <p className="tiny muted" style={{ marginTop: 14 }}>
              {days.length - priced.length} of {days.length} dates show a dash. Those are dates
              where one of the three legs hasn&apos;t been collected yet — we&apos;d rather show
              nothing than a total that quietly leaves out your flights.
            </p>
          ) : null}
        </>
      )}

      <p className="tiny muted" style={{ marginTop: 22 }}>
        Fares are cached prices from Aviasales, not live availability, and hotel and ticket prices
        are observations rather than quotes. Always confirm on the official site before booking.
      </p>

      <AffiliateDisclosure />

      {gate.gated ? (
        <section className="paywall" style={{ marginTop: 28 }}>
          <div className="hero-kicker" style={{ marginBottom: 14 }}>
            Free — no card needed
          </div>
          <h2>{gate.withheldDays} more days of trip costs are waiting</h2>
          <p>
            You&apos;re seeing the next {gate.visibleDays} days. The cheapest week to go is almost
            always further out than that — create a free account and the full 365-day calendar
            unlocks instantly.
          </p>
          <div className="paywall-actions">
            <a href="/join?next=%2Fplanner" className="btn btn-primary btn-lg">
              Unlock the full year — free
            </a>
          </div>
        </section>
      ) : null}

      {!gate.gated && me.entitlements.lookaheadDays >= 365 && priced.length > 0 ? (
        <p className="tiny muted" style={{ marginTop: 10 }}>
          You&apos;re seeing all {summary.totalDays} days.
        </p>
      ) : null}
    </main>
  );
}
