"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import type { AnalyticsConfig } from "@/lib/analytics";

/**
 * Staff traffic is excluded, and only staff traffic.
 *
 * This list is deliberately shorter than AdSense's. Ads skip /join, /privacy
 * and /terms because ads beside a signup form or a legal page read badly — but
 * those are precisely the pages whose traffic is worth counting, since /join is
 * the top of the funnel and a spike on /privacy means something is worrying
 * people. Only /admin is dropped, because on a site this young our own visits
 * would otherwise outnumber real ones and every chart would describe us.
 */
const UNTRACKED_PREFIXES = ["/admin"];

/**
 * Both tags load after hydration, so neither competes with content for the main
 * thread during the paint Google measures for Core Web Vitals.
 *
 * No client-side pageview shim: every link on the site is a plain anchor, so
 * each navigation is a full document load and fires its own pageview. Adopting
 * next/link anywhere would break that silently — GA4 would undercount rather
 * than error — which is why the note lives here and not in a commit message.
 */
export function Analytics({ cloudflareToken, gaMeasurementId }: AnalyticsConfig) {
  const pathname = usePathname();
  if (UNTRACKED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null;

  return (
    <>
      {/*
        A plain <script>, not next/script, and that is load-bearing.

        Cloudflare reads its token from the data-cf-beacon attribute on the tag
        itself. next/script did not carry that attribute through to the served
        markup: the src appeared, the attribute did not, so the beacon loaded and
        silently recorded nothing — a working script reporting an empty
        dashboard, which is the exact failure this file claims to prevent.
        Caught by counting the attribute in rendered HTML rather than trusting
        that props pass through.
      */}
      {cloudflareToken ? (
        <script
          defer
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon={JSON.stringify({ token: cloudflareToken })}
        />
      ) : null}

      {gaMeasurementId ? (
        <>
          <Script
            id="ga4-loader"
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`}
          />
          <Script id="ga4-config" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${gaMeasurementId}');`}
          </Script>
        </>
      ) : null}
    </>
  );
}
