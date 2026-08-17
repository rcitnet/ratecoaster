import { JoinForm } from "@/components/JoinForm";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  // Only same-origin paths survive, so a crafted ?next= cannot bounce someone
  // off to an attacker's page after they sign in.
  const next = params.next?.startsWith("/") && !params.next.startsWith("//") ? params.next : "/";

  return (
    <main className="section">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 44, alignItems: "start" }}>
        <div>
          <span className="badge badge-hot" style={{ marginBottom: 14 }}>
            Free account
          </span>
          <h1 style={{ fontSize: "clamp(30px, 4vw, 44px)" }}>
            Unlock the whole year.
          </h1>
          <p className="lede" style={{ marginTop: 14 }}>
            Anyone can see the next 30 days. A free account opens all 365 — including the quiet
            autumn weeks when rooms are at their cheapest and nobody else is looking.
          </p>

          <div className="grid" style={{ gap: 12, marginTop: 26 }}>
            {[
              ["365-day rate calendar", "Every hotel, passholder and public rates side by side."],
              ["Price history", "See whether today is a genuine low or just the new normal."],
              ["Rate-drop alerts", "We email you the moment your dates get cheaper."],
              ["Watch 5 trips at once", "Compare options before you commit."],
            ].map(([title, body]) => (
              <div key={title} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span className="save-flag" style={{ padding: "3px 9px", flexShrink: 0 }}>✓</span>
                <span>
                  <b>{title}</b>
                  <br />
                  <span className="muted tiny">{body}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 30, boxShadow: "var(--shadow-md)" }}>
          <h3 style={{ marginBottom: 6 }}>Create your free account</h3>
          <p className="muted tiny" style={{ marginBottom: 20 }}>
            No card, no password, no spam.
          </p>
          <JoinForm next={next} />
        </div>
      </div>
    </main>
  );
}
