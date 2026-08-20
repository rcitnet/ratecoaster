import { getSources } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminSources() {
  const sources = await getSources();

  return (
    <>
      <div className="notice">
        <b>Only active first-party sources appear here.</b> These collectors are built into
        RateCoaster and do not require HAR uploads. Retired hotels and their historical source
        settings are intentionally excluded.
      </div>

      <div className="grid grid-2" style={{ marginTop: 20 }}>
        {sources.map((source) => (
          <article className="card" key={source.id}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h3 style={{ fontSize: 17 }}>{source.name}</h3>
              <span className={`badge ${source.configured ? "badge-deal" : "badge-coral"}`}>
                {source.configured ? "Configured" : "Needs attention"}
              </span>
            </div>
            <div className="tiny muted" style={{ marginTop: 7 }}>{source.host}</div>
            <p style={{ margin: "14px 0 6px" }}>{source.coverage}</p>
            <div className="tiny muted">{source.configuration}</div>
          </article>
        ))}
      </div>

      {sources.length === 0 ? (
        <div className="notice notice-warn" style={{ marginTop: 20 }}>
          No active pricing sources were returned. Check the API and seed status.
        </div>
      ) : null}
    </>
  );
}
