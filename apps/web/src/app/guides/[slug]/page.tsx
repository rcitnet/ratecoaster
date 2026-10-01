import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdSlot } from "@/components/AdSlot";
import { GUIDES, guideBySlug } from "@/lib/guides";
import { PageIntro } from "@/components/PageIntro";
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
    <main className="section legal-page page-refresh guide-article">
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
      <PageIntro eyebrow={`The planning library · ${guide.readTime}`} title={guide.title}>
      <p className="lede">{guide.summary}</p>
      </PageIntro>

      <nav className="guide-contents" aria-label="In this guide">
        <p className="refresh-eyebrow">In this guide</p>
        <ol>{guide.sections.map((section, index) => <li key={section.heading}><a href={`#guide-section-${index + 1}`}>{section.heading}</a></li>)}</ol>
      </nav>
      <article className="guide-reading">
      {guide.sections.map((section, index) => (
        <section key={section.heading} id={`guide-section-${index + 1}`}>
          <h2>{section.heading}</h2>
          {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          {section.bullets ? <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul> : null}
        </section>
      ))}
      </article>

      <AdSlot placement="guide-after-article" slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_GUIDES} />

      <div className="notice page-callout" style={{ marginTop: 30 }}>
        Ready to compare your dates? <a href="/plan"><b>Build a free trip estimate</b></a> or{" "}
        <a href="/hotels"><b>open the hotel calendar</b></a>.
      </div>
    </main>
  );
}
