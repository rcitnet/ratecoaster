import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  escapeHtml,
  magicLinkHtml,
  priceDropHtml,
  trustedEmailUrl,
} from "./email.js";

describe("transactional email safety", () => {
  test("escapes text and attribute delimiters", () => {
    assert.equal(
      escapeHtml(`<a title="x">Rui's & friends</a>`),
      "&lt;a title=&quot;x&quot;&gt;Rui&#39;s &amp; friends&lt;/a&gt;"
    );
  });

  test("accepts only HTTP links on the configured first-party origin", () => {
    assert.equal(
      trustedEmailUrl("https://ratecoaster.net/api/v1/auth/verify?token=abc", "https://ratecoaster.net/api"),
      "https://ratecoaster.net/api/v1/auth/verify?token=abc"
    );
    assert.equal(trustedEmailUrl("https://evil.example/verify", "https://ratecoaster.net/api"), null);
    assert.equal(trustedEmailUrl("https://attacker@ratecoaster.net/verify", "https://ratecoaster.net/api"), null);
    assert.equal(trustedEmailUrl("javascript:alert(1)", "https://ratecoaster.net/api"), null);
  });

  test("escapes every dynamic field in price alerts", () => {
    const input = {
        to: "traveler@example.com",
        hotelName: `<img src=x onerror="alert(1)">`,
        checkIn: "2026-10-01",
        checkOut: "2026-10-04",
        currentCents: 49_900,
        previousCents: 55_000,
        rateLabel: `Passholder & "special"`,
        url: "https://ratecoaster.net/hotels/portofino?x=1&y=2",
      };
    const html = priceDropHtml(
      input,
      "Rate<Coaster>",
      5_100,
      input.url,
      "https://ratecoaster.net/account"
    );

    assert.doesNotMatch(html, /<img src=x/);
    assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
    assert.match(html, /Passholder &amp; &quot;special&quot;/);
    assert.match(html, /Rate&lt;Coaster&gt;/);
    assert.match(html, /x=1&amp;y=2/);
  });

  test("escapes magic-link attributes and branding", () => {
    const html = magicLinkHtml(
      "https://ratecoaster.net/api/v1/auth/verify?token=a&next=b",
      `Rate\"Coaster<script>`,
    );
    assert.match(html, /token=a&amp;next=b/);
    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /Rate&quot;Coaster&lt;script&gt;/);
  });
});
