import {
  centsToDisplay,
  DEFAULT_HOMEPAGE_SETTINGS,
  deriveParkState,
} from "@ratecoaster/shared";
import {
  formatLongDate,
  getClient,
  relativeTime,
  safe,
} from "@/lib/api";
import { AdSlot } from "@/components/AdSlot";
import { HomeHero } from "@/components/HomeHero";
import { HomeDeals, HomeParkCards } from "@/components/HomeCollections";
import { pageMetadata } from "@/lib/seo";
import { GUIDE_CATEGORIES, GUIDES, guideBySlug } from "@/lib/guides";

/** Six guides for the home page: one per decision a first-time planner has to make. */
const HOME_GUIDE_SLUGS = [
  "universal-orlando-hotels-compared",
  "cheapest-time-to-visit-universal-orlando",
  "universal-express-pass-worth-it",
  "understanding-universal-ticket-pricing",
  "epic-universe-first-visit",
  "universal-trip-budget-checklist",
];

export const metadata = pageMetadata({
  title: "Universal hotel deals — passholder and public rates",
  description:
    "The cheapest upcoming nights at Universal Orlando hotels, ranked against each hotel's own price history rather than raw nightly cost. Free, updated daily.",
  path: "/",
});

export const revalidate = 60;

const HOME_TIERS = ["premier", "preferred", "prime-value", "value"] as const;

export default async function DealsPage() {
  const client = await getClient();
  const [deals, properties, waits, ticketProducts, homepage] = await Promise.all([
    safe(client.listDeals({ destination: "universal-orlando", limit: 40 }), []),
    safe(client.listProperties(), []),
    safe(client.liveWaits({ destination: "universal-orlando" }), {
      parks: [],
      attribution: [],
      fetchedAt: new Date().toISOString(),
    }),
    safe(client.listTicketProducts("universal-orlando"), []),
    safe(client.homepageSettings(), DEFAULT_HOMEPAGE_SETTINGS),
  ]);

  // This headline describes hotel inventory, not whichever deal rows happen
  // to be visible today. Counting deals made the number drop to zero whenever
  // rate collection was still warming up (and could over-count one hotel when
  // several dates appeared in the deal feed).
  const withExpress = properties.filter((property) => property.includesExpressPass).length;
  const orlandoProperties = properties.filter(
    (property) => property.destination === "universal-orlando"
  );
  const parkSummaries = waits.parks.map(({ park, waits: parkWaits, hours }) => {
    const open = parkWaits.filter(
      (wait) => wait.status === "operating" && wait.waitMinutes !== null
    );
    const average = open.length
      ? Math.round(open.reduce((sum, wait) => sum + (wait.waitMinutes ?? 0), 0) / open.length)
      : null;
    const shortest = [...open].sort(
      (a, b) => (a.waitMinutes ?? Number.MAX_SAFE_INTEGER) - (b.waitMinutes ?? Number.MAX_SAFE_INTEGER)
    )[0];

    /*
     * Published hours decide this, not attraction statuses.
     *
     * Shows and character meets keep reporting OPERATING after the gates shut,
     * so any status-based guess calls an empty midnight park "open". The
     * schedule is the only source that actually answers the question.
     */
    const state = deriveParkState({ waits: parkWaits, hours });

    return {
      park,
      average,
      state,
      hours,
      openCount: open.length,
      walkOnCount: open.filter((wait) => (wait.waitMinutes ?? 99) <= 15).length,
      shortest,
    };
  });
  const dealsByTier = HOME_TIERS.map((tier) => ({
    tier,
    propertyCount: orlandoProperties.filter((property) => property.tier === tier).length,
    deal: deals
      .filter((deal) => deal.tier === tier)
      .sort(
        (a, b) =>
          (a.percentileOfHistory ?? Number.MAX_SAFE_INTEGER) -
            (b.percentileOfHistory ?? Number.MAX_SAFE_INTEGER) ||
          a.nightlyCents - b.nightlyCents
      )[0],
  })).filter(({ propertyCount, deal }) => propertyCount > 0 || deal);
  const picks = dealsByTier.flatMap(({ deal }) => deal ? [deal] : []);
  const featured = picks[0];
  // Closed parks may still have OPERATING attractions in upstream feeds.
  const shortestNow = parkSummaries
    .filter(({ state, shortest }) => state === "open" && shortest?.waitMinutes != null)
    .sort((a, b) => (a.shortest!.waitMinutes ?? Infinity) - (b.shortest!.waitMinutes ?? Infinity))[0];

  return (
    <main className="home-refresh">
      <HomeHero
        variant={homepage.heroVariant}
        stats={{ hotelCount: properties.length, parkCount: parkSummaries.length,
          ticketCount: ticketProducts.length, expressHotelCount: withExpress }}
        parks={parkSummaries}
      />

      <section className="refresh-section" id="discover">
        <div className="refresh-section-head">
          <div><div className="refresh-eyebrow">Your daily dose of possibility</div><h2>Worth checking today</h2></div>
          <span className="refresh-trust">A few useful places to start</span>
        </div>
        <div className="refresh-insights">
          <a className="refresh-insight" href={featured ? `/hotels/${featured.propertySlug}?${new URLSearchParams({ rateCode: featured.rateCode, stayDate: featured.stayDate })}` : "/hotels"}>
            <span className="refresh-insight-icon" aria-hidden="true">↘</span>
            <h3>{featured ? "A great stay, a better find" : "Find your kind of stay"}</h3>
            <p>{featured ? `${featured.propertyName} from ${centsToDisplay(featured.nightlyCents)} per night on ${formatLongDate(featured.stayDate)}, before taxes and fees.${featured.isEstimated ? " Estimated rate." : ""}` : "Compare Orlando hotels, included perks, and public and passholder rate calendars."}</p>
            <span className="refresh-text-link">{featured ? "See the featured deal" : "Explore the hotels"} <span aria-hidden="true">→</span></span>
          </a>
          <a className="refresh-insight" href={shortestNow ? `/waits?park=${shortestNow.park.slug}` : "/waits"}>
            <span className="refresh-insight-icon" aria-hidden="true">◷</span>
            <h3>{shortestNow ? "Your next short line" : "Your next park adventure"}</h3>
            <p>{shortestNow ? `${shortestNow.shortest!.attractionName} is posting ${shortestNow.shortest!.waitMinutes} minutes at ${shortestNow.park.name}. Updated ${relativeTime(waits.fetchedAt)}.` : "Check park hours and posted attraction waits before choosing where to head next."}</p>
            <span className="refresh-text-link">Explore the park pulse <span aria-hidden="true">→</span></span>
          </a>
          <a className="refresh-insight" href="/plan">
            <span className="refresh-insight-icon" aria-hidden="true">▦</span>
            <h3>A little flexibility goes a long way</h3>
            <p>Bring your dates and compare hotel, ticket, and Express options for your whole party.</p>
            <span className="refresh-text-link">Find your dates <span aria-hidden="true">→</span></span>
          </a>
        </div>
      </section>

      <section className="refresh-section" id="hotel-deals"><HomeDeals deals={picks} /></section>

      <section className="refresh-section" id="park-pulse">
        <div className="refresh-pulse">
          <div className="refresh-section-head">
            <div><div className="refresh-eyebrow"><span className="status-dot dot-ok" />Orlando park pulse</div><h2>Less waiting starts here.</h2></div>
            <div className="refresh-head-actions"><a href="/crowd-calendar" className="refresh-text-link">Crowd calendar</a><a href="/waits" className="btn btn-ghost btn-sm">Every attraction <span aria-hidden="true">→</span></a></div>
          </div>
          <HomeParkCards parks={parkSummaries} />
          {parkSummaries.length > 0 && <p className="refresh-trust">
            Updated {relativeTime(waits.fetchedAt)}. Average excludes closed and unavailable attractions.
            {waits.attribution.map((credit) => <span key={credit.source}> · <a href={credit.url} target="_blank" rel="noreferrer">{credit.text}</a></span>)}
          </p>}
        </div>
      </section>

      <AdSlot placement="home-after-park-pulse" slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME} />

      <section className="refresh-section">
        <div className="refresh-section-head"><div><h2>Make the most of every park day.</h2><p>A few more ways to plan with confidence.</p></div></div>
        <div className="refresh-guides">
          <a href="/tickets"><span className="refresh-eyebrow">Choose your park days</span><h3>See the ticket price calendar</h3><p>Compare adult, child, and Park-to-Park prices across the year.</p><span className="refresh-text-link">Explore tickets <span aria-hidden="true">→</span></span></a>
          <a href="/express-pass"><span className="refresh-eyebrow">Spend where it matters</span><h3>Is Express worth it for your trip?</h3><p>Compare Express prices and hotels that include Express Unlimited.</p><span className="refresh-text-link">Compare Express <span aria-hidden="true">→</span></span></a>
          <a href="/guides"><span className="refresh-eyebrow">A head start on the fun</span><h3>Get to know your next adventure</h3><p>Practical guides to Universal hotels, parks, and planning.</p><span className="refresh-text-link">Read the guides <span aria-hidden="true">→</span></span></a>
        </div>
      </section>

      <section className="refresh-section">
        <div className="page-explainer home-about" style={{ marginTop: 0 }}>
          <p className="refresh-eyebrow">What RateCoaster is</p>
          <h2>A year of Universal prices, side by side.</h2>
          <p>
            Universal prices hotel rooms, park tickets and Express Pass by date, and the same trip
            can cost very different amounts a fortnight apart. The official booking pages show one
            set of dates at a time. RateCoaster records what Universal publishes for every date it
            sells, keeps the history of each price, and lays the dates out together so the cheaper
            weeks are easy to see.
          </p>
          <p>
            Hotel rates at {properties.length > 0 ? `all ${properties.length}` : "every"} on-site
            hotels are re-checked four times a day for the next 365 nights, at standard and Annual
            Passholder prices. Ticket and Express Pass prices are tracked by date, ride wait times
            are collected every five minutes, and a crowd calendar reads Universal&apos;s own
            pricing as a signal of how busy each day is expected to be. The site is free,
            independent and not affiliated with Universal.{" "}
            <a href="/about"><b>About RateCoaster</b></a> ·{" "}
            <a href="/guides/how-ratecoaster-compares-prices"><b>How the prices are collected</b></a>
          </p>
        </div>
      </section>

      <section className="refresh-section">
        <div className="refresh-section-head">
          <div><div className="refresh-eyebrow">From the planning library</div><h2>Guides worth reading first.</h2></div>
          <a href="/guides" className="btn btn-ghost btn-sm">All {GUIDES.length} guides <span aria-hidden="true">→</span></a>
        </div>
        <div className="grid grid-3">
          {HOME_GUIDE_SLUGS.map((slug) => guideBySlug(slug)).filter((guide) => guide !== undefined).map((guide) => (
            <a key={guide.slug} href={`/guides/${guide.slug}`} className="card card-hover">
              <p className="refresh-eyebrow">{GUIDE_CATEGORIES[guide.category]} · {guide.readTime}</p>
              <h3 style={{ fontSize: 19, margin: "8px 0" }}>{guide.title}</h3>
              <p className="muted tiny">{guide.summary}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="refresh-closing">
        <div><div className="refresh-eyebrow">Make it your kind of trip</div><h2>The excitement starts with a plan.</h2><p>Bring your dates. We’ll help you see the bigger picture.</p></div>
        <a href="/plan" className="btn btn-primary">Start planning <span aria-hidden="true">→</span></a>
      </section>
    </main>
  );
}
