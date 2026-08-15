import { getOverview, getAudit } from "@/lib/admin";
import { relativeTime } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  const [overview, audit] = await Promise.all([getOverview(), getAudit()]);

  return (
    <>
      <div className="grid grid-4">
        <div className="card" style={{ background: "var(--blue-tint)", borderColor: "transparent" }}>
          <div className="tiny" style={{ fontWeight: 700, color: "var(--blue-dark)" }}>RATE ROWS</div>
          <div className="cal-price" style={{ fontSize: 28, color: "var(--blue-dark)" }}>
            {overview.counts.rates.toLocaleString()}
          </div>
        </div>
        <div className="card" style={{ background: "var(--teal-tint)", borderColor: "transparent" }}>
          <div className="tiny" style={{ fontWeight: 700, color: "#077368" }}>LIVE WAITS</div>
          <div className="cal-price" style={{ fontSize: 28, color: "#077368" }}>
            {overview.counts.waits.toLocaleString()}
          </div>
        </div>
        <div className="card" style={{ background: "var(--purple-tint)", borderColor: "transparent" }}>
          <div className="tiny" style={{ fontWeight: 700, color: "#5b34c4" }}>ACCOUNTS</div>
          <div className="cal-price" style={{ fontSize: 28, color: "#5b34c4" }}>
            {overview.counts.users.toLocaleString()}
          </div>
        </div>
        <div
          className="card"
          style={{
            background: overview.silentFailures > 0 ? "var(--coral-tint)" : "var(--cream)",
            borderColor: "transparent",
          }}
        >
          <div className="tiny" style={{ fontWeight: 700, color: overview.silentFailures > 0 ? "#b03514" : "var(--ink-mute)" }}>
            SILENT FAILURES
          </div>
          <div className="cal-price" style={{ fontSize: 28, color: overview.silentFailures > 0 ? "#b03514" : "var(--ink)" }}>
            {overview.silentFailures}
          </div>
          <div className="tiny muted" style={{ marginTop: 2 }}>runs that parsed nothing</div>
        </div>
      </div>

      {overview.silentFailures > 0 ? (
        <div className="notice notice-warn" style={{ marginTop: 18 }}>
          <b>{overview.silentFailures} recent runs finished without error but parsed no rows.</b>{" "}
          That&apos;s what a changed upstream response looks like — no crash, no alert, just data
          quietly going stale. Check the collector and re-capture its price source if needed.
        </div>
      ) : null}

      <h2 style={{ marginTop: 36 }}>Recent runs</h2>
      <div className="table-wrap" style={{ marginTop: 12 }}>
        <table>
          <thead>
            <tr>
              <th>Collector</th><th>Status</th><th className="num">Parsed</th>
              <th className="num">Written</th><th className="num">Errors</th><th className="num">When</th>
            </tr>
          </thead>
          <tbody>
            {overview.recentRuns.length === 0 ? (
              <tr><td colSpan={6} className="muted">No runs recorded yet.</td></tr>
            ) : overview.recentRuns.map((r, i) => (
              <tr key={`${r.collector}-${r.startedAt}-${i}`}>
                <td>{r.collector}</td>
                <td>
                  <span className={`badge ${r.status === "ok" ? "badge-deal" : r.status === "failed" ? "badge-coral" : ""}`}>
                    {r.status}
                  </span>
                </td>
                <td className="num">{r.parsedCount}</td>
                <td className="num">{r.writtenCount}</td>
                <td className="num">{r.errorCount > 0 ? <span className="delta-up">{r.errorCount}</span> : 0}</td>
                <td className="num muted tiny">{relativeTime(r.startedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ marginTop: 36 }}>Admin activity</h2>
      <p className="muted tiny" style={{ marginBottom: 12 }}>
        Every change made here is recorded. When something breaks, this answers what changed.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>When</th><th>Who</th><th>Action</th><th>Target</th></tr>
          </thead>
          <tbody>
            {audit.length === 0 ? (
              <tr><td colSpan={4} className="muted">Nothing yet.</td></tr>
            ) : audit.map((a, i) => (
              <tr key={`${a.at}-${i}`}>
                <td className="tiny muted">{relativeTime(a.at)}</td>
                <td className="tiny">{a.email ?? "—"}</td>
                <td><code style={{ fontSize: 12 }}>{a.action}</code></td>
                <td className="tiny muted">{a.target ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
