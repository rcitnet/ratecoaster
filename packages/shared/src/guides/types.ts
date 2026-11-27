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
