import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";

/**
 * Noindex for the whole admin area, set once on the layout.
 *
 * robots.txt already disallows /admin, but that only stops crawling — a
 * disallowed URL can still be listed on the strength of an inbound link, shown
 * with no description because the crawler was never permitted to look. Only a
 * robots meta tag actually prevents indexing, and it has to be served from the
 * page itself.
 */
export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/collectors", label: "Collectors" },
  { href: "/admin/sources", label: "Sources" },
  { href: "/admin/hotels", label: "Hotels" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/status", label: "Data freshness" },
];

/**
 * Server-side gate for every page under /admin.
 *
 * This is a second line, not the line: the API returns 404 on /v1/admin for
 * non-admins regardless, so an unauthorised visitor who reached these pages
 * would see empty shells. Redirecting is simply a better experience than an
 * empty dashboard, and keeps the admin area out of the browser history of
 * anyone who stumbles in.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdmin())) redirect("/");

  return (
    <main className="section">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 6,
        }}
      >
        <h1 style={{ fontSize: 30 }}>Admin</h1>
        <span className="badge badge-hot">Staff only</span>
      </div>
      <p className="lede" style={{ marginBottom: 20 }}>
        Everything here changes what the public site shows or what it fetches from third parties.
        Actions are logged.
      </p>

      <div className="chips" style={{ marginBottom: 26 }}>
        {TABS.map((tab) => (
          <a key={tab.href} href={tab.href} className="chip">
            {tab.label}
          </a>
        ))}
      </div>

      {children}
    </main>
  );
}
