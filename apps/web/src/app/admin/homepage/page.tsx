import { HERO_VARIANT_OPTIONS } from "@ratecoaster/shared";
import { HomepageHeroControl } from "@/components/AdminControls";
import { getHomepage } from "@/lib/admin";
import { relativeTime } from "@/lib/api";

export const dynamic = "force-dynamic";

function Thumb({ id }: { id: string }) {
  if (id === "tiles") {
    return (
      <div className="hero-thumb" data-thumb="tiles" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
    );
  }
  if (id === "slim") {
    return (
      <div className="hero-thumb" data-thumb="slim" aria-hidden="true">
        <div className="hero-thumb-title" />
        <div className="hero-thumb-btns">
          <span />
        </div>
      </div>
    );
  }
  if (id === "split") {
    return (
      <div className="hero-thumb" data-thumb="split" aria-hidden="true">
        <div>
          <div className="hero-thumb-bar" />
          <div className="hero-thumb-title" style={{ marginTop: 8 }} />
          <div className="hero-thumb-line" style={{ marginTop: 6 }} />
        </div>
        <div className="hero-pulse" style={{ gap: 6 }}>
          <div className="hero-pulse-chip" style={{ padding: 8 }} />
          <div className="hero-pulse-chip" style={{ padding: 8 }} />
          <div className="hero-pulse-chip" style={{ padding: 8 }} />
          <div className="hero-pulse-chip" style={{ padding: 8 }} />
        </div>
      </div>
    );
  }
  return (
    <div className="hero-thumb" data-thumb={id} aria-hidden="true">
      <div className="hero-thumb-bar" />
      <div className="hero-thumb-title" />
      <div className="hero-thumb-line" />
      {id === "pulse" || id === "light" ? null : (
        <div className="hero-thumb-btns">
          <span />
          {id === "compact" || id === "planner" ? null : <span />}
        </div>
      )}
    </div>
  );
}

export default async function AdminHomepage() {
  const homepage = await getHomepage();
  const active = homepage.heroVariant;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2>Homepage hero</h2>
          <p className="muted" style={{ marginTop: 6, maxWidth: 760 }}>
            Pick which first-screen layout the public homepage uses. The change is stored in the
            database, so you can try a compact hero for a busy weekend and switch back without a
            deploy. The rest of the page stays the same.
          </p>
        </div>
        <a href="/" className="btn btn-ghost btn-sm" target="_blank" rel="noreferrer">
          View live homepage
        </a>
      </div>

      {homepage.updatedAt ? (
        <p className="tiny muted" style={{ marginTop: 10 }}>
          Last switched {relativeTime(homepage.updatedAt)}.
        </p>
      ) : (
        <p className="tiny muted" style={{ marginTop: 10 }}>
          No switch recorded yet — the original layout is showing.
        </p>
      )}

      <div className="grid grid-2" style={{ marginTop: 22 }}>
        {HERO_VARIANT_OPTIONS.map((option) => {
          const isLive = option.id === active;
          return (
            <article
              className="card"
              key={option.id}
              style={{
                padding: 16,
                borderColor: isLive ? "var(--blue)" : undefined,
                boxShadow: isLive ? "0 0 0 2px var(--blue-tint)" : undefined,
              }}
            >
              <Thumb id={option.id} />
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 14 }}>
                <h3 style={{ fontSize: 18 }}>{option.label}</h3>
                {isLive ? <span className="badge badge-deal">Live</span> : null}
              </div>
              <p className="tiny muted" style={{ margin: "6px 0 14px", minHeight: 40 }}>
                {option.summary}
              </p>
              <HomepageHeroControl variant={option.id} active={isLive} />
            </article>
          );
        })}
      </div>
    </>
  );
}
