/**
 * The planning library.
 *
 * Types and lookups live here; the articles themselves live in
 * `src/content/guides/*`, one file per topic, so a 1,200-word guide is not
 * buried in the middle of a 4,000-line module.
 *
 * Adding a guide: append an entry to the right content file. Routing, the
 * sitemap, metadata, the byline, structured data and the index all follow.
 */
import { BASICS_GUIDES } from "@/content/guides/basics";
import { EXPRESS_GUIDES } from "@/content/guides/express";
import { FAMILY_GUIDES } from "@/content/guides/families";
import { HOTEL_GUIDES } from "@/content/guides/hotels";
import { PARK_GUIDES } from "@/content/guides/parks";
import { TICKET_GUIDES } from "@/content/guides/tickets";
import { TIMING_GUIDES } from "@/content/guides/timing";

export interface GuideTable {
  caption?: string;
  head: string[];
  rows: string[][];
}

export interface GuideSection {
  heading: string;
  /**
   * Plain text, with one piece of markup: `[label](/path)` becomes a link.
   * Rendered by `RichText`, which only accepts site paths and https URLs.
   */
  paragraphs: string[];
  bullets?: string[];
  table?: GuideTable;
  /** Paragraphs that read better after the bullets or table. */
  after?: string[];
}

export interface GuideFaq {
  question: string;
  answer: string;
}

export const GUIDE_CATEGORIES = {
  "start-here": "Start here",
  hotels: "Hotels",
  tickets: "Tickets",
  express: "Express Pass",
  timing: "When to go",
  parks: "Parks",
  families: "Families",
} as const;
export type GuideCategory = keyof typeof GUIDE_CATEGORIES;

/**
 * A block of figures computed from RateCoaster's own tracked data at request
 * time. See `components/GuideLive.tsx`. Figures are never typed into an
 * article by hand, because a hand-typed price is wrong within the week.
 */
export type GuideLiveKey =
  | "hotel-lows"
  | "hotel-months"
  | "premier-math"
  | "passholder-savings"
  | "ticket-range"
  | "express-range"
  | "waits-now"
  | "crowd-outlook";

export interface GuideContent {
  slug: string;
  title: string;
  summary: string;
  category: GuideCategory;
  /** ISO dates. `updated` is shown on the page and emitted as dateModified. */
  published: string;
  updated: string;
  /** Three to five one-sentence answers, shown above the article. */
  takeaways: string[];
  sections: GuideSection[];
  faq?: GuideFaq[];
  live?: GuideLiveKey;
  /** Slugs of guides worth reading next. */
  related?: string[];
}

export interface Guide extends GuideContent {
  readTime: string;
  wordCount: number;
}

function countWords(guide: GuideContent): number {
  const parts: string[] = [guide.summary, ...guide.takeaways];
  for (const section of guide.sections) {
    parts.push(section.heading, ...section.paragraphs, ...(section.bullets ?? []), ...(section.after ?? []));
    if (section.table) parts.push(...section.table.head, ...section.table.rows.flat());
  }
  for (const item of guide.faq ?? []) parts.push(item.question, item.answer);
  // Link targets are markup, not prose; count the label only.
  const text = parts.join(" ").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  return text.split(/\s+/).filter(Boolean).length;
}

function finish(guide: GuideContent): Guide {
  const wordCount = countWords(guide);
  return { ...guide, wordCount, readTime: `${Math.max(2, Math.round(wordCount / 220))} min read` };
}

/**
 * Order is editorial: it is the order of the index page and of "read next"
 * fallbacks. The first entry is the featured guide.
 */
export const GUIDES: Guide[] = [
  ...BASICS_GUIDES,
  ...HOTEL_GUIDES,
  ...EXPRESS_GUIDES,
  ...TICKET_GUIDES,
  ...TIMING_GUIDES,
  ...PARK_GUIDES,
  ...FAMILY_GUIDES,
].map(finish);

export function guideBySlug(slug: string): Guide | undefined {
  return GUIDES.find((guide) => guide.slug === slug);
}

export function guidesByCategory(): Array<{ category: GuideCategory; label: string; guides: Guide[] }> {
  return (Object.keys(GUIDE_CATEGORIES) as GuideCategory[])
    .map((category) => ({
      category,
      label: GUIDE_CATEGORIES[category],
      guides: GUIDES.filter((guide) => guide.category === category),
    }))
    .filter((group) => group.guides.length > 0);
}

/** Explicit `related` first, then same-category guides, never the guide itself. */
export function relatedGuides(guide: Guide, limit = 3): Guide[] {
  const picked: Guide[] = [];
  for (const slug of guide.related ?? []) {
    const match = guideBySlug(slug);
    if (match && match.slug !== guide.slug && !picked.includes(match)) picked.push(match);
  }
  for (const candidate of GUIDES) {
    if (picked.length >= limit) break;
    if (candidate.slug !== guide.slug && candidate.category === guide.category && !picked.includes(candidate)) {
      picked.push(candidate);
    }
  }
  return picked.slice(0, limit);
}
