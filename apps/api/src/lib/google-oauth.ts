import {
  createHash,
  createHmac,
  createPublicKey,
  randomBytes,
  timingSafeEqual,
  verify,
} from "node:crypto";
import type { JsonWebKey } from "node:crypto";

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const STATE_TTL_SECONDS = 10 * 60;
const CLOCK_SKEW_SECONDS = 60;

export interface GoogleOAuthState {
  state: string;
  verifier: string;
  nonce: string;
  redirectTo: string;
  issuedAt: number;
}

export interface GoogleIdentity {
  subject: string;
  email: string;
  displayName: string | null;
}

type FetchLike = typeof fetch;

function base64url(value: Buffer | string): string {
  return Buffer.from(value).toString("base64url");
}

function objectOf(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function jsonPart(encoded: string): Record<string, unknown> {
  const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  const object = objectOf(parsed);
  if (!object) throw new Error("OAuth token section was not an object");
  return object;
}

function hmac(value: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(value).digest();
}

export function createGoogleOAuthState(redirectTo: string, now = Date.now()): GoogleOAuthState {
  return {
    state: randomBytes(32).toString("base64url"),
    verifier: randomBytes(48).toString("base64url"),
    nonce: randomBytes(32).toString("base64url"),
    redirectTo,
    issuedAt: Math.floor(now / 1000),
  };
}

/** Signed, short-lived browser state. The PKCE verifier never reaches JavaScript. */
export function signGoogleOAuthState(payload: GoogleOAuthState, secret: string): string {
  const encoded = base64url(JSON.stringify(payload));
  return `${encoded}.${hmac(encoded, secret).toString("base64url")}`;
}

export function readGoogleOAuthState(
  token: string | undefined,
  secret: string,
  now = Date.now()
): GoogleOAuthState | null {
  if (!token || !secret) return null;
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra) return null;

  const expected = hmac(encoded, secret);
  const supplied = Buffer.from(signature, "base64url");
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<GoogleOAuthState>;
    if (
      typeof parsed.state !== "string" || parsed.state.length < 32 ||
      typeof parsed.verifier !== "string" || parsed.verifier.length < 43 ||
      typeof parsed.nonce !== "string" || parsed.nonce.length < 32 ||
      typeof parsed.redirectTo !== "string" || !parsed.redirectTo.startsWith("/") ||
      parsed.redirectTo.startsWith("//") ||
      typeof parsed.issuedAt !== "number"
    ) {
      return null;
    }
    const age = Math.floor(now / 1000) - parsed.issuedAt;
    if (age < -CLOCK_SKEW_SECONDS || age > STATE_TTL_SECONDS) return null;
    return parsed as GoogleOAuthState;
  } catch {
    return null;
  }
}

export function googlePkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function buildGoogleAuthorizeUrl(args: {
  clientId: string;
  redirectUri: string;
  state: GoogleOAuthState;
}): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", args.clientId);
  url.searchParams.set("redirect_uri", args.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", args.state.state);
  url.searchParams.set("nonce", args.state.nonce);
  url.searchParams.set("code_challenge", googlePkceChallenge(args.state.verifier));
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export async function exchangeGoogleCode(args: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  verifier: string;
  fetchImpl?: FetchLike;
}): Promise<string> {
  const fetchImpl = args.fetchImpl ?? fetch;
  const response = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      code: args.code,
      client_id: args.clientId,
      client_secret: args.clientSecret,
      redirect_uri: args.redirectUri,
      grant_type: "authorization_code",
      code_verifier: args.verifier,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const payload: unknown = await response.json().catch(() => null);
  const idToken = objectOf(payload)?.id_token;
  if (!response.ok || typeof idToken !== "string") {
    throw new Error(`Google token exchange failed with HTTP ${response.status}`);
  }
  return idToken;
}

interface CachedKey {
  key: JsonWebKey;
  expiresAt: number;
}

const keyCache = new Map<string, CachedKey>();

async function googleJwk(kid: string, fetchImpl: FetchLike, now: number): Promise<JsonWebKey> {
  const cached = keyCache.get(kid);
  if (cached && cached.expiresAt > now) return cached.key;

  const response = await fetchImpl(JWKS_URL, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  const payload: unknown = await response.json().catch(() => null);
  const keys = objectOf(payload)?.keys;
  if (!response.ok || !Array.isArray(keys)) {
    throw new Error(`Google signing-key request failed with HTTP ${response.status}`);
  }

  const maxAge = /max-age=(\d+)/i.exec(response.headers.get("cache-control") ?? "")?.[1];
  const expiresAt = now + Math.max(60, Number(maxAge ?? 3600)) * 1000;
  for (const candidate of keys) {
    const jwk = objectOf(candidate);
    if (typeof jwk?.kid === "string" && jwk.kty === "RSA") {
      keyCache.set(jwk.kid, { key: jwk as JsonWebKey, expiresAt });
    }
  }

  const found = keyCache.get(kid);
  if (!found) throw new Error("Google identity token used an unknown signing key");
  return found.key;
}

/** Verify signature and every identity-bearing OIDC claim before account linking. */
export async function verifyGoogleIdToken(args: {
  idToken: string;
  clientId: string;
  nonce: string;
  fetchImpl?: FetchLike;
  now?: number;
}): Promise<GoogleIdentity> {
  const parts = args.idToken.split(".");
  if (parts.length !== 3) throw new Error("Google identity token was malformed");
  const [encodedHeader, encodedClaims, encodedSignature] = parts as [string, string, string];
  const header = jsonPart(encodedHeader);
  const claims = jsonPart(encodedClaims);
  if (header.alg !== "RS256" || typeof header.kid !== "string") {
    throw new Error("Google identity token used an unsupported signing algorithm");
  }

  const now = args.now ?? Date.now();
  const jwk = await googleJwk(header.kid, args.fetchImpl ?? fetch, now);
  const validSignature = verify(
    "RSA-SHA256",
    Buffer.from(`${encodedHeader}.${encodedClaims}`),
    createPublicKey({ key: jwk, format: "jwk" }),
    Buffer.from(encodedSignature, "base64url")
  );
  if (!validSignature) throw new Error("Google identity token signature was invalid");

  const nowSeconds = Math.floor(now / 1000);
  if (claims.iss !== "https://accounts.google.com" && claims.iss !== "accounts.google.com") {
    throw new Error("Google identity token issuer was invalid");
  }
  if (claims.aud !== args.clientId) throw new Error("Google identity token audience was invalid");
  if (claims.nonce !== args.nonce) throw new Error("Google identity token nonce was invalid");
  if (typeof claims.exp !== "number" || claims.exp < nowSeconds - CLOCK_SKEW_SECONDS) {
    throw new Error("Google identity token expired");
  }
  if (typeof claims.iat !== "number" || claims.iat > nowSeconds + CLOCK_SKEW_SECONDS) {
    throw new Error("Google identity token issued-at time was invalid");
  }
  if (typeof claims.sub !== "string" || claims.sub.length === 0) {
    throw new Error("Google identity token subject was missing");
  }
  if (typeof claims.email !== "string" || claims.email.length === 0 || claims.email_verified !== true) {
    throw new Error("Google did not return a verified email address");
  }

  return {
    subject: claims.sub,
    email: claims.email.trim().toLowerCase(),
    displayName: typeof claims.name === "string" && claims.name.trim() ? claims.name.trim() : null,
  };
}
