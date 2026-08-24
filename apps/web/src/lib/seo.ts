import type { Metadata } from "next";

/**
 * One place for everything a search engine reads.
 *
 * Before this, seven pages inherited a single title from the root layout, so
 * Google saw the hotel grid, the ticket calendar, the wait times board and the
 * trip planner as four copies of the same document. Nothing else in an SEO
 * checklist matters while that is true.
 */

/**
 * The canonical origin.
 *
 * Hard requirement for `metadataBase`: without it Next emits relative Open
 * Graph and canonical URLs, which are invalid in both — the tag is present, the
 * validator is happy, and the value is useless.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.ratecoaster.net").replace(
  /\/+$/,
  ""
);

export const SITE_NAME = "RateCoaster";

/** Used where a page has no better description of its own. */
export const DEFAULT_DESCRIPTION =
  "Track Universal Orlando hotel rates a full year ahead at passholder and public prices, alongside ticket costs, Express Pass and live Universal ride wait times. Free.";

export function absoluteUrl(path: string): string {
  return path.startsWith("http") ? path : `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export interface PageSeoInput {
  title: string;
  description: string;
  /** Path only, no query string. */
  path: string;
  /** Set for pages that must never appear in search results. */
  noindex?: boolean;
  /** Overrides the shared social image. */
  image?: string;
  publishedTime?: string;
}

/**
 * Build a page's metadata, canonical included.
 *
 * The canonical is always the clean path with no query string, and that is the
 * point. Almost every page here takes filters — `?destination=`, `?product=`,
 * `?guest=`, `?rateCode=`, `?origin=`, `?nights=` — and each combination is a
 * distinct URL a crawler will happily fetch. Left alone, a handful of real
 * pages become hundreds of near-identical ones competing with each other. The
 * canonical says: they are all this page.
 */
export function pageMetadata(input: PageSeoInput): Metadata {
  const url = absoluteUrl(input.path);
  const image = input.image ?? "/opengraph-image";

  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: url },
    robots: input.noindex
      ? { index: false, follow: false, googleBot: { index: false, follow: false } }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            // Let Google use full-length previews and large image thumbnails.
            // The defaults are conservative and cost click-through for no gain.
            "max-snippet": -1,
            "max-image-preview": "large",
            "max-video-preview": -1,
          },
        },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: input.title,
      description: input.description,
      url,
      images: [image],
      locale: "en_US",
      ...(input.publishedTime ? { publishedTime: input.publishedTime } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: [image],
    },
  };
}

/* ------------------------------------------------------------------ *
 * Structured data
 * ------------------------------------------------------------------ */

/**
 * JSON-LD is emitted as a plain script tag rather than through a helper library.
 *
 * `JSON.stringify` output is inserted into a `<script type="application/ld+json">`,
 * so any `<` in the data could close the tag early and turn content into markup.
 * Escaping it is a two-character fix for a real injection vector, and the
 * alternative — trusting every future caller to sanitise — is not a plan.
 */
export function jsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: absoluteUrl("/brand/ratecoaster-logo-5x1-150kb.png"),
    description: DEFAULT_DESCRIPTION,
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: DEFAULT_DESCRIPTION,
  };
}

/**
 * Breadcrumbs, which Google renders in place of the raw URL in results.
 *
 * Worth the few lines: "ratecoaster.net › Hotels › Cabana Bay" reads far better
 * in a listing than a path, and it tells the crawler how the site nests.
 */
export function breadcrumbSchema(trail: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function articleSchema(input: {
  title: string;
  description: string;
  path: string;
  section?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.title,
    description: input.description,
    url: absoluteUrl(input.path),
    ...(input.section ? { articleSection: input.section } : {}),
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl("/brand/ratecoaster-logo-5x1-150kb.png"),
      },
    },
  };
}

export function faqSchema(items: Array<{ question: string; answer: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}
