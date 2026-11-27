import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@ratecoaster/db";
import { pushRegistrations } from "@ratecoaster/db/schema";
import { isValidExpoPushToken } from "../lib/push.js";

export const pushRouter = new Hono();

const RegisterPushBody = z.object({
  channel: z.literal("expo-push").default("expo-push"),
  token: z.string().min(10).max(512),
  platform: z.enum(["ios", "android"]),
});

const UnregisterPushBody = z.object({
  token: z.string().min(10).max(512),
});

/**
 * POST /v1/push/register
 *
 * Registers (or refreshes) a native device token for the signed-in user so
 * watched price drops can deliver Expo push alerts alongside email.
 */
pushRouter.post("/register", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: { code: "unauthorized", message: "sign in first" } }, 401);
  }

  const parsed = RegisterPushBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success || !isValidExpoPushToken(parsed.data.token)) {
    return c.json(
      { error: { code: "invalid_token", message: "Provide a valid Expo push token." } },
      400
    );
  }

  const token = parsed.data.token.trim();
  const db = getDb();
  const [saved] = await db
    .insert(pushRegistrations)
    .values({
      userId: user.userId,
      channel: parsed.data.channel,
      token,
      platform: parsed.data.platform,
      revokedAt: null,
    })
    .onConflictDoUpdate({
      target: pushRegistrations.token,
      set: {
        userId: user.userId,
        channel: parsed.data.channel,
        platform: parsed.data.platform,
        revokedAt: null,
      },
    })
    .returning({ id: pushRegistrations.id });

  return c.json({ ok: true as const, id: saved!.id }, 201);
});

/** DELETE /v1/push/register — revoke a device token on sign-out or opt-out. */
pushRouter.delete("/register", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: { code: "unauthorized", message: "sign in first" } }, 401);
  }

  const parsed = UnregisterPushBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: { code: "invalid_body", message: "token is required" } }, 400);
  }

  await getDb()
    .update(pushRegistrations)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(pushRegistrations.token, parsed.data.token.trim()),
        eq(pushRegistrations.userId, user.userId)
      )
    );

  return c.json({ ok: true as const });
});
