import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8787";

/**
 * GET /go/l/:key — outbound hop for named destinations.
 *
 * The product equivalent lives at /go/ticket/:slug. This one covers the CTAs
 * that have no tracked product behind them — "compare hotel prices" and the
 * like — and resolves against a fixed registry, so a page can never cause a
 * redirect to somewhere arbitrary.
 */
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const from = request.nextUrl.searchParams.get("from") ?? request.headers.get("referer");
  const fallback = new URL("/", request.nextUrl.origin);

  try {
    const url = new URL(`${API_BASE_URL}/v1/outbound/link/${encodeURIComponent(key)}`);
    if (from) url.searchParams.set("from", from);

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return NextResponse.redirect(fallback, 302);

    const data = (await res.json()) as { url?: string };
    if (!data.url) return NextResponse.redirect(fallback, 302);

    const response = NextResponse.redirect(data.url, 302);
    response.headers.set("x-robots-tag", "noindex, nofollow");
    response.headers.set("cache-control", "no-store");
    return response;
  } catch (err) {
    console.error(`[go] failed to resolve link/${key}:`, err);
    return NextResponse.redirect(fallback, 302);
  }
}
