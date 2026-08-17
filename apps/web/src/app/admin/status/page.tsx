import { apiFetch, relativeTime } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Collector telemetry. Staff-only by virtue of living under /admin.
 *
 * This was once a public "Data freshness" page, which meant visitors were shown
 * collector names, run intervals and parsed-row counts — operational detail
 * that answers a question nobody planning a trip is asking. The signal is
 * genuinely useful, just not to them.
 */
type CollectorStatus = {
  name: string;
  description: string;
  intervalMinutes: number;
  lastRun: {
    status: string; startedAt: string; parsedCount: number;
    writtenCount: number; errorCount: number; ageMinutes: number; stale: boolean;
  } | null;
};

function dot(c: CollectorStatus) {
  if (!c.lastRun) return { cls: "dot-idle", label: "Not set up yet" };
  if (c.lastRun.status === "failed") return { cls: "dot-bad", label: "Failed" };
  if (c.lastRun.stale) return { cls: "dot-bad", label: "Stale" };
  // "Parsed nothing" means the run finished without error but returned no rows —
  // almost always an upstream shape change, and the failure most likely to go
  // unnoticed, so it gets its own colour.
  if (c.lastRun.status === "partial") return { cls: "dot-warn", label: "Parsed nothing" };
  return { cls: "dot-ok", label: "Healthy" };
}

export default async function AdminStatus() {
  const data = await apiFetch<{ collectors: CollectorStatus[] }>("/v1/status", { collectors: [] });

  return (
    <>
      <div className="notice">
        <b>Every collector, and when it last produced anything.</b> A feed that has gone quiet
        looks identical to a healthy one on the public site — this is where it shows.
      </div>

      {data.collectors.length === 0 ? (
        <div className="notice" style={{ marginTop: 20 }}>
          Couldn&apos;t reach the API. Start it with <code>npm run -w @ratecoaster/api dev</code>.
        </div>
      ) : (
        <div className="table-wrap" style={{ marginTop: 22 }}>
          <table>
            <thead>
              <tr>
                <th>Feed</th><th>State</th><th className="num">Runs every</th>
                <th className="num">Last run</th><th className="num">Records</th>
              </tr>
            </thead>
            <tbody>
              {data.collectors.map((c) => {
                const d = dot(c);
                return (
                  <tr key={c.name}>
                    <td>
                      <b>{c.name}</b>
                      <div className="tiny muted">{c.description}</div>
                    </td>
                    <td><span className={`status-dot ${d.cls}`} />{d.label}</td>
                    <td className="num muted">{c.intervalMinutes} min</td>
                    <td className="num muted">{c.lastRun ? relativeTime(c.lastRun.startedAt) : "—"}</td>
                    <td className="num">{c.lastRun?.parsedCount ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
