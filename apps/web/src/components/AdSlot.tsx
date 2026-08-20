"use client";

import { useEffect, useRef } from "react";
import { ADSENSE_CLIENT } from "@/lib/adsense";

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

/**
 * A deliberately manual AdSense placement. Nothing is rendered until this
 * placement's slot id is present at build time, so unfinished placements never
 * show empty ad boxes.
 */
export function AdSlot({ placement, slot }: { placement: string; slot?: string }) {
  const initialized = useRef(false);

  useEffect(() => {
    if (!slot || initialized.current) return;
    try {
      window.adsbygoogle = window.adsbygoogle ?? [];
      window.adsbygoogle.push({});
      initialized.current = true;
    } catch (error) {
      console.error("[ads] could not initialize placement", placement, error);
    }
  }, [placement, slot]);

  if (!slot) return null;

  return (
    <aside className="ad-placement" aria-label="Advertisement" data-placement={placement}>
      <div className="ad-label">Advertisement</div>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
