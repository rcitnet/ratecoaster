import { z } from "zod";

/**
 * Homepage hero layouts an admin can switch between without a deploy.
 *
 * The ids are stored in `site_settings` and must stay stable. Adding a layout
 * is a code change plus a new entry here; removing one requires a fallback so
 * a retired id does not blank the front page.
 */
export const HeroVariant = z.enum([
  "current",
  "compact",
  "slim",
  "split",
  "light",
  "planner",
  "tiles",
  "pulse",
]);
export type HeroVariant = z.infer<typeof HeroVariant>;

export const HomepageSettings = z.object({
  heroVariant: HeroVariant,
});
export type HomepageSettings = z.infer<typeof HomepageSettings>;

export const DEFAULT_HOMEPAGE_SETTINGS: HomepageSettings = {
  heroVariant: "current",
};

export const HERO_VARIANT_OPTIONS = [
  {
    id: "current",
    label: "Original",
    summary: "Large dark card with headline, three buttons, and stats. What shipped first.",
  },
  {
    id: "compact",
    label: "Compact card",
    summary: "Same dark card, less padding, shorter copy, two buttons instead of three.",
  },
  {
    id: "slim",
    label: "Slim strip",
    summary: "One-line headline and a single CTA. The smallest dark card.",
  },
  {
    id: "split",
    label: "Split + live waits",
    summary: "Short copy beside today’s park averages, so the hero earns its height.",
  },
  {
    id: "light",
    label: "No dark card",
    summary: "Headline on cream. Park pulse becomes the first visual.",
  },
  {
    id: "planner",
    label: "Planner first",
    summary: "Check-in form in the hero so pricing a trip is the first action.",
  },
  {
    id: "tiles",
    label: "Three doors",
    summary: "Three equal paths: plan a trip, today’s deals, live waits.",
  },
  {
    id: "pulse",
    label: "Pulse first",
    summary: "Tiny banner, then the park pulse — the thing people actually came to see.",
  },
] as const satisfies ReadonlyArray<{ id: HeroVariant; label: string; summary: string }>;
