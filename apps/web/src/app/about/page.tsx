import { CONTACT_EMAIL, CONTACT_MAILTO } from "@/lib/contact";
import { TRACKING_SINCE } from "@/content/site";
import { GUIDES } from "@/lib/guides";
import { breadcrumbSchema, jsonLd, pageMetadata, SITE_NAME, SITE_URL } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "About RateCoaster",
  description:
    "Who runs RateCoaster, where its Universal hotel, ticket, Express Pass and wait-time data comes from, how the guides are written, and how the site is paid for.",
  path: "/about",
});

export default function AboutPage() {
  const aboutSchema = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: `About ${SITE_NAME}`,
    url: `${SITE_URL}/about`,
    mainEntity: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      email: CONTACT_EMAIL,
      foundingDate: "2026",
    },
  };

  return (
    <main className="section legal-page page-refresh">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(aboutSchema) }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(breadcrumbSchema([{ name: "Home", path: "/" }, { name: "About", path: "/about" }])),
        }}
      />
      <p className="eyebrow">About</p>
      <h1>About RateCoaster</h1>

      <p className="lede">
        RateCoaster is an independent, free price tracker for Universal&apos;s theme park resorts. It
        records what Universal publishes for hotel rooms, park tickets and Express Pass on every
        date it sells, keeps the history, and puts the dates side by side so that the cheap weeks
        are easy to see.
      </p>

      <h2>Who is behind it</h2>
      <p>
        RateCoaster is built and run by a Universal Annual Passholder who plans park trips for their
        own family and wrote the software that collects the prices. It is a small independent
        project, not a travel agency and not part of a media company.
      </p>
      <p>
        It started from a specific annoyance. Universal prices rooms, tickets and Express Pass by
        date, and the same family trip can cost very different amounts a fortnight apart, but the
        official booking pages only ever show one set of dates at a time. Passholder room rates are
        harder still to compare, because they appear on some nights and not others. Checking a
        year of dates by hand is not realistic. Recording them automatically is.
      </p>
      <p>
        Tracking began in {TRACKING_SINCE}. The site covers Universal Orlando Resort and Universal
        Kids Resort in Frisco, Texas, with ticket and park information for Universal Studios
        Hollywood.
      </p>

      <h2>What the site does</h2>
      <ul>
        <li>
          <a href="/hotels"><b>Hotel rates</b></a>: the nightly rate at every on-site hotel for the
          next 365 nights, at standard and Annual Passholder prices, with the history of each night.
        </li>
        <li>
          <a href="/tickets"><b>Ticket prices</b></a>: admission priced by start date for each
          ticket product.
        </li>
        <li>
          <a href="/express-pass"><b>Express Pass prices</b></a>: every Express product by date.
        </li>
        <li>
          <a href="/waits"><b>Live wait times</b></a>: current waits for every ride, compared with
          what is typical for the hour.
        </li>
        <li>
          <a href="/crowd-calendar"><b>Crowd calendar</b></a>: a demand outlook for each park and
          date, read from Universal&apos;s own pricing.
        </li>
        <li>
          <a href="/plan"><b>Trip planner</b></a>: hotel, tickets and optional flights added up for
          a specific party and set of dates.
        </li>
        <li>
          <a href="/guides"><b>Planning guides</b></a>: {GUIDES.length} articles on how Universal
          pricing works and how to plan around it.
        </li>
      </ul>

      <h2>Where the data comes from</h2>
      <p>
        Hotel, ticket and Express Pass prices are read from the prices Universal publishes on its
        own public booking pages. The collectors request the same prices a visitor to the booking
        site would be shown, at a deliberately slow rate.
      </p>
      <ul>
        <li>Hotel rates are checked four times a day for the next 365 nights.</li>
        <li>Express Pass prices are checked six times a day.</li>
        <li>Ticket prices are checked twice a day.</li>
        <li>Ride wait times are collected every five minutes.</li>
      </ul>
      <p>
        Live wait times are provided by{" "}
        <a href="https://queue-times.com/" target="_blank" rel="noreferrer noopener">Queue-Times.com</a>{" "}
        and <a href="https://themeparks.wiki/" target="_blank" rel="noreferrer noopener">ThemeParks.wiki</a>,
        which relay the waits each park posts.
      </p>
      <p>
        A price is stored only when it changes, which is why history charts on the site are step
        charts. Passholder rates are stored only when Universal&apos;s own discount markers are
        present, so that a discount is never recorded where none was offered. The full method is
        set out in{" "}
        <a href="/guides/how-ratecoaster-compares-prices">How RateCoaster compares Universal prices</a>.
      </p>

      <h2>What the numbers are and are not</h2>
      <p>
        Every price on RateCoaster is an observation: what the official seller showed for that date
        the last time it was checked. It is not a quote, and nothing is held for you. Rates are
        shown before tax. Inventory changes between a check and a checkout, so always confirm the
        price and terms with the seller before booking.
      </p>
      <p>
        The crowd calendar is an estimate of demand built from pricing signals. It is not measured
        attendance and it does not predict a specific wait.
      </p>

      <h2>How the guides are written</h2>
      <p>
        The <a href="/guides">planning guides</a> are written by the RateCoaster team from two
        sources: the prices this site has recorded, and the rules Universal publishes for its
        tickets, hotels and Express products. Where a guide makes a claim about prices, it is
        either computed from tracked data on the page itself or explained as a method you can
        check against the calendars.
      </p>
      <ul>
        <li>Each guide shows the date it was published and the date it was last reviewed.</li>
        <li>
          Guides are revised when Universal changes a rule that affects them. The removal of
          Hagrid&apos;s Magical Creatures Motorbike Adventure from Express in July 2026 and the
          2026 change to multi-day Epic Universe tickets are examples.
        </li>
        <li>
          Guides do not contain paid placements. No hotel, ticket seller or advertiser pays to be
          mentioned or recommended.
        </li>
        <li>
          If something is wrong or out of date, <a href="/contact">tell us</a> and it will be
          checked and corrected.
        </li>
      </ul>

      <h2>How RateCoaster is paid for</h2>
      <p>
        The site is free to use. It is supported in two ways, both disclosed where they appear.
      </p>
      <ul>
        <li>
          <b>Advertising.</b> Some pages may carry clearly labelled advertisements. Advertisers have
          no say over which prices are shown or how they are ordered.
        </li>
        <li>
          <b>Affiliate links.</b> Some outbound booking links are affiliate links, labelled as such
          beside the link. If you book through one, RateCoaster may earn a commission at no extra
          cost to you. Prices shown on the site are the tracked prices regardless of whether a
          link is an affiliate link.
        </li>
      </ul>
      <p>
        Details of the data involved are in the <a href="/privacy">privacy policy</a>.
      </p>

      <h2>Independence</h2>
      <p>
        RateCoaster is not affiliated with, endorsed by or sponsored by Universal Destinations
        &amp; Experiences, NBCUniversal or Loews Hotels. Park, hotel and attraction names are
        trademarks of their respective owners and are used here to identify the products being
        compared. Hotel photography is credited to Loews Hotels, and attraction imagery is
        &copy; Universal and shown to identify each attraction.
      </p>

      <h2>Contact</h2>
      <p>
        Questions, corrections and privacy requests go to{" "}
        <a href={CONTACT_MAILTO}>{CONTACT_EMAIL}</a>. See the <a href="/contact">contact page</a>{" "}
        for what to include.
      </p>
    </main>
  );
}
