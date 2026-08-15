import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import type { Context, MiddlewareHandler } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Tier } from "@parkpulse/shared";
import { getDb } from "@parkpulse/db";
import { magicLinkTokens, sessions, users } from "@parkpulse/db/schema";

export const SESSION_COOKIE = "pp_session";
const SESSION_DAYS = 60;
const MAGIC_LINK_MINUTES = 15;

/**
 * Tokens are random 32-byte values shown to the user exactly once and stored
 * only as SHA-256 hashes. A database compromise then leaks no usable
 * credentials, and there is no plaintext secret sitting in a backup somewhere.
 */
function newToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Constant-time compare, so timing cannot be used to probe for valid tokens. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/* ------------------------------------------------------------------ *
 * Magic links
 * ------------------------------------------------------------------ */

export async function createMagicLink(email: string, redirectTo?: string) {
  const db = getDb();
  const normalized = email.trim().toLowerCase();
  const { token, hash } = newToken();

  await db.insert(magicLinkTokens).values({
    email: normalized,
    tokenHash: hash,
    redirectTo: redirectTo ?? null,
    expiresAt: new Date(Date.now() + MAGIC_LINK_MINUTES * 60_000),
  });

  return { token, email: normalized, expiresInMinutes: MAGIC_LINK_MINUTES };
}

/**
 * Redeems a magic link and returns the session token.
 *
 * The token row is marked consumed inside the same UPDATE that checks it is
 * unconsumed, so two simultaneous clicks (email scanners routinely prefetch
 * links) cannot both succeed.
 */
export async function consumeMagicLink(
  token: string,
  userAgent?: string
): Promise<{ sessionToken: string; userId: string; email: string; redirectTo: string | null } | null> {
  const db = getDb();
  const hash = hashToken(token);

  const claimed = await db
    .update(magicLinkTokens)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(magicLinkTokens.tokenHash, hash),
        isNull(magicLinkTokens.consumedAt),
        gt(magicLinkTokens.expiresAt, new Date())
      )
    )
    .returning({
      email: magicLinkTokens.email,
      redirectTo: magicLinkTokens.redirectTo,
    });

  const row = claimed[0];
  if (!row) return null;

  const userId = await upsertUserByEmail(row.email);
  const sessionToken = await createSession(userId, userAgent);
  return { sessionToken, userId, email: row.email, redirectTo: row.redirectTo };
}

export async function upsertUserByEmail(email: string): Promise<string> {
  const db = getDb();
  const normalized = email.trim().toLowerCase();

  const [user] = await db
    .insert(users)
    .values({ email: normalized, tier: "free", emailVerifiedAt: new Date() })
    .onConflictDoUpdate({
      target: users.email,
      set: { emailVerifiedAt: new Date(), lastSeenAt: new Date() },
    })
    .returning({ id: users.id });

  return user!.id;
}

/* ------------------------------------------------------------------ *
 * Sessions
 * ------------------------------------------------------------------ */

export async function createSession(userId: string, userAgent?: string): Promise<string> {
  const db = getDb();
  const { token, hash } = newToken();
  await db.insert(sessions).values({
    userId,
    tokenHash: hash,
    userAgent: userAgent ?? null,
    expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000),
  });
  return token;
}

export function setSessionCookie(c: Context, token: string) {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true, // not readable by JS, so XSS cannot exfiltrate it
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax", // survives the redirect back from Google/Apple
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export function clearSessionCookie(c: Context) {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

export async function resolveSession(token: string | undefined) {
  if (!token) return null;
  const db = getDb();

  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      tier: users.tier,
      displayName: users.displayName,
      createdAt: users.createdAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);

  return rows[0] ?? null;
}

export async function destroySession(token: string | undefined) {
  if (!token) return;
  await getDb().delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

/* ------------------------------------------------------------------ *
 * Middleware
 * ------------------------------------------------------------------ */

/**
 * Resolves the caller's tier onto the request context.
 *
 * Runs on every route including public ones, because "anonymous" is a tier with
 * real entitlements rather than an absence of one. Routes then never branch on
 * "is there a user" — they ask what the tier allows, which is the same question
 * for a signed-out visitor and a Pro subscriber.
 */
export const authMiddleware: MiddlewareHandler = async (c, next) => {
  // A bearer token covers the mobile app, where cookies are awkward; the cookie
  // covers the web app. Same session records either way.
  const bearer = c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
  const token = bearer || getCookie(c, SESSION_COOKIE);

  let tier: Tier = "anonymous";
  let user = null;

  if (token) {
    try {
      const session = await resolveSession(token);
      if (session) {
        tier = session.tier as Tier;
        user = session;
      }
    } catch (err) {
      // A database blip must degrade to anonymous, not 500 the whole site.
      console.error("[auth] session lookup failed:", err);
    }
  }

  c.set("tier", tier);
  c.set("user", user);
  await next();
};

/** Touch `lastSeenAt` at most once an hour, to keep writes off the hot path. */
export async function touchLastSeen(userId: string) {
  await getDb()
    .update(users)
    .set({ lastSeenAt: new Date() })
    .where(
      and(
        eq(users.id, userId),
        sql`(${users.lastSeenAt} is null or ${users.lastSeenAt} < now() - interval '1 hour')`
      )
    );
}
