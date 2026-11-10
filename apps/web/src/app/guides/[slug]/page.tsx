import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdSlot } from "@/components/AdSlot";
import { GuideLive } from "@/components/GuideLive";
import { PageIntro } from "@/components/PageIntro";
import { RichText } from "@/components/RichText";
import { AUTHOR_BLURB, AUTHOR_NAME, AUTHOR_PATH } from "@/content/site";
import {
  GUIDE_CATEGORIES,
  GUIDES,
  guideBySlug,
  relatedGuides,
  type GuideSection,
} from "@/lib/guides";
import { articleSchema, breadcrumbSchema, faqSchema, jsonLd, pageMetadata } from "@/lib/seo";

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
    publishedTime: guide.published,
    modifiedTime: guide.updated,
  });
}

function longDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!)).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function Section({ section, index }: { section: GuideSection; index: number }) {
  return (
    <section id={`guide-section-${index + 1}`}>
      <h2>{section.heading}</h2>
      {section.paragraphs.map((paragraph) => <p key={paragraph}><RichText text={paragraph} /></p>)}
      {section.bullets ? (
        <ul>{section.bullets.map((bullet) => <li key={bullet}><RichText text={bullet} /></li>)}</ul>
      ) : null}
      {section.table ? (
        <div className="table-wrap guide-table" tabIndex={0} role="region" aria-label={section.table.caption ?? section.heading}>
          <table>
            {section.table.caption ? <caption>{section.table.caption}</caption> : null}
            <thead>
              <tr>{section.table.head.map((cell) => <th key={cell} scope="col">{cell}</th>)}</tr>
            </thead>
            <tbody>
              {section.table.rows.map((row) => (
                <tr key={row.join("|")}>
                  {row.map((cell, i) => (i === 0 ? <th key={i} scope="row">{cell}</th> : <td key={i}>{cell}</td>))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {(section.after ?? []).map((paragraph) => <p key={paragraph}><RichText text={paragraph} /></p>)}
    </section>
  );
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const guide = guideBySlug((await params).slug);
  if (!guide) notFound();

  const [first, ...rest] = guide.sections;
  const related = relatedGuides(guide);
  const revised = guide.updated !== guide.published;

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
              section: GUIDE_CATEGORIES[guide.category],
              published: guide.published,
              updated: guide.updated,
              wordCount: guide.wordCount,
              authorName: AUTHOR_NAME,
              authorPath: AUTHOR_PATH,
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
      {/*
        FAQ markup only for questions that are printed on this page, word for
        word, further down. Markup describing content a reader cannot see gets
        structured data ignored site-wide.
      */}
      {guide.faq && guide.faq.length > 0 ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(faqSchema(guide.faq)) }} />
      ) : null}

      <a href="/guides" className="tiny muted">← All planning guides</a>
      <PageIntro eyebrow={`${GUIDE_CATEGORIES[guide.category]} · ${guide.readTime}`} title={guide.title}>
        <p className="lede">{guide.summary}</p>
      </PageIntro>

      <p className="guide-byline">
        By <a href={AUTHOR_PATH}>{AUTHOR_NAME}</a>
        <span aria-hidden="true"> · </span>
        Published <time dateTime={guide.published}>{longDate(guide.published)}</time>
        {revised ? (
          <>
            <span aria-hidden="true"> · </span>
            Updated <time dateTime={guide.updated}>{longDate(guide.updated)}</time>
          </>
        ) : null}
      </p>

      <section className="guide-takeaways" aria-label="Key points">
        <p className="refresh-eyebrow">The short version</p>
        <ul>{guide.takeaways.map((point) => <li key={point}>{point}</li>)}</ul>
      </section>

      <nav className="guide-contents" aria-label="In this guide">
        <p className="refresh-eyebrow">In this guide</p>
        <ol>
          {guide.sections.map((section, index) => (
            <li key={section.heading}><a href={`#guide-section-${index + 1}`}>{section.heading}</a></li>
          ))}
          {guide.faq && guide.faq.length > 0 ? <li><a href="#guide-faq">Common questions</a></li> : null}
        </ol>
      </nav>

      <article>
        {first ? (
          <div className="guide-reading">
            <Section section={first} index={0} />
          </div>
        ) : null}

        {guide.live ? <GuideLive kind={guide.live} /> : null}

        {rest.length > 0 ? (
          <div className="guide-reading">
            {rest.map((section, index) => <Section key={section.heading} section={section} index={index + 1} />)}
          </div>
        ) : null}

        {guide.faq && guide.faq.length > 0 ? (
          <div className="guide-reading guide-faq" id="guide-faq">
            <section>
              <h2>Common questions</h2>
              {guide.faq.map((item) => (
                <div key={item.question} className="guide-faq-item">
                  <h3>{item.question}</h3>
                  <p>{item.answer}</p>
                </div>
              ))}
            </section>
          </div>
        ) : null}
      </article>

      <p className="tiny muted guide-reviewed">
        Prices, park rules and hotel benefits are set by Universal and change without notice. This
        guide was last reviewed on {longDate(guide.updated)}. Confirm current details with the
        official seller before you book. RateCoaster is independent and is not affiliated with
        Universal Destinations &amp; Experiences or Loews Hotels.
      </p>

      <AdSlot placement="guide-after-article" slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_GUIDES} />

      <aside className="guide-author" aria-label="About the author">
        <p className="refresh-eyebrow">Who wrote this</p>
        <p>
          {AUTHOR_BLURB} Guides are written from the site&apos;s own tracked prices and from
          Universal&apos;s published rules, and are revised when either changes.{" "}
          <a href={AUTHOR_PATH}><b>About RateCoaster</b></a> ·{" "}
          <a href="/guides/how-ratecoaster-compares-prices"><b>How the prices are collected</b></a> ·{" "}
          <a href="/contact"><b>Report an error</b></a>
        </p>
      </aside>

      {related.length > 0 ? (
        <section className="guide-related" aria-label="Related guides">
          <h2>Read next</h2>
          <div className="grid grid-3">
            {related.map((item) => (
              <a key={item.slug} href={`/guides/${item.slug}`} className="card card-hover">
                <p className="refresh-eyebrow">{GUIDE_CATEGORIES[item.category]} · {item.readTime}</p>
                <h3>{item.title}</h3>
                <p className="muted tiny">{item.summary}</p>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <div className="notice page-callout" style={{ marginTop: 30 }}>
        Ready to compare your dates? <a href="/plan"><b>Build a free trip estimate</b></a> or{" "}
        <a href="/hotels"><b>open the hotel calendar</b></a>.
      </div>
    </main>
  );
}
