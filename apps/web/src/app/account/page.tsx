import { getMe } from "@/lib/api";
import { LogoutButton } from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const me = await getMe();

  if (!me.user) {
    return (
      <main className="section" style={{ textAlign: "center", maxWidth: 520, margin: "0 auto" }}>
        <h1 style={{ fontSize: 34 }}>You&apos;re not signed in</h1>
        <p className="lede" style={{ margin: "14px auto 24px" }}>
          A free account unlocks the full 365-day calendar, price history and rate-drop alerts.
        </p>
        <a href="/join" className="btn btn-primary btn-lg">Create a free account</a>
      </main>
    );
  }

  const e = me.entitlements;
  const rows: Array<[string, string, boolean]> = [
    ["Rate calendar", `${e.lookaheadDays} days ahead`, true],
    ["Price history", e.priceHistory ? "Included" : "Free account", e.priceHistory],
    ["Rate-drop alerts", e.alerts ? "Included" : "Free account", e.alerts],
    ["Watched trips", `${e.maxWatches}`, e.maxWatches > 0],
    ["Every room type", e.allRoomTypes ? "Included" : "Pro", e.allRoomTypes],
    ["Advanced insights", e.advancedInsights ? "Included" : "Pro", e.advancedInsights],
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

        <div className="paywall">
          <div className="hero-kicker">Coming soon</div>
          <h2>Pro</h2>
          <p>
            Every room type and occupancy, cross-hotel comparisons, and best-time-to-book modelling
            built on the full price history we&apos;re already collecting.
          </p>
          <div className="paywall-actions">
            <span className="btn btn-ghost" style={{ borderColor: "rgba(255,255,255,0.3)", color: "#fff", cursor: "default" }}>
              Not yet available
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
