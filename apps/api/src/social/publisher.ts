import { and, asc, eq, gt, inArray, lt, lte, sql } from "drizzle-orm";
import { getDb } from "@ratecoaster/db";
import { socialDeliveries, socialPosts } from "@ratecoaster/db/schema";
import { generateSocialCandidates } from "./candidates.js";
import { renderSocialText } from "./content.js";
import { publishToPlatform } from "./platforms.js";
import { getSocialSettings, socialPlatformConfigured, type SocialPlatform } from "./settings.js";

export type SocialRunResult = {
  generated: number;
  queued: number;
  published: number;
  failed: number;
  previews: Array<{ kind: string; text: string }>;
};

export async function runSocialPublisher(options: {
  send: boolean;
  now?: Date;
}): Promise<SocialRunResult> {
  const db = getDb();
  const now = options.now ?? new Date();
  const settings = await getSocialSettings();
  // A process can die after claiming but before recording the platform result.
  // That outcome is ambiguous, so surface it for human review rather than
  // silently retrying and risking a duplicate public post.
  await db
    .update(socialDeliveries)
    .set({
      status: "failed",
      lastError: "Publishing process stopped after claiming this delivery; verify the platform before retrying.",
      updatedAt: now,
    })
    .where(
      and(
        eq(socialDeliveries.status, "claimed"),
        lt(socialDeliveries.claimedAt, new Date(now.getTime() - 30 * 60_000))
      )
    );
  await db
    .update(socialDeliveries)
    .set({ status: "cancelled", lastError: "Expired before publishing.", updatedAt: now })
    .from(socialPosts)
    .where(
      and(
        eq(socialDeliveries.postId, socialPosts.id),
        eq(socialDeliveries.status, "pending"),
        lte(socialPosts.expiresAt, now)
      )
    );
  const candidates = await generateSocialCandidates(db, now);
  const result: SocialRunResult = {
    generated: candidates.length,
    queued: 0,
    published: 0,
    failed: 0,
    previews: candidates.map((candidate) => ({ kind: candidate.kind, text: renderSocialText(candidate) })),
  };

  for (const candidate of candidates) {
    const [inserted] = await db
      .insert(socialPosts)
      .values(candidate)
      .onConflictDoNothing({ target: socialPosts.fingerprint })
      .returning({ id: socialPosts.id });
    const [post] = inserted
      ? [inserted]
      : await db
          .select({ id: socialPosts.id })
          .from(socialPosts)
          .where(eq(socialPosts.fingerprint, candidate.fingerprint))
          .limit(1);
    if (!post) continue;

    for (const [platform, setting] of settings) {
      if (!setting.enabled) continue;
      const queued = await db
        .insert(socialDeliveries)
        .values({ postId: post.id, platform })
        .onConflictDoNothing({ target: [socialDeliveries.postId, socialDeliveries.platform] })
        .returning({ id: socialDeliveries.id });
      result.queued += queued.length;
    }
  }

  if (!options.send) return result;

  const automatic = (["threads", "bluesky"] as const).filter((platform) => {
    const setting = settings.get(platform);
    return setting?.enabled && !setting.dryRun && socialPlatformConfigured(platform);
  });
  if (automatic.length === 0) return result;

  const deliveries = await db
    .select({
      id: socialDeliveries.id,
      platform: socialDeliveries.platform,
      body: socialPosts.body,
      url: socialPosts.url,
    })
    .from(socialDeliveries)
    .innerJoin(socialPosts, eq(socialPosts.id, socialDeliveries.postId))
    .where(
      and(
        eq(socialDeliveries.status, "pending"),
        inArray(socialDeliveries.platform, automatic),
        gt(socialPosts.expiresAt, now)
      )
    )
    .orderBy(asc(socialDeliveries.createdAt))
    .limit(10);

  for (const delivery of deliveries) {
    if (delivery.platform === "x" || !delivery.url) continue;
    const [claimed] = await db
      .update(socialDeliveries)
      .set({
        status: "claimed",
        claimedAt: now,
        updatedAt: now,
        attempts: sql`${socialDeliveries.attempts} + 1`,
      })
      .where(and(eq(socialDeliveries.id, delivery.id), eq(socialDeliveries.status, "pending")))
      .returning({ id: socialDeliveries.id });
    if (!claimed) continue;

    try {
      const posted = await publishToPlatform(
        delivery.platform as Exclude<SocialPlatform, "x">,
        renderSocialText({ body: delivery.body, url: delivery.url }),
        delivery.url
      );
      await db
        .update(socialDeliveries)
        .set({
          status: "published",
          publishedAt: new Date(),
          externalPostId: posted.externalPostId,
          externalUrl: posted.externalUrl,
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(socialDeliveries.id, delivery.id));
      result.published++;
    } catch (error) {
      // Failed deliveries are deliberately not retried automatically. A timeout
      // after the platform accepted a post is ambiguous; blind retrying can
      // duplicate public content. The admin can inspect and explicitly retry.
      await db
        .update(socialDeliveries)
        .set({
          status: "failed",
          lastError: (error instanceof Error ? error.message : String(error)).slice(0, 1000),
          updatedAt: new Date(),
        })
        .where(eq(socialDeliveries.id, delivery.id));
      result.failed++;
    }
  }

  return result;
}
