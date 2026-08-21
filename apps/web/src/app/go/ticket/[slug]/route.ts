import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8787";

/**
 * GET /go/ticket/:slug — the outbound hop for affiliate links.
 *
 * Everything leaves the site through here rather than through a raw network URL
 * in the markup, which buys four things at once:
 *
 *   1. Links change in the database without a deploy.
 *   2. Clicks are counted first-party, so we learn which page earned. The
 *      network cannot tell us that — we deep-link every product through a
 *      single evergreen creative, so their reporting sees one link.
 *   3. `rel="sponsored"` and the FTC disclosure live in one component rather
 *      than in every page that happens to show a price.
 *   4. Long tracking URLs stay out of the HTML, where they leak the publisher
 *      ID to anyone scraping the page.
 *
 * 302, not 301: the destination genuinely changes over time, and a permanent
 * redirect gets cached hard by browsers and is very difficult to take back.
 */
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const from = request.nextUrl.searchParams.get("from") ?? request.headers.get("referer");
  const fallback = new URL("/tickets", request.nextUrl.origin);

  try {
    const url = new URL(`${API_BASE_URL}/v1/outbound/ticket/${encodeURIComponent(slug)}`);
    if (from) url.searchParams.set("from", from);

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      // Somewhere useful beats an error page: from the visitor's side this is a
      // button that did nothing, and the ticket list is what they wanted anyway.
      return NextResponse.redirect(fallback, 302);
    }

    const data = (await res.json()) as { url?: string };
    if (!data.url) return NextResponse.redirect(fallback, 302);

    const response = NextResponse.redirect(data.url, 302);
    // An affiliate hop has no business in a search index.
    response.headers.set("x-robots-tag", "noindex, nofollow");
    response.headers.set("cache-control", "no-store");
    return response;
  } catch (err) {
    console.error(`[go] failed to resolve ticket/${slug}:`, err);
    return NextResponse.redirect(fallback, 302);
  }
}
