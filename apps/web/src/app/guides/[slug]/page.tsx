import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdSlot } from "@/components/AdSlot";
import { GUIDES, guideBySlug } from "@/lib/guides";
import { articleSchema, breadcrumbSchema, jsonLd, pageMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return GUIDES.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const guide = guideBySlug(slug);
  if (!guide) {
    return pageMetadata({
      title: "Guide not found",
      description: "That guide doesn't exist.",
      path: `/guides/${slug}`,
      noindex: true,
    });
  }
  /*
   * No hand-appended "— RateCoaster": the root layout's title template already
   * adds "| RateCoaster", so doing both produced the brand twice and pushed the
   * useful words past Google's ~60-character truncation.
   */
  return pageMetadata({
    title: guide.title,
    description: guide.summary,
    path: `/guides/${slug}`,
  });
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const guide = guideBySlug((await params).slug);
  if (!guide) notFound();

  return (
    <main className="section legal-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            articleSchema({
              title: guide.title,
              description: guide.summary,
              path: `/guides/${guide.slug}`,
              section: "Universal planning",
            })
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            breadcrumbSchema([
              { name: "Home", path: "/" },
              { name: "Guides", path: "/guides" },
              { name: guide.title, path: `/guides/${guide.slug}` },
            ])
          ),
        }}
      />
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
