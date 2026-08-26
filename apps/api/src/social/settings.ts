import { getDb } from "@ratecoaster/db";
import { socialSettings } from "@ratecoaster/db/schema";

export const SOCIAL_PLATFORMS = ["threads", "bluesky", "x"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export type SocialSetting = {
  platform: SocialPlatform;
  enabled: boolean;
  dryRun: boolean;
};

export function socialPlatformConfigured(platform: SocialPlatform): boolean {
  if (platform === "threads") {
    if (!process.env.THREADS_USER_ID?.trim() || !process.env.THREADS_ACCESS_TOKEN?.trim()) return false;
    const expiresAt = process.env.THREADS_TOKEN_EXPIRES_AT?.trim();
    if (expiresAt) {
      const expires = new Date(expiresAt);
      if (!Number.isNaN(expires.getTime()) && expires <= new Date()) return false;
    }
    return true;
  }
  if (platform === "bluesky") {
    return Boolean(process.env.BLUESKY_IDENTIFIER?.trim() && process.env.BLUESKY_APP_PASSWORD?.trim());
  }
  // X uses an official human-approved Web Intent and needs no credentials.
  return true;
}

export async function getSocialSettings(): Promise<Map<SocialPlatform, SocialSetting>> {
  const rows = await getDb().select().from(socialSettings);
  const byPlatform = new Map(rows.map((row) => [row.platform, row]));
  return new Map(
    SOCIAL_PLATFORMS.map((platform) => {
      const row = byPlatform.get(platform);
      return [
        platform,
        {
          platform,
          enabled: row?.enabled ?? false,
          dryRun: platform === "x" ? true : (row?.dryRun ?? true),
        },
      ];
    })
  );
}
