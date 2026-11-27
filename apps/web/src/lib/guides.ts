/**
 * Planning guides now live in `@ratecoaster/shared` so both the Next.js web app
 * and the Expo mobile app share a single source of truth.
 */
export {
  GUIDE_CATEGORIES,
  GUIDES,
  guideBySlug,
  guidesByCategory,
  relatedGuides,
  type Guide,
  type GuideCategory,
  type GuideContent,
  type GuideFaq,
  type GuideLiveKey,
  type GuideSection,
  type GuideTable,
} from "@ratecoaster/shared";
