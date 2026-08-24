import { apiFetch, getMe } from "@/lib/api";
import type { WatchView } from "@ratecoaster/shared";
import { LogoutButton } from "@/components/LogoutButton";
import { WatchList } from "@/components/WatchList";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Your account",
  description: "Manage your RateCoaster account.",
  path: "/account",
  noindex: true,
});

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const me = await getMe();

  if (!me.user) {
    return (
      <main className="section" style={{ textAlign: "center", maxWidth: 520, margin: "0 auto" }}>
        <h1 style={{ fontSize: 34 }}>You&apos;re not signed in</h1>
        <p className="lede" style={{ margin: "14px auto 24px" }}>
          All pricing is public. A free account saves trips, watches dates, and delivers requested alerts.
        </p>
        <a href="/join" className="btn btn-primary btn-lg">Create a free account</a>
      </main>
    );
  }

  const e = me.entitlements;
  // Empty array on failure rather than a crash: a dead watch list should cost
  // the section, not the whole account page.
  const watchRows = await apiFetch<WatchView[]>("/v1/watches", []);

  const rows: Array<[string, string, boolean]> = [
    ["Rate calendar", `${e.lookaheadDays} days ahead`, true],
    ["Price history", e.priceHistory ? "Included" : "Free account", e.priceHistory],
    ["Rate-drop alerts", e.alerts ? "Included" : "Free account", e.alerts],
    ["Watched trips", `${e.maxWatches}`, e.maxWatches > 0],
    ["Every room type", "Free for everyone", true],
    ["Advanced insights", "Free for everyone", true],
  ];

  return (
    <main className="section">
      <h1>Your account</h1>
      <p className="lede" style={{ marginTop: 12 }}>{me.user.email}</p>

      <div className="grid grid-2" style={{ marginTop: 26, alignItems: "start" }}>
        <div className="card">
          <h3>What you get</h3>
          <table style={{ marginTop: 12 }}>
            <tbody>
              {rows.map(([label, value, on]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td className="num">
                    <span className={on ? "badge badge-deal" : "badge"}>{value}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 18 }}>
            <LogoutButton />
          </div>
        </div>

        <div className="card" style={{ background: "var(--purple-tint)", borderColor: "transparent" }}>
          <div className="hero-kicker">Always free</div>
          <h2>No upgrade required</h2>
          <p>
            The full 365-day calendar, every room type, price history, and planning comparisons are
            public. Accounts exist for saved trips and alerts — not to hide prices.
          </p>
        </div>
      </div>

      <h2 style={{ marginTop: 36 }}>Trips you&apos;re watching</h2>
      <p className="muted" style={{ fontSize: 15, marginTop: 6, marginBottom: 16 }}>
        You can watch {e.maxWatches} at once. We email you when a watched hotel stay, ticket, or
        Express Pass falls — at most once a day per watch, and only on a real drop.
      </p>
      <WatchList watches={watchRows} />
    </main>
  );
}
