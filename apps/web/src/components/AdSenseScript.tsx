"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { ADSENSE_CLIENT, shouldLoadAdSense } from "@/lib/adsense";

/** Load the network once, and never load it on account, legal, or thin utility pages. */
export function AdSenseScript() {
  const pathname = usePathname();
  if (!shouldLoadAdSense(pathname)) return null;

  return (
    <Script
      id="ratecoaster-adsense"
      async
      strategy="afterInteractive"
      crossOrigin="anonymous"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
    />
  );
}
