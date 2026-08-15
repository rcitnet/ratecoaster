import { getCollectors } from "@/lib/admin";
import { relativeTime } from "@/lib/api";
import { CollectorControls } from "@/components/AdminControls";

export const dynamic = "force-dynamic";

export default async function AdminCollectors() {
  const collectors = await getCollectors();

  return (
    <>
      <div className="notice">
        <b>Dry run means nothing is sent.</b> A collector in dry run logs the requests it would
        make and stops there. Only switch it off once a test request on its price source has
        returned sensible values — that&apos;s the difference between collecting data and
        collecting nonsense at speed.
      </div>

      <div className="grid" style={{ gap: 14, marginTop: 20 }}>
        {collectors.map((c) => (
          <div className="card" key={c.name}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div style={{ minWidth: 260 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <h3 style={{ fontSize: 17 }}>{c.name}</h3>
                  {c.dryRun ? (
                    <span className="badge badge-express">Dry run</span>
                  ) : (
                    <span className="badge badge-deal">Live</span>
                  )}
                  {!c.enabled ? <span className="badge badge-coral">Disabled</span> : null}
                  {!c.ready ? <span className="badge">Not configured</span> : null}
                </div>
                <div className="tiny muted" style={{ marginTop: 4 }}>{c.description}</div>
                {c.notReadyReason ? (
                  <div className="tiny" style={{ marginTop: 6, color: "#b03514" }}>
                    {c.notReadyReason}
                  </div>
                ) : null}
              </div>

              <div style={{ textAlign: "right", minWidth: 170 }}>
                <div className="tiny muted">Runs every {c.intervalMinutes} min</div>
                {c.lastRun ? (
                  <>
                    <div style={{ fontWeight: 600, marginTop: 4 }}>
                      {c.lastRun.status} · {c.lastRun.parsedCount} parsed
                    </div>
                    <div className="tiny muted">{relativeTime(c.lastRun.startedAt)}</div>
                  </>
                ) : (
                  <div className="tiny muted" style={{ marginTop: 4 }}>Never run</div>
                )}
              </div>
            </div>

            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line-soft)" }}>
              <CollectorControls name={c.name} dryRun={c.dryRun} enabled={c.enabled} ready={c.ready} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
