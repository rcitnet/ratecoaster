import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/**
 * robots.txt.
 *
 * The `sitemap:` line is the part that earns its keep — it is how a crawler
 * finds the sitemap without anyone submitting anything, and it is read by
 * engines that have no webmaster console at all.
 *
 * Note what `disallow` does and does not do: it stops crawling, not indexing.
 * A disallowed URL can still be listed on the strength of inbound links, shown
 * with no description because the crawler was never allowed to look. So the
 * private routes below ALSO carry `noindex` in their own metadata. Belt and
 * braces, because the two directives fix different failures.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          // Affiliate hops. No content, and crawling them would register clicks
          // that no human made.
          "/go/",
          "/api/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
