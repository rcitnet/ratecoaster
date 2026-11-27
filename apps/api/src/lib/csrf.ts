import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import { SESSION_COOKIE } from "./auth.js";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const DEMO_COOKIE = "rc_demo_tier";

function normalizeOrigin(raw: string): string | null {
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

/**
 * Defense-in-depth CSRF check for cookie-authenticated mutations.
 *
 * `SameSite=Lax` already blocks most cross-site POSTs, and Bearer-token mobile
 * clients are unaffected by cookies. Enforcing `Origin` / `Sec-Fetch-Site` on
 * every cookie-bearing state change protects admin and account routes even
 * against same-site subdomain or legacy browser edge cases.
 */
export function csrfProtection(allowedOrigins: string[]): MiddlewareHandler {
  const allowed = new Set(
    allowedOrigins
      .map((origin) => normalizeOrigin(origin.trim()))
      .filter((origin): origin is string => origin !== null)
  );

  return async (c, next) => {
    if (!MUTATING_METHODS.has(c.req.method.toUpperCase())) {
      await next();
      return;
    }

    // Native mobile requests authenticate with Bearer tokens, not browser cookies.
    if (c.req.header("authorization")?.match(/^Bearer\s+/i)) {
      await next();
      return;
    }

    const hasSessionCookie = Boolean(
      getCookie(c, SESSION_COOKIE) || getCookie(c, DEMO_COOKIE)
    );
    if (!hasSessionCookie) {
      await next();
      return;
    }

    const origin = c.req.header("origin");
    if (origin) {
      const normalized = normalizeOrigin(origin);
      if (normalized && allowed.has(normalized)) {
        await next();
        return;
      }
      return c.json(
        { error: { code: "csrf_rejected", message: "Cross-site request rejected." } },
        403
      );
    }

    const fetchSite = c.req.header("sec-fetch-site");
    if (fetchSite === "same-origin" || fetchSite === "none") {
      await next();
      return;
    }

    const referer = c.req.header("referer");
    if (referer) {
      const normalized = normalizeOrigin(referer);
      if (normalized && allowed.has(normalized)) {
        await next();
        return;
      }
    }

    return c.json(
      { error: { code: "csrf_rejected", message: "Cross-site request rejected." } },
      403
    );
  };
}
