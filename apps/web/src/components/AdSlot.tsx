"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

/**
 * A deliberately manual AdSense placement. Nothing is rendered until both an
 * approved publisher id and this placement's slot id are present at build
 * time, so development and pre-approval production never show empty ad boxes.
 */
export function AdSlot({ placement, slot }: { placement: string; slot?: string }) {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim();
  const initialized = useRef(false);

  useEffect(() => {
    if (!client || !slot || initialized.current) return;
    try {
      window.adsbygoogle = window.adsbygoogle ?? [];
      window.adsbygoogle.push({});
      initialized.current = true;
    } catch (error) {
      console.error("[ads] could not initialize placement", placement, error);
    }
  }, [client, placement, slot]);

  if (!client || !slot) return null;

  return (
    <aside className="ad-placement" aria-label="Advertisement" data-placement={placement}>
      <div className="ad-label">Advertisement</div>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
