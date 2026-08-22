import { Hono } from "hono";
import { and, asc, count, eq } from "drizzle-orm";
import { getDb } from "@ratecoaster/db";
import { properties, watches } from "@ratecoaster/db/schema";
import { CreateWatch, ENTITLEMENTS } from "@ratecoaster/shared";
import { tierOf } from "../lib/entitlements.js";

export const watchesRouter = new Hono();

/**
 * Saved trips, and the alerts attached to them.
 *
 * The site has promised this since launch — "watch 5 trips at once", "we email
 * you the moment your dates get cheaper" — while the endpoint did not exist.
 * The tables, types and entitlements were all designed; only the middle was
 * missing, which is why nothing failed loudly.
 */

watchesRouter.get("/", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: { code: "unauthorized", message: "sign in first" } }, 401);
  }

  const db = getDb();
  const rows = await db
    .select({
      id: watches.id,
      kind: watches.kind,
      propertyId: watches.propertyId,
      ticketProductId: watches.ticketProductId,
      propertySlug: properties.slug,
      propertyName: properties.name,
      destination: watches.destination,
      rateCode: watches.rateCode,
      checkIn: watches.checkIn,
      checkOut: watches.checkOut,
      adults: watches.adults,
      children: watches.children,
      thresholdCents: watches.thresholdCents,
      bookedNightlyCents: watches.bookedNightlyCents,
      channels: watches.channels,
      active: watches.active,
      createdAt: watches.createdAt,
      lastNotifiedAt: watches.lastNotifiedAt,
      lastNotifiedCents: watches.lastNotifiedCents,
    })
    .from(watches)
    .leftJoin(properties, eq(properties.id, watches.propertyId))
    .where(eq(watches.userId, user.userId))
    .orderBy(asc(watches.checkIn));

  return c.json(
    rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      lastNotifiedAt: r.lastNotifiedAt?.toISOString() ?? null,
    }))
  );
});

watchesRouter.post("/", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: { code: "unauthorized", message: "sign in first" } }, 401);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = CreateWatch.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: { code: "invalid_body", message: "bad watch", details: parsed.error.flatten() } },
      400
    );
  }
  const input = parsed.data;

  if (input.target.checkOut <= input.target.checkIn) {
    return c.json(
      { error: { code: "invalid_body", message: "check-out must be after check-in" } },
      400
    );
  }

  /*
   * The limit is enforced here, not in the UI.
   *
   * "Watch 5 trips at once" is a tier entitlement, and an entitlement checked
   * only in the browser is a suggestion. This is the same principle as the
   * date-window gating: the server decides.
   */
  const db = getDb();
  const entitlements = ENTITLEMENTS[tierOf(c)];
  const [existing] = await db
    .select({ n: count() })
    .from(watches)
    .where(and(eq(watches.userId, user.userId), eq(watches.active, true)));

  if ((existing?.n ?? 0) >= entitlements.maxWatches) {
    return c.json(
      {
        error: {
          code: "limit_reached",
          message: `Your plan watches ${entitlements.maxWatches} trips at once. Remove one to add another.`,
          details: { maxWatches: entitlements.maxWatches },
        },
      },
      402
    );
  }

  const [created] = await db
    .insert(watches)
    .values({
      userId: user.userId,
      kind: input.target.kind,
      ticketProductId: input.target.ticketProductId,
      propertyId: input.target.propertyId,
      destination: input.target.destination as "universal-orlando" | null,
      rateCode: input.target.rateCode,
      checkIn: input.target.checkIn,
      checkOut: input.target.checkOut,
      adults: input.target.adults,
      children: input.target.children,
      thresholdCents: input.thresholdCents,
      bookedNightlyCents: input.bookedNightlyCents,
      channels: input.channels,
    })
    .returning({ id: watches.id });

  return c.json({ id: created!.id, ok: true }, 201);
});

watchesRouter.delete("/:id", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: { code: "unauthorized", message: "sign in first" } }, 401);
  }

  /*
   * Scoped to the owner in the WHERE clause rather than fetched-then-checked.
   * A delete that matches zero rows for the wrong user is indistinguishable
   * from one for a watch that never existed, which is exactly what we want to
   * tell an attacker probing IDs.
   */
  await getDb()
    .delete(watches)
    .where(and(eq(watches.id, c.req.param("id")), eq(watches.userId, user.userId)));

  return c.json({ ok: true });
});
