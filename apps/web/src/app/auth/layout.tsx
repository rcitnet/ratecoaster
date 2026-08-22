import type { Metadata } from "next";

/**
 * Sign-in plumbing is never a search result.
 *
 * These URLs carry one-time tokens in the query string. Beyond the obvious
 * "why would anyone search for this", an indexed verify URL is a token in a
 * public database — so this is a small security measure as much as an SEO one.
 */
export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
