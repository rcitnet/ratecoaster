import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@ratecoaster/db";
import { socialPosts } from "@ratecoaster/db/schema";
import { renderSocialImage } from "../social/image.js";
import { rateLimitByIp } from "../lib/rate-limit.js";

// Meta fetches these generated public editorial cards without session cookies.
// Random post IDs are required; there is no public listing or arbitrary text input.
export const socialMediaRouter = new Hono();
socialMediaRouter.use("*", rateLimitByIp({ namespace: "social-image", limit: 60, windowMs: 60_000 }));
socialMediaRouter.get("/posts/:id/image.jpg", async (c) => {
  const id = z.string().uuid().safeParse(c.req.param("id"));
  if (!id.success) return c.notFound();
  const [post] = await getDb().select({ kind: socialPosts.kind, body: socialPosts.body, url: socialPosts.url })
    .from(socialPosts).where(eq(socialPosts.id, id.data)).limit(1);
  if (!post) return c.notFound();
  const jpeg = await renderSocialImage(post);
  return c.body(new Uint8Array(jpeg), 200, { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400" });
});
