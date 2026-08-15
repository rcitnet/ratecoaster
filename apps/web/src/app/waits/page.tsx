import { getClient, relativeTime, safe, PARK_COLORS } from "@/lib/api";

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

export default async function WaitsPage() {
  const client = await getClient();
  const data = await safe(client.liveWaits({ ridesOnly: true }), {
    parks: [],
    attribution: [],
    fetchedAt: new Date().toISOString(),
  });

  const parks = data.parks.filter((p) => p.waits.length > 0);
  const allOpen = parks.flatMap((p) =>
    p.waits.filter((w) => w.status === "operating" && w.waitMinutes !== null)
  );
  const busiest = [...allOpen].sort((a, b) => (b.waitMinutes ?? 0) - (a.waitMinutes ?? 0))[0];

  return (
    <main className="section">
      <h1>Live ride waits</h1>
      <p className="lede" style={{ marginTop: 12 }}>
        Every Universal park, refreshed every few minutes. Free for everyone, always — this runs on
        public APIs built for exactly this purpose.
      </p>

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
          No wait data yet. Run <code>npm run -w @ratecoaster/api collect -- --only wait-times</code>.
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
                    ? ` · average ${Math.round(open.reduce((s, w) => s + (w.waitMinutes ?? 0), 0) / open.length)} min`
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
                        {w.land ?? "—"}
                        {w.singleRiderMinutes !== null
                          ? ` · single rider ${w.singleRiderMinutes}m`
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
          Last refreshed {relativeTime(data.fetchedAt)}. Closed rides show no wait rather than zero
          minutes — counting them as zero is what makes other sites&apos; averages misleading.
        </p>
      ) : null}
    </main>
  );
}
