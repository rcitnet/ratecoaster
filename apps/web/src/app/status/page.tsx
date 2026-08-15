import { apiFetch, relativeTime } from "@/lib/api";

export const dynamic = "force-dynamic";

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

export default async function StatusPage() {
  const data = await apiFetch<{ collectors: CollectorStatus[] }>("/v1/status", { collectors: [] });

  return (
    <main className="section">
      <h1>Data freshness</h1>
      <p className="lede" style={{ marginTop: 12 }}>
        Public on purpose. The only promise this site makes is that its prices are current, so it
        should be obvious — to you and to us — the moment a feed goes quiet.
      </p>

      {data.collectors.length === 0 ? (
        <div className="notice">
          Couldn&apos;t reach the API. Start it with <code>npm run -w @parkpulse/api dev</code>.
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
    </main>
  );
}
