import { getDb } from "@ratecoaster/db";
import { socialSettings } from "@ratecoaster/db/schema";

export const AUTOMATIC_SOCIAL_PLATFORMS = ["threads", "bluesky", "facebook", "instagram"] as const;
export const SOCIAL_PLATFORMS = [...AUTOMATIC_SOCIAL_PLATFORMS, "x"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export type SocialSetting = {
  platform: SocialPlatform;
  enabled: boolean;
  dryRun: boolean;
};

export function socialPlatformConfigured(platform: SocialPlatform): boolean {
  if (platform === "facebook" || platform === "instagram") {
    const prefix = platform.toUpperCase();
    const id = platform === "facebook" ? "FACEBOOK_PAGE_ID" : "INSTAGRAM_USER_ID";
    const token = platform === "facebook" ? "FACEBOOK_PAGE_ACCESS_TOKEN" : "INSTAGRAM_ACCESS_TOKEN";
    if (!process.env[id]?.trim() || !process.env[token]?.trim()) return false;
    const expiry = process.env[`${prefix}_TOKEN_EXPIRES_AT`]?.trim();
    if (expiry && !(new Date(expiry).getTime() > Date.now())) return false;
    if (!/^v\d+\.0$/.test(process.env.META_GRAPH_API_VERSION?.trim() || "v25.0")) return false;
    if (platform === "instagram") {
      try { socialImageUrl("configuration-check"); } catch { return false; }
    }
    return true;
  }
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

export function socialImageUrl(postId: string): string {
  const base = new URL(process.env.SOCIAL_PUBLIC_API_URL?.trim() || "");
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash ||
      base.hostname === "localhost" || base.hostname === "127.0.0.1" || base.hostname === "[::1]") {
    throw new Error("SOCIAL_PUBLIC_API_URL must be a public HTTPS API base URL (including /api if proxied).");
  }
  return `${base.href.replace(/\/$/, "")}/v1/social/posts/${encodeURIComponent(postId)}/image.jpg`;
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
