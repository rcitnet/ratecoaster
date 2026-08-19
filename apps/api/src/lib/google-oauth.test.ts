import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import {
  buildGoogleAuthorizeUrl,
  createGoogleOAuthState,
  googlePkceChallenge,
  readGoogleOAuthState,
  signGoogleOAuthState,
  verifyGoogleIdToken,
} from "./google-oauth.js";

describe("Google OAuth state", () => {
  test("round-trips signed state and rejects tampering or expiry", () => {
    const now = Date.UTC(2026, 7, 19, 3, 0, 0);
    const state = createGoogleOAuthState("/plan?checkIn=2026-10-01", now);
    const signed = signGoogleOAuthState(state, "test-client-secret");

    assert.deepEqual(readGoogleOAuthState(signed, "test-client-secret", now + 60_000), state);
    assert.equal(readGoogleOAuthState(`${signed}x`, "test-client-secret", now), null);
    assert.equal(readGoogleOAuthState(signed, "wrong-secret", now), null);
    assert.equal(readGoogleOAuthState(signed, "test-client-secret", now + 11 * 60_000), null);
  });

  test("builds an OpenID authorization request with nonce and PKCE", () => {
    const state = createGoogleOAuthState("/", Date.UTC(2026, 7, 19));
    const url = new URL(buildGoogleAuthorizeUrl({
      clientId: "client.apps.googleusercontent.com",
      redirectUri: "https://ratecoaster.net/api/v1/auth/oauth/google/callback",
      state,
    }));

    assert.equal(url.origin, "https://accounts.google.com");
    assert.equal(url.searchParams.get("response_type"), "code");
    assert.equal(url.searchParams.get("scope"), "openid email profile");
    assert.equal(url.searchParams.get("state"), state.state);
    assert.equal(url.searchParams.get("nonce"), state.nonce);
    assert.equal(url.searchParams.get("code_challenge"), googlePkceChallenge(state.verifier));
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  });
});

describe("Google identity token verification", () => {
  const now = Date.UTC(2026, 7, 19, 3, 0, 0);
  const clientId = "client.apps.googleusercontent.com";
  const nonce = "ratecoaster-test-nonce";
  const kid = randomUUID();
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid, use: "sig", alg: "RS256" };
  const fetchKeys = (async () => new Response(JSON.stringify({ keys: [jwk] }), {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "public, max-age=300" },
  })) as typeof fetch;

  function token(overrides: Record<string, unknown> = {}): string {
    const encodedHeader = Buffer.from(JSON.stringify({ alg: "RS256", kid, typ: "JWT" })).toString("base64url");
    const encodedClaims = Buffer.from(JSON.stringify({
      iss: "https://accounts.google.com",
      aud: clientId,
      sub: "google-user-123",
      email: "Traveler@Example.com",
      email_verified: true,
      name: "Theme Park Traveler",
      nonce,
      iat: Math.floor(now / 1000) - 30,
      exp: Math.floor(now / 1000) + 300,
      ...overrides,
    })).toString("base64url");
    const unsigned = `${encodedHeader}.${encodedClaims}`;
    const signature = sign("RSA-SHA256", Buffer.from(unsigned), privateKey).toString("base64url");
    return `${unsigned}.${signature}`;
  }

  test("accepts a correctly signed token and normalizes identity data", async () => {
    assert.deepEqual(
      await verifyGoogleIdToken({ idToken: token(), clientId, nonce, fetchImpl: fetchKeys, now }),
      {
        subject: "google-user-123",
        email: "traveler@example.com",
        displayName: "Theme Park Traveler",
      }
    );
  });

  test("rejects the wrong audience, nonce, or unverified email", async () => {
    await assert.rejects(
      verifyGoogleIdToken({ idToken: token({ aud: "another-client" }), clientId, nonce, fetchImpl: fetchKeys, now }),
      /audience/
    );
    await assert.rejects(
      verifyGoogleIdToken({ idToken: token({ nonce: "wrong" }), clientId, nonce, fetchImpl: fetchKeys, now }),
      /nonce/
    );
    await assert.rejects(
      verifyGoogleIdToken({ idToken: token({ email_verified: false }), clientId, nonce, fetchImpl: fetchKeys, now }),
      /verified email/
    );
  });
});
