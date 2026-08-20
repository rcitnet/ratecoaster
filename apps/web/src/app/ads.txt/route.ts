/** Public AdSense authorization record for RateCoaster. */
export function GET() {
  return new Response("google.com, pub-9805566407128224, DIRECT, f08c47fec0942fa0\n", {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
