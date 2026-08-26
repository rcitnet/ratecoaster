import { Hono } from "hono";
import { z } from "zod";
import { and, desc, eq, gt } from "drizzle-orm";
import { getDb } from "@ratecoaster/db";
import { socialDeliveries, socialPosts, socialSettings } from "@ratecoaster/db/schema";
import { audit } from "../lib/admin.js";
import { runSocialPublisher } from "../social/publisher.js";
import {
  getSocialSettings,
  SOCIAL_PLATFORMS,
  socialPlatformConfigured,
  type SocialPlatform,
} from "../social/settings.js";

export const adminSocialRouter = new Hono();

function platformDetail(platform: SocialPlatform): string {
  if (platform === "x") return "Human approval through the official X composer; no credentials needed.";
  if (platform === "threads" && process.env.THREADS_TOKEN_EXPIRES_AT) {
    const expires = new Date(process.env.THREADS_TOKEN_EXPIRES_AT);
    if (!Number.isNaN(expires.getTime()) && expires <= new Date()) {
      return `The Threads token expired at ${expires.toISOString()}. Replace it before enabling.`;
    }
  }
  if (!socialPlatformConfigured(platform)) {
    return platform === "threads"
      ? "Missing THREADS_USER_ID or THREADS_ACCESS_TOKEN."
      : "Missing BLUESKY_IDENTIFIER or BLUESKY_APP_PASSWORD.";
  }
  if (platform === "threads" && process.env.THREADS_TOKEN_EXPIRES_AT) {
    const expires = new Date(process.env.THREADS_TOKEN_EXPIRES_AT);
    if (!Number.isNaN(expires.getTime())) return `Token expiration recorded as ${expires.toISOString()}.`;
  }
  return "Credentials configured on the server.";
}

adminSocialRouter.get("/", async (c) => {
  const db = getDb();
  const settings = await getSocialSettings();
  const rows = await db
    .select({
      postId: socialPosts.id,
      kind: socialPosts.kind,
      body: socialPosts.body,
      url: socialPosts.url,
      sourceObservedAt: socialPosts.sourceObservedAt,
      expiresAt: socialPosts.expiresAt,
      createdAt: socialPosts.createdAt,
      deliveryId: socialDeliveries.id,
      platform: socialDeliveries.platform,
      status: socialDeliveries.status,
      attempts: socialDeliveries.attempts,
      lastError: socialDeliveries.lastError,
      externalUrl: socialDeliveries.externalUrl,
      publishedAt: socialDeliveries.publishedAt,
    })
    .from(socialPosts)
    .leftJoin(socialDeliveries, eq(socialDeliveries.postId, socialPosts.id))
    .orderBy(desc(socialPosts.createdAt))
    .limit(100);

  return c.json({
    settings: SOCIAL_PLATFORMS.map((platform) => ({
      ...settings.get(platform)!,
      configured: socialPlatformConfigured(platform),
      automatic: platform !== "x",
      detail: platformDetail(platform),
    })),
    deliveries: rows.map((row) => ({
      ...row,
      sourceObservedAt: row.sourceObservedAt?.toISOString() ?? null,
      expiresAt: row.expiresAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      publishedAt: row.publishedAt?.toISOString() ?? null,
      fullText: row.url ? `${row.body}\n\n${row.url}` : row.body,
    })),
  });
});

const SettingPatch = z.object({ enabled: z.boolean().optional(), dryRun: z.boolean().optional() });

adminSocialRouter.patch("/:platform", async (c) => {
  const platform = c.req.param("platform") as SocialPlatform;
  if (!SOCIAL_PLATFORMS.includes(platform)) {
    return c.json({ error: { code: "not_found", message: "Unknown social platform." } }, 404);
  }
  const parsed = SettingPatch.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: { code: "invalid", message: "Bad payload." } }, 400);
  if (parsed.data.enabled && !socialPlatformConfigured(platform)) {
    return c.json({ error: { code: "not_configured", message: platformDetail(platform) } }, 409);
  }

  const current = (await getSocialSettings()).get(platform)!;
  const user = c.get("user");
  await getDb()
    .insert(socialSettings)
    .values({
      platform,
      enabled: parsed.data.enabled ?? current.enabled,
      dryRun: platform === "x" ? true : (parsed.data.dryRun ?? current.dryRun),
      updatedBy: user?.userId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: socialSettings.platform,
      set: {
        ...(parsed.data.enabled === undefined ? {} : { enabled: parsed.data.enabled }),
        ...(platform === "x" || parsed.data.dryRun === undefined ? {} : { dryRun: parsed.data.dryRun }),
        updatedBy: user?.userId,
        updatedAt: new Date(),
      },
    });
  await audit(c, "social.setting", platform, parsed.data);
  return c.json({ ok: true });
});

adminSocialRouter.post("/run", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const send = body.send === true;
  await audit(c, send ? "social.publish" : "social.generate");
  return c.json({ ok: true, result: await runSocialPublisher({ send }) });
});

adminSocialRouter.post("/deliveries/:id/retry", async (c) => {
  const id = c.req.param("id");
  const now = new Date();
  const changed = await getDb()
    .update(socialDeliveries)
    .set({ status: "pending", claimedAt: null, lastError: null, updatedAt: now })
    .from(socialPosts)
    .where(
      and(
        eq(socialDeliveries.id, id),
        eq(socialDeliveries.postId, socialPosts.id),
        eq(socialDeliveries.status, "failed"),
        gt(socialPosts.expiresAt, now)
      )
    )
    .returning({ id: socialDeliveries.id });
  if (changed.length === 0) {
    return c.json({ error: { code: "not_retryable", message: "That delivery is expired or not failed." } }, 409);
  }
  await audit(c, "social.retry", id);
  return c.json({ ok: true });
});

adminSocialRouter.post("/deliveries/:id/mark-posted", async (c) => {
  const id = c.req.param("id");
  const now = new Date();
  const changed = await getDb()
    .update(socialDeliveries)
    .set({ status: "published", publishedAt: now, externalPostId: "manual", updatedAt: now })
    .where(
      and(
        eq(socialDeliveries.id, id),
        eq(socialDeliveries.platform, "x"),
        eq(socialDeliveries.status, "pending")
      )
    )
    .returning({ id: socialDeliveries.id });
  if (changed.length === 0) {
    return c.json({ error: { code: "not_pending", message: "That X post is no longer pending." } }, 409);
  }
  await audit(c, "social.mark_posted", id);
  return c.json({ ok: true });
});

adminSocialRouter.post("/deliveries/:id/cancel", async (c) => {
  const id = c.req.param("id");
  const changed = await getDb()
    .update(socialDeliveries)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(and(eq(socialDeliveries.id, id), eq(socialDeliveries.status, "pending")))
    .returning({ id: socialDeliveries.id });
  if (changed.length === 0) {
    return c.json({ error: { code: "not_pending", message: "That delivery is no longer pending." } }, 409);
  }
  await audit(c, "social.cancel", id);
  return c.json({ ok: true });
});
