import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdSlot } from "@/components/AdSlot";
import { GUIDES, guideBySlug } from "@/lib/guides";

export function generateStaticParams() {
  return GUIDES.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const guide = guideBySlug((await params).slug);
  return guide
    ? { title: `${guide.title} — RateCoaster`, description: guide.summary }
    : { title: "Guide not found — RateCoaster" };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const guide = guideBySlug((await params).slug);
  if (!guide) notFound();

  return (
    <main className="section legal-page">
      <a href="/guides" className="tiny muted">← All planning guides</a>
      <p className="eyebrow" style={{ marginTop: 24 }}>{guide.readTime}</p>
      <h1>{guide.title}</h1>
      <p className="lede">{guide.summary}</p>

      {guide.sections.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          {section.bullets ? <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul> : null}
        </section>
      ))}

      <AdSlot placement="guide-after-article" slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_GUIDES} />

      <div className="notice" style={{ marginTop: 30 }}>
        Ready to compare your dates? <a href="/plan"><b>Build a free trip estimate</b></a> or{" "}
        <a href="/hotels"><b>open the hotel calendar</b></a>.
      </div>
    </main>
  );
}
