import { travelpayoutsLoaderSource } from "@/lib/travelpayouts";

/**
 * Travelpayouts asks for its bootstrap at the start of <head>. This is a plain
 * script rather than next/script because the bootstrap itself creates the
 * async remote tag and its placement is part of their installation check.
 *
 * The pasted snippet also contained attributes for WordPress caching plugins
 * (WP Rocket, WP Fastest Cache, Seraphinite). RateCoaster is a Next.js app, so
 * those flags would be inert. data-cfasync and data-cmp-ab are retained because
 * they can affect the actual production environment and Travelpayouts CMP mode.
 */
export function TravelpayoutsDrive() {
  return (
    <script
      id="ratecoaster-travelpayouts-drive"
      data-cfasync="false"
      data-cmp-ab="2"
      dangerouslySetInnerHTML={{ __html: travelpayoutsLoaderSource() }}
    />
  );
}
