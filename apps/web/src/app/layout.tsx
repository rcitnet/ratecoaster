import type { Metadata } from "next";
import Image from "next/image";
import "./globals.css";
import { getMe } from "@/lib/api";
import { MobileMenu } from "@/components/MobileMenu";
import { AdSenseScript } from "@/components/AdSenseScript";

export const metadata: Metadata = {
  title: "RateCoaster — Universal hotel deals, tickets & live wait times",
  description:
    "Track passholder and public hotel rates a full year ahead for Universal resorts in Orlando and Frisco, plus live ride waits including Universal Studios Hollywood.",
};

const NAV = [
  { href: "/", label: "Deals" },
  { href: "/plan", label: "Trip planner" },
  { href: "/hotels", label: "Hotels" },
  { href: "/tickets", label: "Tickets" },
  { href: "/express-pass", label: "Express Pass" },
  { href: "/waits", label: "Wait times" },
  { href: "/guides", label: "Guides" },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  const signedIn = Boolean(me.user);
  // The link only appears for admins. It isn't the security boundary — the API
  // 404s /v1/admin for everyone else — it just keeps staff tooling out of the
  // way of visitors.
  const isAdmin = me.entitlements.admin === true;

  return (
    <html lang="en">
      <head>
        {/* Fredoka carries the playful energy in headlines; Inter keeps dense
            rate tables readable, which a rounded display face would not. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AdSenseScript />
        <header className="masthead">
          <div className="masthead-inner">
            <a href="/" className="brand" aria-label="RateCoaster home">
              <Image
                className="brand-logo"
                src="/brand/ratecoaster-logo-5x1-150kb.png"
                alt="RateCoaster"
                width={1000}
                height={200}
                priority
              />
            </a>
            <nav className="nav" aria-label="Primary navigation">
              {NAV.map((item) => (
                <a key={item.href} href={item.href}>
                  {item.label}
                </a>
              ))}
            </nav>
            <span className="spacer" />
            <div className="desktop-actions">
              {signedIn ? (
                <>
                  {isAdmin ? (
                    <a href="/admin" className="badge badge-hot" style={{ textDecoration: "none" }}>
                      Admin
                    </a>
                  ) : (
                    <span className="badge badge-blue">
                      Free account
                    </span>
                  )}
                  <a href="/account" className="btn btn-ghost btn-sm">
                    Account
                  </a>
                </>
              ) : (
                <a href="/join" className="btn btn-primary btn-sm">
                  Sign up free
                </a>
              )}
            </div>

            <MobileMenu items={NAV} signedIn={signedIn} isAdmin={isAdmin} />
          </div>
        </header>

        <div className="shell">
          {process.env.DEMO_MODE === "1" ? (
            <div className="notice notice-warn" style={{ marginTop: 18 }}>
              <b>Demo mode.</b> Ride wait times are live and accurate. Hotel, ticket and Express
              Pass prices are sample figures for now — not real quotes, so please don&apos;t plan
              around them yet.
            </div>
          ) : null}
          {children}
        </div>

        <footer className="footer">
          <div className="shell">
            <div className="footer-cols">
              <div>
                <a href="/" className="brand footer-brand" aria-label="RateCoaster home">
                  <Image
                    className="brand-logo"
                    src="/brand/ratecoaster-logo-5x1-150kb.png"
                    alt="RateCoaster"
                    width={1000}
                    height={200}
                  />
                </a>
                <p style={{ margin: 0 }}>
                  Free hotel rate tracking for Universal resorts in Orlando and Frisco.
                </p>
              </div>
              <div>
                <strong style={{ color: "#fff" }}>Plan</strong>
                <p style={{ margin: "8px 0 0", lineHeight: 2 }}>
                  <a href="/plan">Trip planner</a>
                  <br />
                  <a href="/hotels">Hotel rates</a>
                  <br />
                  <a href="/tickets">Ticket prices</a>
                  <br />
                  <a href="/express-pass">Express Pass</a>
                  <br />
                  <a href="/waits">Live wait times</a>
                  <br />
                  <a href="/guides">Planning guides</a>
                </p>
              </div>
              <div>
                <strong style={{ color: "#fff" }}>Account &amp; legal</strong>
                <p style={{ margin: "8px 0 0", lineHeight: 2 }}>
                  <a href="/join">Create a free account</a>
                  <br />
                  <a href="/privacy">Privacy policy</a>
                  <br />
                  <a href="/terms">Terms of service</a>
                  <br />
                  <a href="mailto:rcitnet@gmail.com">Contact</a>
                </p>
              </div>
            </div>

            <div className="footer-legal">
              {/* Queue-Times' free API is licensed on condition this credit is
                  visible. The API returns it in every response so no client —
                  web or mobile — can quietly drop it. */}
              <p style={{ margin: "0 0 6px" }}>
                Wait times powered by{" "}
                <a href="https://queue-times.com/" target="_blank" rel="noreferrer noopener">
                  Queue-Times.com
                </a>{" "}
                and{" "}
                <a href="https://themeparks.wiki/" target="_blank" rel="noreferrer noopener">
                  ThemeParks.wiki
                </a>
                .
              </p>
              <p style={{ margin: "0 0 6px" }}>
                Not affiliated with, endorsed by or sponsored by Universal Destinations &amp;
                Experiences, NBCUniversal, or Loews Hotels.
              </p>
              <p style={{ margin: "0 0 6px" }}>
                RateCoaster is free to use and may be supported by clearly labeled advertising.
                Advertising never changes which prices or deals we display.
              </p>
              <p style={{ margin: 0 }}>
                Prices change often and may differ at checkout. Always confirm on the official
                site before booking.
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
