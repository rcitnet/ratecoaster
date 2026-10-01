import { apiFetch, relativeTime } from "@/lib/api";

type ArchiveStatus = { parks: Array<{
  slug: string; name: string; monitored: boolean; checkedAt: string | null; storedDays: number; finalizedDays: number;
  earliestDate: string | null; latestDate: string | null;
  issues: Array<{ kind: string; message: string; dates?: string[] }>;
}> };

export async function CrowdArchiveStatus({ compact = false }: { compact?: boolean }) {
  const status = await apiFetch<ArchiveStatus | null>("/v1/admin/crowd-archive", null);
  if (!status) return <div className="notice notice-warn" style={{ marginTop: 20 }} role="alert">Crowd archive status is unavailable. Check the API and archive job.</div>;
  const flagged = status.parks.filter(park => park.issues.length > 0);
  if (compact) return flagged.length ? <div className="notice notice-warn" style={{ marginTop: 20 }} role="alert"><b>Crowd data needs attention for {flagged.length} parks.</b>{" "}<a href="/admin/status">Review missing dates and stale signals</a>.</div> : null;
  return <section style={{ marginTop: 30 }} aria-labelledby="crowd-archive-status">
    <h2 id="crowd-archive-status">Crowd history and data alerts</h2>
    <p className="muted tiny">Hourly checks preserve estimates. Completed dates are permanent; future estimates refresh when pricing changes.</p>
    {status.parks.length === 0 ? <div className="notice notice-warn" role="alert">No parks are registered for crowd history.</div> : null}
    <div className="grid grid-2" style={{ marginTop: 16 }}>
      {status.parks.map(park => <article className="card" key={park.slug}>
        <h3>{park.name}</h3>
        <p className="tiny muted">{park.storedDays} saved dates · {park.finalizedDays} permanent historical dates<br />{park.earliestDate ?? "—"} to {park.latestDate ?? "—"}<br />Last check: {park.checkedAt ? relativeTime(park.checkedAt) : "Never"}</p>
        {park.issues.length ? <div className="notice notice-warn" role="alert"><b>Needs attention</b><ul>{park.issues.map((issue, index) => <li key={`${issue.kind}-${index}`}>{issue.message}{issue.dates?.length ? <div className="tiny">Dates: {issue.dates.slice(0, 8).join(", ")}{issue.dates.length > 8 ? ` and ${issue.dates.length - 8} more` : ""}</div> : null}</li>)}</ul></div> : <span className="badge badge-deal">{park.monitored ? "Archive and source signals healthy" : "Retired park — history retained"}</span>}
      </article>)}
    </div>
  </section>;
}
