import sharp from "sharp";

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]!);
}

export async function renderSocialImage(post: { kind: string; body: string; url: string | null }): Promise<Buffer> {
  // The card uses the saved snapshot, never a newly fetched price or wait time.
  const lines = post.body.replace(/[\u{1F300}-\u{1FAFF}\uFE0F]/gu, "").trim().split("\n").flatMap((paragraph) => {
    const wrapped: string[] = [];
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      if (line && (line + " " + word).length > 36) { wrapped.push(line); line = ""; }
      line += (line ? " " : "") + word;
    }
    return [...wrapped, line];
  });
  if (lines.length > 12 || lines.some((line) => line.length > 42)) throw new Error("Social card text does not fit; shorten the saved post before publishing.");
  const fontSize = lines.length > 9 ? 34 : 40;
  const spacing = lines.length > 9 ? 46 : 58;
  const site = post.url ? new URL(post.url).hostname : "RateCoaster";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080">
    <rect width="1080" height="1080" fill="#f7f5ef"/>
    <rect width="1080" height="18" fill="#d95132"/>
    <path d="M0 130 Q160 20 320 130 T640 130 T1080 130" fill="none" stroke="#dfebe3" stroke-width="8"/>
    <text x="72" y="112" font-family="sans-serif" font-size="48" font-weight="bold" fill="#183e36">RateCoaster</text>
    <text x="72" y="225" font-family="sans-serif" font-size="24" letter-spacing="3" fill="#a23c25">${post.kind === "hotel-deal" ? "HOTEL DEAL" : "PARK WAIT UPDATE"}</text>
    ${lines.map((line, i) => `<text x="72" y="${315 + i * spacing}" font-family="sans-serif" font-size="${fontSize}" fill="#183e36">${escapeXml(line)}</text>`).join("")}
    <path d="M72 940 H1008" stroke="#c9d5cb" stroke-width="2"/>
    <text x="72" y="995" font-family="sans-serif" font-size="28" font-weight="bold" fill="#183e36">${escapeXml(site)}</text>
    <text x="72" y="1033" font-family="sans-serif" font-size="22" fill="#52685d">A snapshot in time. Check the site for current availability.</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
}
