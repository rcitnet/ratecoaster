import { apiFetch, relativeTime } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Affiliate clicks by source page.
 *
 * Pageview tools answer "how many people came". This answers "which page sent
 * someone to a merchant", which is the only traffic that can become money — and
 * the one figure no external analytics product can report, because the click
 * leaves for a domain they cannot see either.
 */
type ClickRow = {
  fromPath: string;
  merchant: string;
  clicks: number;
  lastClickedAt: string;
};

type ClickReport = {
  days: number;
  totals: { clicks: number; pages: number; merchants: number };
  byPage: ClickRow[];
  byDay: { day: string; clicks: number }[];
};

const EMPTY: ClickReport = {
  days: 30,
  totals: { clicks: 0, pages: 0, merchants: 0 },
  byPage: [],
  byDay: [],
};

const WINDOWS = ["7", "30", "90", "365"] as const;

export default async function AdminClicks({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days } = await searchParams;
  const chosen = WINDOWS.find((w) => w === days) ?? "30";
  const data = await apiFetch<ClickReport>(`/v1/admin/clicks?days=${chosen}`, EMPTY);

  // Scaled to the busiest day rather than the total, so a quiet week still
  // shows shape instead of a flat row of invisible bars.
  const peak = Math.max(1, ...data.byDay.map((d) => d.clicks));
  const best = data.byPage[0] ?? null;

  return (
    <>
      <div className="notice">
        <b>Where the money actually starts.</b> Every outbound affiliate click, grouped by the
        page that produced it. Set against the network&apos;s revenue report, this is what tells
        you a click from one page is worth more than a click from another.
      </div>

      <div className="chips">
        {WINDOWS.map((w) => (
          <a key={w} href={`/admin/clicks?days=${w}`} className={w === chosen ? "chip on" : "chip"}>
            {w === "365" ? "Last year" : `Last ${w} days`}
          </a>
        ))}
      </div>

      <div className="grid grid-4">
        <div className="card" style={{ background: "var(--blue-tint)", borderColor: "transparent" }}>
          <div className="tiny" style={{ fontWeight: 700, color: "var(--blue-dark)" }}>CLICKS</div>
          <div className="cal-price" style={{ fontSize: 28, color: "var(--blue-dark)" }}>
            {data.totals.clicks.toLocaleString()}
          </div>
        </div>
        <div className="card" style={{ background: "var(--teal-tint)", borderColor: "transparent" }}>
          <div className="tiny" style={{ fontWeight: 700, color: "#077368" }}>PAGES SENDING</div>
          <div className="cal-price" style={{ fontSize: 28, color: "#077368" }}>
            {data.totals.pages.toLocaleString()}
          </div>
        </div>
        <div className="card" style={{ background: "var(--purple-tint)", borderColor: "transparent" }}>
          <div className="tiny" style={{ fontWeight: 700, color: "#5b34c4" }}>MERCHANTS</div>
          <div className="cal-price" style={{ fontSize: 28, color: "#5b34c4" }}>
            {data.totals.merchants.toLocaleString()}
          </div>
        </div>
        <div className="card" style={{ background: "var(--cream)", borderColor: "transparent" }}>
          <div className="tiny" style={{ fontWeight: 700, color: "var(--ink-mute)" }}>TOP PAGE</div>
          <div className="cal-price" style={{ fontSize: 19, color: "var(--ink)", wordBreak: "break-all" }}>
            {best ? best.fromPath : "—"}
          </div>
          {best ? (
            <div className="tiny muted" style={{ marginTop: 2 }}>
              {best.clicks} of {data.totals.clicks} clicks
            </div>
          ) : null}
        </div>
      </div>

      {data.totals.clicks === 0 ? (
        <div className="notice notice-warn" style={{ marginTop: 20 }}>
          <b>No clicks recorded in this window.</b> Expected while the site is young — but it is
          also exactly what a broken redirect looks like. If you know traffic is arriving, click
          an affiliate link yourself and reload: a working link records within a second.
        </div>
      ) : (
        <>
          <h2 style={{ marginTop: 36 }}>By source page</h2>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table>
              <thead>
                <tr>
                  <th>Source page</th>
                  <th>Merchant</th>
                  <th className="num">Clicks</th>
                  <th className="num">Share</th>
                  <th className="num">Last click</th>
                </tr>
              </thead>
              <tbody>
                {data.byPage.map((row) => (
                  <tr key={`${row.fromPath}::${row.merchant}`}>
                    <td><code>{row.fromPath}</code></td>
                    <td className="muted">{row.merchant}</td>
                    <td className="num"><b>{row.clicks.toLocaleString()}</b></td>
                    <td className="num muted">
                      {Math.round((row.clicks / data.totals.clicks) * 100)}%
                    </td>
                    <td className="num muted">{relativeTime(row.lastClickedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 style={{ marginTop: 36 }}>Clicks per day</h2>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 3,
              height: 120,
              marginTop: 12,
              borderBottom: "1px solid var(--line-soft)",
            }}
          >
            {data.byDay.map((d) => (
              <div
                key={d.day}
                title={`${d.day}: ${d.clicks} click${d.clicks === 1 ? "" : "s"}`}
                style={{
                  flex: 1,
                  minWidth: 3,
                  height: `${Math.max(3, (d.clicks / peak) * 100)}%`,
                  background: "var(--blue)",
                  borderRadius: "3px 3px 0 0",
                }}
              />
            ))}
          </div>
          <p className="tiny muted" style={{ marginTop: 8 }}>
            Days with no clicks are absent rather than drawn as zero — the log holds only what
            happened, and inventing empty days here would imply we know the difference between a
            quiet day and a day the logger was down. Tallest bar is {peak}.
          </p>
        </>
      )}
    </>
  );
}
