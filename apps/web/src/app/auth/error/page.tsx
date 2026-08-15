export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  return (
    <main className="section" style={{ maxWidth: 560, margin: "0 auto", textAlign: "center" }}>
      <h1 style={{ fontSize: 34 }}>That link didn&apos;t work</h1>
      <p className="lede" style={{ margin: "14px auto 26px" }}>
        {reason === "missing"
          ? "The link was incomplete. Try requesting a new one."
          : "Sign-in links expire after 15 minutes and can only be used once — some email apps open links automatically, which uses them up."}
      </p>
      <a href="/join" className="btn btn-primary btn-lg">
        Send a new link
      </a>
    </main>
  );
}
