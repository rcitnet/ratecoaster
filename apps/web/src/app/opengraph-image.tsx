import { ImageResponse } from "next/og";

/**
 * The social preview card, generated rather than designed.
 *
 * A shared image beats a per-page one here: the alternative is either no image
 * (links render as a bare grey box, which measurably suppresses clicks) or a
 * design task per page that nobody will keep up with. Generated at build time
 * from the same palette as the site, so it cannot drift from the brand.
 */
/*
 * No `runtime = "edge"` here on purpose.
 *
 * The Next examples all set it, and it is wrong for this deployment: the edge
 * runtime is a Vercel construct, and this runs as one Node process on a single
 * Lightsail box. Declaring it bought nothing and cost the build-time render —
 * Next warns "using edge runtime on a page currently disables static
 * generation", meaning the card was regenerated on every crawler request
 * instead of once at build.
 */
export const alt = "RateCoaster — Universal hotel rates, tickets and live wait times";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #3355ee 0%, #e6218c 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
          padding: 80,
        }}
      >
        <div style={{ fontSize: 96, marginBottom: 16 }}>🎢</div>
        <div style={{ fontSize: 82, fontWeight: 700, letterSpacing: -2 }}>RateCoaster</div>
        <div
          style={{
            fontSize: 36,
            marginTop: 24,
            textAlign: "center",
            lineHeight: 1.35,
            opacity: 0.95,
          }}
        >
          Universal hotel rates a year ahead — passholder and public — plus tickets and live
          wait times
        </div>
      </div>
    ),
    size
  );
}
