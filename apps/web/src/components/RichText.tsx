import type { ReactNode } from "react";

/**
 * Renders article text with one piece of markup: `[label](/path)`.
 *
 * Deliberately not a Markdown library. Guides are trusted, hand-written
 * content, and the only thing prose needs that a string cannot express is a
 * link. The pattern accepts site paths and https URLs and nothing else, so a
 * typo cannot produce a `javascript:` href.
 *
 * Plain anchors, never next/link: third-party scripts are installed at the
 * document level and every navigation must be a full document load.
 */
const LINK = /\[([^\]]+)\]\(((?:\/|https:\/\/)[^)\s]*)\)/g;

export function RichText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(LINK)) {
    const start = match.index ?? 0;
    if (start > cursor) parts.push(text.slice(cursor, start));
    const label = match[1] ?? "";
    const href = match[2] ?? "/";
    parts.push(
      href.startsWith("/") ? (
        <a key={`${start}-${href}`} href={href}>{label}</a>
      ) : (
        <a key={`${start}-${href}`} href={href} target="_blank" rel="noreferrer noopener">{label}</a>
      )
    );
    cursor = start + match[0].length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}
