import { and, eq } from "drizzle-orm";
import { attractions, parks } from "@ratecoaster/db/schema";
import { z } from "zod";
import { fetchJson } from "../framework/http.js";
import type { Collector } from "../framework/types.js";
import { normalizeName } from "./providers.js";

const CATALOG_URL =
  process.env.UNIVERSAL_ATTRACTION_CATALOG_URL ??
  "https://www.universalorlando.com/contentdata/uor/en/us/api/filtersdata/index.html";

const OfficialKeyword = z.object({
  Key: z.string(),
  Description: z.string().nullish(),
  Value: z.string().nullish(),
});

const OfficialKeywords = z.preprocess(
  (value) => value == null ? [] : Array.isArray(value) ? value : [value],
  z.array(OfficialKeyword)
);

const OfficialTile = z.object({
  Content: z.object({
    Heading: z.string(),
    Accessibility: OfficialKeywords.optional().default([]),
    TileImage: z.object({
      DesktopTabletImage: z.string().nullish(),
      MobileImage: z.string().nullish(),
      HightResolutionImage: z.string().nullish(),
    }).nullish(),
  }),
  Meta: z.object({
    AttractionExperiences: OfficialKeywords,
    AttractionLocations: OfficialKeywords,
    AttractionInterests: OfficialKeywords,
    AreasToExplore: OfficialKeywords,
    AttractionType: OfficialKeywords,
    HeightRequirements: OfficialKeywords,
    Age: OfficialKeywords,
    ExpressPass: OfficialKeywords,
    MapLatitude: z.string().nullish(),
    MapLongitude: z.string().nullish(),
  }),
  PageUrl: z.string().nullish(),
});

const OfficialCatalog = z.object({
  Tiles: z.array(OfficialTile),
  PublishedOn: z.string().nullish(),
});

export type OfficialAttractionMetadata = {
  name: string;
  parkSlug: string;
  attractionTypes: Array<{ key: string; label: string }>;
  interests: Array<{ key: string; label: string }>;
  ageGroups: Array<{ key: string; label: string }>;
  heightRequirements: Array<{ key: string; label: string }>;
  accessibility: Array<{ key: string; label: string }>;
  expressPass: boolean | null;
  latitude: number | null;
  longitude: number | null;
  officialUrl: string | null;
  officialImageUrl: string | null;
};

const LOCATION_TO_PARK: Record<string, string> = {
  usf: "universal-studios-florida",
  ioa: "islands-of-adventure",
  vb: "volcano-bay",
  eu: "epic-universe",
  "universal-epic-universe": "epic-universe",
};

const EPIC_AREAS = new Set([
  "epic-universe",
  "celestial-park",
  "dark-universe",
  "train-your-dragon",
  "super-nintendo-world",
  "ministry-of-magic",
  "wizarding-world-of-harry-potter",
]);

/** Parse only official ride/attraction tiles; dining, shops, and events are excluded. */
export function parseUniversalAttractionCatalog(input: unknown): OfficialAttractionMetadata[] {
  const catalog = OfficialCatalog.parse(input);
  const output: OfficialAttractionMetadata[] = [];

  for (const tile of catalog.Tiles) {
    if (!tile.Meta.AttractionExperiences.some((item) => item.Key === "rides-attractions")) continue;
    const parkSlug = officialParkSlug(tile.Meta.AttractionLocations, tile.Meta.AreasToExplore);
    if (!parkSlug) continue;
    output.push({
      name: decodeEntities(tile.Content.Heading),
      parkSlug,
      attractionTypes: tags(tile.Meta.AttractionType),
      interests: tags(tile.Meta.AttractionInterests),
      ageGroups: tags(tile.Meta.Age),
      heightRequirements: tags(tile.Meta.HeightRequirements),
      accessibility: tags(tile.Content.Accessibility),
      expressPass: yesNo(tile.Meta.ExpressPass),
      latitude: coordinate(tile.Meta.MapLatitude),
      longitude: coordinate(tile.Meta.MapLongitude),
      officialUrl: officialPageUrl(tile.PageUrl),
      officialImageUrl: officialImageUrl(tile.Content.TileImage),
    });
  }

  return output;
}

function tags(items: z.infer<typeof OfficialKeywords>) {
  return items
    .map((item) => ({ key: item.Key, label: decodeEntities(item.Description ?? item.Value ?? item.Key) }))
    .filter((item) => item.key && item.label);
}

function officialParkSlug(
  locations: z.infer<typeof OfficialKeywords>,
  areas: z.infer<typeof OfficialKeywords>
) {
  for (const location of locations) {
    const park = LOCATION_TO_PARK[location.Key];
    if (park) return park;
  }
  return areas.some((area) => EPIC_AREAS.has(area.Key)) ? "epic-universe" : null;
}

function yesNo(items: z.infer<typeof OfficialKeywords>): boolean | null {
  if (items.some((item) => item.Key.toLowerCase() === "yes")) return true;
  if (items.some((item) => item.Key.toLowerCase() === "no")) return false;
  return null;
}

function coordinate(value: string | null | undefined) {
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function officialPageUrl(path: string | null | undefined) {
  if (!path) return null;
  if (/^https:\/\//i.test(path)) return path;
  return `https://www.universalorlando.com${path.replace(/^\/uor\//, "/web/")}`;
}

function officialImageUrl(image: z.infer<typeof OfficialTile>["Content"]["TileImage"]) {
  const path = image?.DesktopTabletImage ?? image?.MobileImage ?? image?.HightResolutionImage;
  if (!path) return null;
  if (/^https:\/\//i.test(path)) return path;
  return `https://www.universalorlando.com/contentdata${path.startsWith("/") ? path : `/${path}`}`;
}

function decodeEntities(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    quot: '"',
    lt: "<",
    gt: ">",
    nbsp: " ",
  };
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, body: string) => {
    if (body.startsWith("#x")) return String.fromCodePoint(Number.parseInt(body.slice(2), 16));
    if (body.startsWith("#")) return String.fromCodePoint(Number.parseInt(body.slice(1), 10));
    return named[body.toLowerCase()] ?? entity;
  });
}

export const universalAttractionCatalogCollector: Collector = {
  name: "attraction-metadata",
  description: "Official Universal ride types, interests, accessibility, images, and coordinates",
  intervalMinutes: 24 * 60,

  async isConfigured() {
    return { ready: true };
  },

  async run({ db, stats, logger }) {
    stats.requestCount++;
    const json = await fetchJson(CATALOG_URL, { rpm: 2, requestKey: "universal-orlando-attractions" });
    if (!json) return;
    const metadata = parseUniversalAttractionCatalog(json);
    stats.parsedCount = metadata.length;

    const existing = await db
      .select({ id: attractions.id, name: attractions.name, parkSlug: parks.slug })
      .from(attractions)
      .innerJoin(parks, eq(attractions.parkId, parks.id))
      .where(and(eq(parks.destination, "universal-orlando"), eq(attractions.active, true)));

    const byParkAndName = new Map(
      existing.map((attraction) => [catalogKey(attraction.parkSlug, attraction.name), attraction])
    );
    const unmatched: string[] = [];
    const updatedAt = new Date();

    for (const item of metadata) {
      const attraction = byParkAndName.get(catalogKey(item.parkSlug, item.name));
      if (!attraction) {
        unmatched.push(`${item.parkSlug}:${item.name}`);
        continue;
      }
      await db.update(attractions).set({
        attractionTypes: item.attractionTypes,
        interests: item.interests,
        ageGroups: item.ageGroups,
        heightRequirements: item.heightRequirements,
        accessibility: item.accessibility,
        expressPass: item.expressPass,
        latitude: item.latitude,
        longitude: item.longitude,
        officialUrl: item.officialUrl,
        officialImageUrl: item.officialImageUrl,
        metadataUpdatedAt: updatedAt,
      }).where(eq(attractions.id, attraction.id));
      stats.writtenCount++;
    }

    stats.notes.catalogRows = metadata.length;
    stats.notes.matched = stats.writtenCount;
    stats.notes.unmatched = unmatched.slice(0, 30);
    logger.info(`matched ${stats.writtenCount} of ${metadata.length} official attraction records`);
    if (metadata.length > 0 && stats.writtenCount === 0) {
      throw new Error("official attraction catalog no longer matches any stored attraction names");
    }
  },
};

function catalogKey(parkSlug: string, name: string) {
  const normalized = normalizeName(decodeEntities(name));
  const alias = CATALOG_NAME_ALIASES[`${parkSlug}:${normalized}`] ?? normalized;
  return `${parkSlug}:${alias}`;
}

// Universal's content catalog and Queue-Times occasionally differ by a small
// article while clearly naming the same slide. Keep these reviewed aliases
// explicit; fuzzy matching could attach safety or height metadata to the wrong
// attraction, which is worse than leaving a ride unclassified.
const CATALOG_NAME_ALIASES: Record<string, string> = {
  "volcano-bay:puihi of the maku puihi round raft rides": "puihi of maku puihi round raft rides",
  "volcano-bay:maku of the maku puihi round raft rides": "maku of maku puihi round raft rides",
  "volcano-bay:ika moana of the honu ika moana": "ika moana of honu ika moana",
  "volcano-bay:honu of the honu ika moana": "honu of honu ika moana",
};
