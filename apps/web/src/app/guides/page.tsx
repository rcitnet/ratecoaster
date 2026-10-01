import type { Metadata } from "next";
import { AdSlot } from "@/components/AdSlot";
import { GUIDES } from "@/lib/guides";
import { PageIntro } from "@/components/PageIntro";
import { HotelPhoto } from "@/components/HotelPhoto";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Universal planning guides",
  description:
    "Plain-English guides to Universal pricing: when it's cheapest to go, how passholder rates really compare, whether Express Pass is worth it, and how far ahead to book.",
  path: "/guides",
});

export default function GuidesPage() {
  return (
    <main className="section page-refresh guide-library">
      <PageIntro eyebrow="A head start on the fun" title="A better trip starts here."
        image={{ src: "/hotels/sapphire-falls.webp", alt: "Loews Sapphire Falls Resort", label: "Loews Sapphire Falls Resort · Orlando" }}>
      <p className="lede">
        RateCoaster collects the calendars. These guides explain how to compare them without mixing
        unlike rooms, ticket products, or benefits—and where a live price still needs a checkout check.
      </p>
      </PageIntro>

      <div className="refresh-section-head"><div><p className="refresh-eyebrow">The planning library</p><h2>Know before you go.</h2></div><span className="tiny muted">{GUIDES.length} practical guides · Free to explore</span></div>
      <div className="grid grid-2 guide-library-grid">
        {GUIDES.map((guide, index) => (
          <a key={guide.slug} href={`/guides/${guide.slug}`} className={`card card-hover guide-library-card${index === 0 ? " guide-featured" : ""}`}>
            {index === 0 ? <HotelPhoto slug="royal-pacific" name="Loews Royal Pacific Resort" /> : null}
            <div className="guide-card-copy">
            <p className="refresh-eyebrow">{index === 0 ? "Start with the essentials" : `Planning guide ${String(index + 1).padStart(2, "0")}`}</p>
            <span className="badge badge-blue">{guide.readTime}</span>
            <h2 style={{ fontSize: 24, marginTop: 12 }}>{guide.title}</h2>
            <p className="muted">{guide.summary}</p>
            <span className="refresh-text-link">Read guide →</span>
            </div>
          </a>
        ))}
      </div>

      <AdSlot placement="guides-index" slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_GUIDES} />
    </main>
  );
}
