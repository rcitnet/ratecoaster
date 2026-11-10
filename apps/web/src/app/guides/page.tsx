import { AdSlot } from "@/components/AdSlot";
import { HotelPhoto } from "@/components/HotelPhoto";
import { PageIntro } from "@/components/PageIntro";
import { AUTHOR_NAME, AUTHOR_PATH, TRACKING_SINCE } from "@/content/site";
import { GUIDES, guidesByCategory } from "@/lib/guides";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Universal planning guides",
  description:
    "Plain-English guides to Universal pricing and planning: hotels compared, when it's cheapest to go, passholder rates, Express Pass, Epic Universe, tickets and travelling with young children.",
  path: "/guides",
});

export default function GuidesPage() {
  const featured = GUIDES[0];
  const groups = guidesByCategory();

  return (
    <main className="section page-refresh guide-library">
      <PageIntro eyebrow="A head start on the fun" title="A better trip starts here."
        image={{ src: "/hotels/sapphire-falls.webp", alt: "Loews Sapphire Falls Resort", label: "Loews Sapphire Falls Resort · Orlando" }}>
      <p className="lede">
        RateCoaster collects the calendars. These guides explain how to compare them without mixing
        unlike rooms, ticket products, or benefits—and where a live price still needs a checkout check.
      </p>
      </PageIntro>

      <p className="guide-library-about">
        {GUIDES.length} guides, written by <a href={AUTHOR_PATH}>{AUTHOR_NAME}</a> and built on prices
        this site has been recording since {TRACKING_SINCE}. Several include tables computed from
        today&apos;s tracked rates, so the figures stay current between revisions. Each guide shows
        when it was last reviewed. Hotel photography: Loews Hotels.
      </p>

      {featured ? (
        <div className="grid grid-2 guide-library-grid">
          <a href={`/guides/${featured.slug}`} className="card card-hover guide-library-card guide-featured">
            <HotelPhoto slug="royal-pacific" name="Loews Royal Pacific Resort" />
            <div className="guide-card-copy">
              <p className="refresh-eyebrow">Start with the essentials</p>
              <span className="badge badge-blue">{featured.readTime}</span>
              <h2 style={{ fontSize: 24, marginTop: 12 }}>{featured.title}</h2>
              <p className="muted">{featured.summary}</p>
              <span className="refresh-text-link">Read guide →</span>
            </div>
          </a>
        </div>
      ) : null}

      {groups.map((group) => {
        const guides = group.guides.filter((guide) => guide.slug !== featured?.slug);
        if (guides.length === 0) return null;
        return (
          <section key={group.category} aria-labelledby={`guides-${group.category}`}>
            <div className="refresh-section-head">
              <div>
                <p className="refresh-eyebrow">The planning library</p>
                <h2 id={`guides-${group.category}`}>{group.label}</h2>
              </div>
              <span className="tiny muted">{guides.length} guide{guides.length === 1 ? "" : "s"}</span>
            </div>
            <div className="grid grid-2 guide-library-grid">
              {guides.map((guide) => (
                <a key={guide.slug} href={`/guides/${guide.slug}`} className="card card-hover guide-library-card">
                  <div className="guide-card-copy">
                    <span className="badge badge-blue">{guide.readTime}</span>
                    <h3 style={{ fontSize: 22, marginTop: 12 }}>{guide.title}</h3>
                    <p className="muted">{guide.summary}</p>
                    <span className="refresh-text-link">Read guide →</span>
                  </div>
                </a>
              ))}
            </div>
          </section>
        );
      })}

      <AdSlot placement="guides-index" slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_GUIDES} />
    </main>
  );
}
