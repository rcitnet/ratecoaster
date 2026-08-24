import type { MetadataRoute } from "next";
import { GUIDES } from "@/lib/guides";
import { SITE_URL } from "@/lib/seo";
import { getClient, safe } from "@/lib/api";

/**
 * The sitemap, built from real data rather than a hardcoded list.
 *
 * Hotel pages come from the API, so a property added to the database appears in
 * the sitemap on the next revalidation with nobody remembering to edit a file.
 * A hand-maintained list is the kind of thing that is correct on the day it is
 * written and quietly wrong three months later.
 *
 * Deliberately absent: /admin, /account, /join, /auth and /go. A sitemap is a
 * statement that a URL deserves indexing, and none of those do.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  /*
   * `changeFrequency` and `priority` are hints Google has said it largely
   * ignores. They are here because Bing still reads them and they cost nothing;
   * they are not load-bearing, and no time should be spent tuning them.
   */
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/hotels`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/tickets`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/planner`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/plan`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/express-pass`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/waits`, changeFrequency: "hourly", priority: 0.8 },
    { url: `${SITE_URL}/guides`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];

  const guideRoutes: MetadataRoute.Sitemap = GUIDES.map((guide) => ({
    url: `${SITE_URL}/guides/${guide.slug}`,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  /*
   * A failed API call must not produce an empty sitemap. Submitting one that
   * suddenly drops every hotel is a strong signal to Google that those pages
   * are gone, and re-crawling them afterwards takes far longer than the outage
   * did. Falling back to the static routes keeps the file honest and small.
   */
  const client = await getClient();
  const properties = await safe(client.listProperties(), []);

  const hotelRoutes: MetadataRoute.Sitemap = properties.map((property) => ({
    url: `${SITE_URL}/hotels/${property.slug}`,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  return [...staticRoutes, ...guideRoutes, ...hotelRoutes];
}
