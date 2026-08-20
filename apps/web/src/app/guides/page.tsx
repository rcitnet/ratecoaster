import type { Metadata } from "next";
import { AdSlot } from "@/components/AdSlot";
import { GUIDES } from "@/lib/guides";

export const metadata: Metadata = {
  title: "Universal planning guides — RateCoaster",
  description: "Original guides for comparing Universal hotel, ticket, Express Pass, and wait-time data.",
};

export default function GuidesPage() {
  return (
    <main className="section legal-page">
      <p className="eyebrow">Planning library</p>
      <h1>Turn the numbers into a better trip</h1>
      <p className="lede">
        RateCoaster collects the calendars. These guides explain how to compare them without mixing
        unlike rooms, ticket products, or benefits—and where a live price still needs a checkout check.
      </p>

      <div className="grid grid-2" style={{ marginTop: 30 }}>
        {GUIDES.map((guide) => (
          <a key={guide.slug} href={`/guides/${guide.slug}`} className="card card-hover">
            <span className="badge badge-blue">{guide.readTime}</span>
            <h2 style={{ fontSize: 24, marginTop: 12 }}>{guide.title}</h2>
            <p className="muted">{guide.summary}</p>
            <span className="tiny" style={{ color: "var(--blue)", fontWeight: 700 }}>Read guide →</span>
          </a>
        ))}
      </div>

      <AdSlot placement="guides-index" slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_GUIDES} />
    </main>
  );
}
