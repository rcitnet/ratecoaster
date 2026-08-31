import { eq } from "drizzle-orm";
import { getDb } from "@ratecoaster/db";
import { siteSettings } from "@ratecoaster/db/schema";
import {
  DEFAULT_HOMEPAGE_SETTINGS,
  HomepageSettings,
  type HeroVariant,
} from "@ratecoaster/shared";

const HOMEPAGE_KEY = "homepage";

export async function getHomepageSettings(): Promise<HomepageSettings> {
  try {
    const rows = await getDb()
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.key, HOMEPAGE_KEY))
      .limit(1);
    const parsed = HomepageSettings.safeParse(rows[0]?.value);
    return parsed.success ? parsed.data : DEFAULT_HOMEPAGE_SETTINGS;
  } catch (err) {
    console.error("[site] failed to read homepage settings:", err);
    return DEFAULT_HOMEPAGE_SETTINGS;
  }
}

export async function getHomepageSettingsMeta(): Promise<{
  heroVariant: HeroVariant;
  updatedAt: string | null;
}> {
  const fallback = {
    heroVariant: DEFAULT_HOMEPAGE_SETTINGS.heroVariant,
    updatedAt: null as string | null,
  };
  try {
    const rows = await getDb()
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.key, HOMEPAGE_KEY))
      .limit(1);
    const row = rows[0];
    if (!row) return fallback;
    const parsed = HomepageSettings.safeParse(row.value);
    return {
      heroVariant: parsed.success ? parsed.data.heroVariant : fallback.heroVariant,
      updatedAt: row.updatedAt.toISOString(),
    };
  } catch (err) {
    console.error("[site] failed to read homepage settings:", err);
    return fallback;
  }
}

export async function setHomepageHeroVariant(
  heroVariant: HeroVariant,
  updatedBy?: string
): Promise<HomepageSettings> {
  const value: HomepageSettings = { heroVariant };
  await getDb()
    .insert(siteSettings)
    .values({
      key: HOMEPAGE_KEY,
      value,
      updatedBy: updatedBy ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: siteSettings.key,
      set: {
        value,
        updatedBy: updatedBy ?? null,
        updatedAt: new Date(),
      },
    });
  return value;
}
