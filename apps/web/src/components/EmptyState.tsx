/**
 * Shown when a collector has not produced data yet.
 *
 * Being specific about *why* a section is empty — and what to do about it —
 * matters more here than in most apps, because "no data" has several distinct
 * causes: the endpoint config has not been captured, the crawl has not run yet,
 * or the upstream rejected the rate code. A generic "nothing to show" would
 * hide the difference.
 */
export function EmptyState({
  title,
  reason,
  action,
}: {
  title: string;
  reason: string;
  action?: string;
}) {
  return (
    <div className="notice">
      <div className="card-title">{title}</div>
      <p className="muted" style={{ margin: "6px 0 0" }}>
        {reason}
      </p>
      {action ? (
        <p className="muted tiny" style={{ margin: "8px 0 0" }}>
          <code>{action}</code>
        </p>
      ) : null}
    </div>
  );
}
