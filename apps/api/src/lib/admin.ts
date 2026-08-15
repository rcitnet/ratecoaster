import type { Context, MiddlewareHandler } from "hono";
import { getDb } from "@ratecoaster/db";
import { adminAudit } from "@ratecoaster/db/schema";
import { tierOf } from "./entitlements.js";

/**
 * Gate for everything under /v1/admin.
 *
 * Returns **404**, not 403, to anyone who isn't an admin.
 *
 * A 403 confirms the route exists, which tells a prober exactly where to aim.
 * Since the admin area is reachable on the public domain, the cheapest defence
 * is for it to be indistinguishable from a typo. A real admin never sees this.
 */
export const requireAdmin: MiddlewareHandler = async (c, next) => {
  if (tierOf(c) !== "admin") {
    return c.json({ error: { code: "not_found", message: "no such route" } }, 404);
  }
  await next();
};

/**
 * Records an admin action.
 *
 * Deliberately fire-and-forget with its own error handling: an audit failure
 * must never block the operation, but it also must not pass silently, or the
 * log quietly becomes fiction.
 */
export async function audit(
  c: Context,
  action: string,
  target?: string,
  detail?: Record<string, unknown>
): Promise<void> {
  const user = c.get("user");
  try {
    await getDb().insert(adminAudit).values({
      userId: user?.userId ?? null,
      email: user?.email ?? null,
      action,
      target: target ?? null,
      detail: detail ?? null,
    });
  } catch (err) {
    console.error(`[audit] FAILED to record ${action} on ${target}:`, err);
  }
}

/** Strips anything that shouldn't cross the wire to a browser. */
export function redactConfig(config: Record<string, unknown>): Record<string, unknown> {
  const clone = structuredClone(config) as Record<string, unknown>;
  const request = clone.request as Record<string, unknown> | undefined;
  if (request?.headers && typeof request.headers === "object") {
    const headers = request.headers as Record<string, string>;
    for (const key of Object.keys(headers)) {
      // A captured HAR often carries cookies and auth headers. They are not
      // needed to replay a public price query, and they should not be sitting
      // in a browser tab or a database row.
      if (/cookie|authorization|token|secret|api[-_]?key/i.test(key)) {
        headers[key] = "[redacted]";
      }
    }
  }
  return clone;
}
