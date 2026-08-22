import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildAffiliateLink,
  buildMerchantLink,
  NAMED_LINKS,
  normalizeSid,
  UnsafeDestinationError,
} from "./affiliate.js";

const UT = "undercover-tourist";

test("wraps a destination in the evergreen deep link", () => {
  const url = buildAffiliateLink({
    merchant: UT,
    destinationUrl: "https://www.undercovertourist.com/universal-orlando/3-day-park-to-park/",
    sid: "ticket_uo_3day_p2p",
  });

  const parsed = new URL(url);
  assert.equal(parsed.hostname, "www.jdoqocy.com");
  /*
   * Publisher 101861754, creative 11556282 — these are copied from a link CJ's
   * own Deep Link Generator produced and that was confirmed in a browser. The
   * catalogue export's "deep-link enabled" creative (15733832) returns an error
   * page, so this test is pinning verified reality, not documentation.
   */
  assert.equal(parsed.pathname, "/click-101861754-11556282");
  assert.equal(
    parsed.searchParams.get("url"),
    "https://www.undercovertourist.com/universal-orlando/3-day-park-to-park/"
  );
  assert.equal(parsed.searchParams.get("sid"), "ticket_uo_3day_p2p");
});

test("percent-encodes the destination so its query string survives", () => {
  // A raw ?a=b in the destination would otherwise be read as a parameter of the
  // tracking link, and the visitor would land on the merchant's homepage.
  const url = buildAffiliateLink({
    merchant: UT,
    destinationUrl: "https://www.undercovertourist.com/search/?q=universal&days=3",
  });
  assert.ok(url.includes("url=https%3A%2F%2Fwww.undercovertourist.com%2Fsearch%2F%3Fq%3Duniversal%26days%3D3"));
  assert.equal(new URL(url).searchParams.get("url"), "https://www.undercovertourist.com/search/?q=universal&days=3");
});

test("refuses a destination on another domain", () => {
  // This endpoint sits on our own domain, so following an arbitrary URL would
  // hand an attacker a first-party open redirect to phish with.
  assert.throws(
    () =>
      buildAffiliateLink({
        merchant: UT,
        destinationUrl: "https://evil.example.com/phish",
      }),
    UnsafeDestinationError
  );
});

test("refuses a lookalike subdomain", () => {
  assert.throws(
    () =>
      buildAffiliateLink({
        merchant: UT,
        destinationUrl: "https://undercovertourist.com.evil.example/x",
      }),
    UnsafeDestinationError
  );
});

test("refuses non-https and non-URL destinations", () => {
  assert.throws(
    () => buildAffiliateLink({ merchant: UT, destinationUrl: "http://www.undercovertourist.com/" }),
    UnsafeDestinationError
  );
  assert.throws(
    () => buildAffiliateLink({ merchant: UT, destinationUrl: "javascript:alert(1)" }),
    UnsafeDestinationError
  );
  assert.throws(
    () => buildAffiliateLink({ merchant: UT, destinationUrl: "not a url" }),
    UnsafeDestinationError
  );
});

test("rejects an unknown merchant rather than guessing", () => {
  assert.throws(
    () => buildAffiliateLink({ merchant: "nobody", destinationUrl: "https://example.com" }),
    /unknown merchant/
  );
});

test("builds a bare merchant link when there is no product destination", () => {
  assert.equal(
    buildMerchantLink(UT, "tickets_index"),
    "https://www.jdoqocy.com/click-101861754-11556282?sid=tickets_index"
  );
  assert.equal(
    buildMerchantLink(UT),
    "https://www.jdoqocy.com/click-101861754-11556282"
  );
});

test("normalizes sub-ids to what the network will accept", () => {
  // CJ silently drops values outside a short alphanumeric token, which would
  // lose the attribution without any error to notice.
  assert.equal(normalizeSid("Tickets / UO 3-Day P2P"), "tickets_uo_3_day_p2p");
  assert.equal(normalizeSid("  spaced  out  "), "spaced_out");
  assert.equal(normalizeSid("!!!"), "");
  assert.equal(normalizeSid("a".repeat(100)).length, 64);
});

test("every named destination is a URL the allowlist accepts", () => {
  // These are hand-verified pages on the merchant's site. If one is ever edited
  // into a different host or a non-https URL, this fails here rather than
  // silently rendering a button that goes nowhere.
  for (const link of Object.values(NAMED_LINKS)) {
    assert.doesNotThrow(
      () => buildAffiliateLink({ merchant: link.merchant, destinationUrl: link.url }),
      `${link.key} -> ${link.url}`
    );
  }
});

test("omits sid entirely when it normalizes to nothing", () => {
  const url = buildAffiliateLink({
    merchant: UT,
    destinationUrl: "https://www.undercovertourist.com/",
    sid: "###",
  });
  assert.equal(new URL(url).searchParams.has("sid"), false);
});
