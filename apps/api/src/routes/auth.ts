import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { ENTITLEMENTS, RequestMagicLink, type Tier } from "@ratecoaster/shared";
import {
  SESSION_COOKIE,
  clearSessionCookie,
  consumeMagicLink,
  createMagicLink,
  destroySession,
  setSessionCookie,
} from "../lib/auth.js";
import { tierOf } from "../lib/entitlements.js";
import { emailConfigured, sendMagicLinkEmail } from "../lib/email.js";

export const authRouter = new Hono();

const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:3000";
/*
 * The API's own PUBLIC address, e.g. https://ratecoaster.net/api.
 *
 * Distinct from API_BASE_URL, which is the internal address the website uses to
 * reach the API (127.0.0.1:8787). A sign-in link built from the internal
 * address would arrive in someone's inbox pointing at their own machine.
 */
const PUBLIC_API_URL =
  process.env.PUBLIC_API_URL ?? process.env.API_BASE_URL ?? "http://localhost:8787";

/**
 * Only same-origin paths are accepted as post-login redirects. Reflecting an
 * arbitrary `redirectTo` back to the browser is a textbook open redirect, and
 * an open redirect on an auth endpoint is a phishing kit.
 */
function safeRedirect(target: string | undefined): string {
  if (!target) return "/";
  if (!target.startsWith("/") || target.startsWith("//")) return "/";
  return target;
}

/** GET /v1/auth/me — who am I and what do I get. */
authRouter.get("/me", (c) => {
  const tier = tierOf(c);
  const user = c.get("user");

  return c.json({
    user: user
      ? {
          id: user.userId,
          email: user.email,
          tier,
          displayName: user.displayName,
          createdAt: user.createdAt.toISOString(),
        }
      : null,
    entitlements: ENTITLEMENTS[tier],
  });
});

/**
 * POST /v1/auth/magic-link
 *
 * Always responds 200, whether or not the address belongs to an existing
 * account. Returning "no such user" would turn this endpoint into an email
 * enumeration oracle for anyone who wants to know who has signed up.
 */
authRouter.post("/magic-link", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = RequestMagicLink.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "invalid_email", message: "Enter a valid email address." } }, 400);
  }

  const { token, email, expiresInMinutes } = await createMagicLink(
    parsed.data.email,
    safeRedirect(parsed.data.redirectTo)
  );

  // The link points at the API, not the website: the API is what can set the
  // session cookie. It redirects back to the site once the token is redeemed.
  const link = `${PUBLIC_API_URL}/v1/auth/verify?token=${encodeURIComponent(token)}`;

  if (emailConfigured()) {
    const result = await sendMagicLinkEmail(email, link);
    if (!result.sent) {
      // Log the real reason for the operator, show the user something calm.
      console.error(`[auth] failed to send magic link: ${result.reason}`);
      return c.json(
        {
          error: {
            code: "email_failed",
            message: "We couldn't send that email just now. Please try again in a moment.",
          },
        },
        502
      );
    }
    return c.json({ ok: true, message: "Check your email for a sign-in link." });
  }

  // No mail provider configured. In development that is expected, so print the
  // link and carry on. In production it is a misconfiguration worth shouting
  // about rather than silently reporting success.
  if (process.env.NODE_ENV === "production") {
    console.error(
      "[auth] RESEND_API_KEY / EMAIL_FROM are not set — sign-in emails cannot be delivered"
    );
    return c.json(
      {
        error: {
          code: "email_unavailable",
          message: "Sign-in by email isn't switched on yet. Please try again later.",
        },
      },
      503
    );
  }

  console.log(`\n=== MAGIC LINK for ${email} (valid ${expiresInMinutes}m) ===\n${link}\n`);

  return c.json({
    ok: true,
    message: "Check your email for a sign-in link.",
    // Dev-only convenience so the flow is testable without a mail provider.
    devLink: link,
  });
});

/** GET /v1/auth/verify?token=… — redeem the link, set the cookie, bounce back. */
authRouter.get("/verify", async (c) => {
  const token = c.req.query("token");
  if (!token) return c.redirect(`${WEB_ORIGIN}/auth/error?reason=missing`);

  const result = await consumeMagicLink(token, c.req.header("user-agent"));
  if (!result) {
    // Expired, already used, or forged — all the same message, so a probe
    // learns nothing about which.
    return c.redirect(`${WEB_ORIGIN}/auth/error?reason=invalid`);
  }

  setSessionCookie(c, result.sessionToken);
  return c.redirect(`${WEB_ORIGIN}${safeRedirect(result.redirectTo ?? "/")}`);
});

authRouter.post("/logout", async (c) => {
  await destroySession(getCookie(c, SESSION_COOKIE));
  clearSessionCookie(c);
  return c.json({ ok: true });
});

/* ------------------------------------------------------------------ *
 * OAuth — Google and Apple
 * ------------------------------------------------------------------ */

const OAUTH_CONFIG = {
  google: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    scope: "openid email profile",
    clientId: () => process.env.GOOGLE_CLIENT_ID,
  },
  apple: {
    authorizeUrl: "https://appleid.apple.com/auth/authorize",
    scope: "name email",
    clientId: () => process.env.APPLE_CLIENT_ID,
  },
} as const;

/**
 * GET /v1/auth/oauth/:provider — kick off the flow.
 *
 * Returns 501 with an actionable message when credentials are absent, rather
 * than redirecting to a broken consent screen. Apple in particular is required
 * by App Store review once any third-party sign-in exists, so the mobile app
 * will need this configured before it can ship.
 */
authRouter.get("/oauth/:provider", (c) => {
  const provider = c.req.param("provider") as keyof typeof OAUTH_CONFIG;
  const config = OAUTH_CONFIG[provider];
  if (!config) {
    return c.json({ error: { code: "unknown_provider", message: "Unsupported provider." } }, 404);
  }

  const clientId = config.clientId();
  if (!clientId) {
    return c.json(
      {
        error: {
          code: "oauth_not_configured",
          message: `${provider} sign-in is not configured. Set ${provider.toUpperCase()}_CLIENT_ID and ${provider.toUpperCase()}_CLIENT_SECRET.`,
        },
      },
      501
    );
  }

  const state = crypto.randomUUID();
  const url = new URL(config.authorizeUrl);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", `${PUBLIC_API_URL}/v1/auth/oauth/${provider}/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scope);
  url.searchParams.set("state", state);
  if (provider === "apple") url.searchParams.set("response_mode", "form_post");

  return c.redirect(url.toString());
});

authRouter.get("/oauth/:provider/callback", (c) =>
  c.json(
    {
      error: {
        code: "oauth_not_configured",
        message:
          "Token exchange needs real client credentials. See README section 'Enabling Google and Apple sign-in'.",
      },
    },
    501
  )
);
