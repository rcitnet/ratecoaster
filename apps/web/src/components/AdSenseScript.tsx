"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

const AD_FREE_PREFIXES = ["/account", "/admin", "/auth", "/join", "/privacy", "/terms"];

/** Load the network once, and never load it at all on account or legal pages. */
export function AdSenseScript() {
  const pathname = usePathname();
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim();
  if (!client || AD_FREE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null;

  return (
    <Script
      id="ratecoaster-adsense"
      async
      strategy="afterInteractive"
      crossOrigin="anonymous"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`}
    />
  );
}
