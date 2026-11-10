import { EXPLAINERS, type Explainer, type ExplainerKey } from "@/content/explainers";
import { guideBySlug } from "@/lib/guides";
import { faqSchema, jsonLd } from "@/lib/seo";

/**
 * The explanatory section at the foot of a data page: what the page shows, how
 * to read it, common questions, and where to read more.
 *
 * Placed after the data on purpose. Someone who came for the grid gets the
 * grid first; someone who does not understand the grid finds the explanation
 * directly under it.
 */
export function PageExplainer({ page }: { page: ExplainerKey }) {
  const content: Explainer = EXPLAINERS[page];
  const guides = content.guides
    .map((slug) => guideBySlug(slug))
    .filter((guide): guide is NonNullable<typeof guide> => Boolean(guide));

  return (
    <section className="page-explainer" aria-labelledby={`explainer-${page}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(faqSchema([...content.faq])) }}
      />
      <p className="refresh-eyebrow">{content.eyebrow}</p>
      <h2 id={`explainer-${page}`}>{content.title}</h2>
      {content.intro.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}

      {content.sections.map((section) => (
        <div key={section.heading}>
          <h3>{section.heading}</h3>
          {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          {section.bullets ? <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul> : null}
        </div>
      ))}

      <div className="page-explainer-faq">
        <p className="refresh-eyebrow">Common questions</p>
        {content.faq.map((item) => (
          <div key={item.question}>
            <h3>{item.question}</h3>
            <p>{item.answer}</p>
          </div>
        ))}
      </div>

      {guides.length > 0 ? (
        <p className="page-explainer-more">
          <span className="muted">Read more:</span>
          {guides.map((guide) => <a key={guide.slug} href={`/guides/${guide.slug}`}>{guide.title} →</a>)}
        </p>
      ) : null}
    </section>
  );
}
