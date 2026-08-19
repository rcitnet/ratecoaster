import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { ENTITLEMENTS, RequestMagicLink, type Tier } from "@ratecoaster/shared";
import {
  SESSION_COOKIE,
  clearSessionCookie,
  consumeMagicLink,
  createMagicLink,
  createSession,
  destroySession,
  resolveOAuthUser,
  setSessionCookie,
} from "../lib/auth.js";
import { tierOf } from "../lib/entitlements.js";
import { emailConfigured, sendMagicLinkEmail } from "../lib/email.js";
import {
  buildGoogleAuthorizeUrl,
  createGoogleOAuthState,
  exchangeGoogleCode,
  readGoogleOAuthState,
  signGoogleOAuthState,
  verifyGoogleIdToken,
} from "../lib/google-oauth.js";

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
 * OAuth — Google
 * ------------------------------------------------------------------ */

const GOOGLE_STATE_COOKIE = "rc_google_oauth";
const OAUTH_COOKIE_SECONDS = 10 * 60;

function googleCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

function googleRedirectUri(): string {
  return `${PUBLIC_API_URL}/v1/auth/oauth/google/callback`;
}

/**
 * GET /v1/auth/oauth/google — start a short-lived, signed OAuth + PKCE flow.
 */
authRouter.get("/oauth/:provider", (c) => {
  const provider = c.req.param("provider");
  if (provider !== "google") {
    return c.json({ error: { code: "unknown_provider", message: "Unsupported provider." } }, 404);
  }

  const credentials = googleCredentials();
  if (!credentials) {
    return c.json(
      {
        error: {
          code: "oauth_not_configured",
          message: "Google sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
        },
      },
      501
    );
  }

  const state = createGoogleOAuthState(safeRedirect(c.req.query("redirectTo")));
  setCookie(c, GOOGLE_STATE_COOKIE, signGoogleOAuthState(state, credentials.clientSecret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
    path: "/",
    maxAge: OAUTH_COOKIE_SECONDS,
  });

  return c.redirect(buildGoogleAuthorizeUrl({
    clientId: credentials.clientId,
    redirectUri: googleRedirectUri(),
    state,
  }));
});

/** Google redirects here after consent; failures disclose no token details. */
authRouter.get("/oauth/google/callback", async (c) => {
  const credentials = googleCredentials();
  const cookie = getCookie(c, GOOGLE_STATE_COOKIE);
  deleteCookie(c, GOOGLE_STATE_COOKIE, { path: "/" });
  const state = credentials
    ? readGoogleOAuthState(cookie, credentials.clientSecret)
    : null;

  const code = c.req.query("code");
  const returnedState = c.req.query("state");
  if (
    !credentials || !state || !code || !returnedState ||
    returnedState !== state.state || c.req.query("error")
  ) {
    return c.redirect(`${WEB_ORIGIN}/auth/error?reason=oauth`);
  }

  try {
    const idToken = await exchangeGoogleCode({
      code,
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      redirectUri: googleRedirectUri(),
      verifier: state.verifier,
    });
    const identity = await verifyGoogleIdToken({
      idToken,
      clientId: credentials.clientId,
      nonce: state.nonce,
    });
    const userId = await resolveOAuthUser({
      provider: "google",
      providerAccountId: identity.subject,
      email: identity.email,
      displayName: identity.displayName,
    });
    const sessionToken = await createSession(userId, c.req.header("user-agent"));
    setSessionCookie(c, sessionToken);
    return c.redirect(`${WEB_ORIGIN}${safeRedirect(state.redirectTo)}`);
  } catch (error) {
    console.error(`[auth] Google OAuth callback failed: ${String(error)}`);
    return c.redirect(`${WEB_ORIGIN}/auth/error?reason=oauth`);
  }
});
