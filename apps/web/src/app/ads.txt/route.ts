export const dynamic = "force-dynamic";

/** Serve an accurate ads.txt only after an AdSense publisher id is configured. */
export function GET() {
  const configured = process.env.ADSENSE_PUBLISHER_ID?.trim();
  const publisher = configured?.startsWith("pub-") ? configured : null;
  if (!publisher) return new Response("Not configured\n", { status: 404 });

  return new Response(`google.com, ${publisher}, DIRECT, f08c47fec0942fa0\n`, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
