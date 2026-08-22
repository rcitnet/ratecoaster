import { getClient, relativeTime, safe, PARK_COLORS } from "@/lib/api";
import { AdSlot } from "@/components/AdSlot";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Live Universal ride wait times",
  description:
    "Current wait times for every ride at Universal Studios Florida, Islands of Adventure, Epic Universe, Volcano Bay and Universal Studios Hollywood, updated every few minutes.",
  path: "/waits",
});

export const revalidate = 60;

function waitClass(minutes: number | null, status: string): string {
  if (status !== "operating" || minutes === null) return "w-off";
  if (minutes <= 20) return "w-low";
  if (minutes <= 45) return "w-mid";
  return "w-high";
}

function statusLabel(status: string): string {
  if (status === "down") return "Down";
  if (status === "refurbishment") return "Refurb";
  return "Closed";
}

export default async function WaitsPage({
  searchParams,
}: {
  searchParams: Promise<{ park?: string }>;
}) {
  const params = await searchParams;
  const client = await getClient();
  const data = await safe(client.liveWaits({ ridesOnly: true }), {
    parks: [],
    attribution: [],
    fetchedAt: new Date().toISOString(),
  });

  const withWaits = data.parks.filter((p) => p.waits.length > 0);

  /*
   * All parks come back in one request and the filter is applied here rather
   * than through the API's `parkSlug` parameter, because the chip row needs the
   * full park list either way â€” filtering upstream would mean a second round
   * trip just to rebuild it. An unrecognised ?park= slug falls back to showing
   * everything rather than rendering a confusing empty page.
   */
  const selected = withWaits.some((p) => p.park.slug === params.park) ? params.park : undefined;
  const parks = selected ? withWaits.filter((p) => p.park.slug === selected) : withWaits;
  const selectedName = selected
    ? (withWaits.find((p) => p.park.slug === selected)?.park.name ?? null)
    : null;

  const allOpen = parks.flatMap((p) =>
    p.waits.filter((w) => w.status === "operating" && w.waitMinutes !== null)
  );
  const busiest = [...allOpen].sort((a, b) => (b.waitMinutes ?? 0) - (a.waitMinutes ?? 0))[0];

  return (
    <main className="section">
      <h1>Live ride waits</h1>
      <p className="lede" style={{ marginTop: 12 }}>
        {selectedName ?? "Every Universal park"}, updated every few minutes â€” and free for
        everyone.
      </p>

      {withWaits.length > 1 ? (
        <div className="chips">
          <a href="/waits" className={`chip ${selected ? "" : "on"}`}>
            All parks
          </a>
          {withWaits.map(({ park }) => (
            <a
              key={park.slug}
              href={`/waits?park=${park.slug}`}
              className={`chip ${selected === park.slug ? "on" : ""}`}
            >
              <span
                className="chip-dot"
                style={{ background: PARK_COLORS[park.slug] ?? "#3355ee" }}
                aria-hidden="true"
              />
              {park.name}
            </a>
          ))}
        </div>
      ) : null}

      {allOpen.length > 0 ? (
        <div className="grid grid-4" style={{ marginTop: 26 }}>
          <div className="card" style={{ background: "var(--teal-tint)", borderColor: "transparent" }}>
            <div className="tiny" style={{ color: "#077368", fontWeight: 700 }}>RIDES OPEN NOW</div>
            <div className="cal-price" style={{ fontSize: 30, color: "#077368" }}>{allOpen.length}</div>
          </div>
          <div className="card" style={{ background: "var(--blue-tint)", borderColor: "transparent" }}>
            <div className="tiny" style={{ color: "var(--blue-dark)", fontWeight: 700 }}>AVERAGE WAIT</div>
            <div className="cal-price" style={{ fontSize: 30, color: "var(--blue-dark)" }}>
              {Math.round(allOpen.reduce((s, w) => s + (w.waitMinutes ?? 0), 0) / allOpen.length)}m
            </div>
          </div>
          <div className="card" style={{ background: "var(--coral-tint)", borderColor: "transparent" }}>
            <div className="tiny" style={{ color: "#b03514", fontWeight: 700 }}>LONGEST RIGHT NOW</div>
            <div className="cal-price" style={{ fontSize: 30, color: "#b03514" }}>
              {busiest?.waitMinutes}m
            </div>
            <div className="tiny muted" style={{ marginTop: 2 }}>{busiest?.attractionName}</div>
          </div>
          <div className="card" style={{ background: "var(--yellow-tint)", borderColor: "transparent" }}>
            <div className="tiny" style={{ color: "#7a5410", fontWeight: 700 }}>WALK-ONS</div>
            <div className="cal-price" style={{ fontSize: 30, color: "#7a5410" }}>
              {allOpen.filter((w) => (w.waitMinutes ?? 99) <= 15).length}
            </div>
            <div className="tiny muted" style={{ marginTop: 2 }}>under 15 minutes</div>
          </div>
        </div>
      ) : (
        <div className="notice">
          {parks.length > 0 ? (
            <>
              <b>Nothing open{selectedName ? ` at ${selectedName}` : ""} right now.</b> Waits
              appear here as soon as the rides start running for the day.
            </>
          ) : (
            <>
              <b>Wait times are coming online.</b> We refresh from the parks every few minutes â€”
              check back shortly.
            </>
          )}
        </div>
      )}

      {parks.map(({ park, waits }) => {
        const open = waits.filter((w) => w.status === "operating" && w.waitMinutes !== null);
        const color = PARK_COLORS[park.slug] ?? "#3355ee";
        return (
          <section key={park.slug}>
            <div className="park-head">
              <span className="park-swatch" style={{ background: color }} />
              <div>
                <h2 style={{ margin: 0 }}>{park.name}</h2>
                <div className="tiny muted">
                  {open.length} of {waits.length} rides open
                  {open.length > 0
                    ? ` Â· average ${Math.round(open.reduce((s, w) => s + (w.waitMinutes ?? 0), 0) / open.length)} min`
                    : ""}
                </div>
              </div>
            </div>

            <div className="wait-grid">
              {[...waits]
                .sort((a, b) => (b.waitMinutes ?? -1) - (a.waitMinutes ?? -1))
                .map((w) => (
                  <div className="wait-card" key={w.attractionSlug}>
                    <div style={{ minWidth: 0 }}>
                      <div className="wait-name">{w.attractionName}</div>
                      <div className="wait-land">
                        {w.land ?? "â€”"}
                        {w.singleRiderMinutes !== null
                          ? ` Â· single rider ${w.singleRiderMinutes}m`
                          : ""}
                      </div>
                    </div>
                    <div className={`wait-figure ${waitClass(w.waitMinutes, w.status)}`}>
                      {w.status === "operating" && w.waitMinutes !== null
                        ? `${w.waitMinutes}`
                        : statusLabel(w.status)}
                      {w.status === "operating" && w.waitMinutes !== null ? (
                        <span style={{ fontSize: 13 }}>m</span>
                      ) : null}
                    </div>
                  </div>
                ))}
            </div>
          </section>
        );
      })}

      {parks.length > 0 ? (
        <p className="tiny muted" style={{ marginTop: 30 }}>
          Last updated {relativeTime(data.fetchedAt)}.
        </p>
      ) : null}

      <AdSlot
        placement="waits-after-boards"
        slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_WAITS}
      />
    </main>
  );
}
