/**
 * The planning library, shared across web and mobile clients.
 *
 * Adding a guide: append an entry to the right topic module. Routing, the
 * sitemap, metadata, structured data, the web index and the mobile app all
 * follow automatically.
 */
import { BASICS_GUIDES } from "./basics.js";
import { EXPRESS_GUIDES } from "./express.js";
import { FAMILY_GUIDES } from "./families.js";
import { HOTEL_GUIDES } from "./hotels.js";
import { PARK_GUIDES } from "./parks.js";
import { TICKET_GUIDES } from "./tickets.js";
import { TIMING_GUIDES } from "./timing.js";
import {
  GUIDE_CATEGORIES,
  type Guide,
  type GuideCategory,
  type GuideContent,
} from "./types.js";

export * from "./types.js";

function countWords(guide: GuideContent): number {
  const parts: string[] = [guide.summary, ...guide.takeaways];
  for (const section of guide.sections) {
    parts.push(
      section.heading,
      ...section.paragraphs,
      ...(section.bullets ?? []),
      ...(section.after ?? [])
    );
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

export function guidesByCategory(): Array<{
  category: GuideCategory;
  label: string;
  guides: Guide[];
}> {
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
    if (
      candidate.slug !== guide.slug &&
      candidate.category === guide.category &&
      !picked.includes(candidate)
    ) {
      picked.push(candidate);
    }
  }
  return picked.slice(0, limit);
}
