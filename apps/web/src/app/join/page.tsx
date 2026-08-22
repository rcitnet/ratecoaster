import { JoinForm } from "@/components/JoinForm";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Create a free account",
  description: "Unlock the full 365-day calendar with a free RateCoaster account.",
  path: "/join",
  noindex: true,
});

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
            Save the trip you&apos;re planning.
          </h1>
          <p className="lede" style={{ marginTop: 14 }}>
            Every RateCoaster price calendar is free for everyone. An account remembers your trips
            and lets us tell you when the dates you care about get cheaper.
          </p>

          <div className="grid" style={{ gap: 12, marginTop: 26 }}>
            {[
              ["Saved trip plans", "Keep your dates, party size, hotel rate, and ticket fit together."],
              ["Your watchlist", "Come back to the same hotels and dates without rebuilding the search."],
              ["Rate-drop alerts", "We email you the moment your dates get cheaper."],
              ["Watch 5 trips at once", "Compare options before you commit."],
            ].map(([title, body]) => (
              <div key={title} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span className="save-flag" style={{ padding: "3px 9px", flexShrink: 0 }}>âœ“</span>
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
