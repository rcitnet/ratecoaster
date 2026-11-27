import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { isValidExpoPushToken, sendExpoPushMessages } from "./push.js";

describe("Expo push delivery", () => {
  test("validates Expo push token format", () => {
    assert.equal(isValidExpoPushToken("ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"), true);
    assert.equal(isValidExpoPushToken("ExpoPushToken[abc-123_XYZ]"), true);
    assert.equal(isValidExpoPushToken("not-a-token"), false);
    assert.equal(isValidExpoPushToken("ExponentPushToken[has space]"), false);
  });

  test("reports delivered tickets and flags DeviceNotRegistered tokens for revocation", async () => {
    const fakeFetch: typeof globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          data: [
            { status: "ok", id: "ticket-1" },
            {
              status: "error",
              message: "Device not registered",
              details: { error: "DeviceNotRegistered" },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );

    const result = await sendExpoPushMessages(
      [
        { to: "ExponentPushToken[valid]", title: "Drop", body: "Hotel dropped" },
        { to: "ExponentPushToken[stale]", title: "Drop", body: "Hotel dropped" },
      ],
      fakeFetch
    );

    assert.equal(result.sent, 1);
    assert.equal(result.failed, 1);
    assert.deepEqual(result.unregisteredTokens, ["ExponentPushToken[stale]"]);
  });
});
