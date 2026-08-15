/**
 * App Router 404.
 *
 * Not optional. Without this file Next falls back to the old Pages Router error
 * page during a production build, which pulls in `next/document` and fails the
 * build with "<Html> should not be imported outside of pages/_document" — an
 * error that never appears in `next dev`, so it only surfaces at deploy time.
 */
export default function NotFound() {
  return (
    <main className="section" style={{ textAlign: "center", maxWidth: 560, margin: "0 auto" }}>
      <div style={{ fontSize: 64, lineHeight: 1 }} aria-hidden="true">
        🎢
      </div>
      <h1 style={{ marginTop: 16 }}>This page took a wrong turn</h1>
      <p className="lede" style={{ margin: "14px auto 26px" }}>
        We couldn&apos;t find that one. The deals are still where you left them.
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        <a href="/" className="btn btn-primary btn-lg">
          Back to deals
        </a>
        <a href="/waits" className="btn btn-ghost btn-lg">
          Live wait times
        </a>
      </div>
    </main>
  );
}
