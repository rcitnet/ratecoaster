import { NextResponse } from "next/server";

const ANDROID_PACKAGE = process.env.ANDROID_APP_PACKAGE?.trim() || "net.ratecoaster.app";

/**
 * Android App Links verification file (`/.well-known/assetlinks.json`).
 *
 * Set `ANDROID_APP_SHA256_CERT_FINGERPRINTS` to a comma-separated list of
 * colon-delimited SHA-256 signing certificate fingerprints from Play Console
 * or EAS before shipping release builds.
 */
export function GET() {
  const fingerprints = (process.env.ANDROID_APP_SHA256_CERT_FINGERPRINTS ?? "")
    .split(",")
    .map((fp) => fp.trim().toUpperCase())
    .filter((fp) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(fp));

  if (fingerprints.length === 0) {
    return NextResponse.json([], {
      status: 200,
      headers: { "cache-control": "public, max-age=300" },
    });
  }

  return NextResponse.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: ANDROID_PACKAGE,
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ],
    {
      status: 200,
      headers: { "cache-control": "public, max-age=3600" },
    }
  );
}
