import { hotelProfile } from "@/content/hotel-profiles";
import { guideBySlug } from "@/lib/guides";

function longDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!)).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** The one- or two-sentence description shown under a hotel's title. */
export function HotelSummary({ slug }: { slug: string }) {
  const profile = hotelProfile(slug);
  return profile ? <p className="hotel-summary">{profile.summary}</p> : null;
}

/**
 * The written profile under a hotel's rate table: what the hotel is, who it
 * suits and how you reach the parks. Renders nothing for a hotel that has no
 * profile yet, so a newly added property never shows an empty section.
 */
export function HotelProfileSection({
  slug,
  name,
  roomCount,
  includesExpressPass,
}: {
  slug: string;
  name: string;
  roomCount: number | null;
  includesExpressPass: boolean;
}) {
  const profile = hotelProfile(slug);
  if (!profile) return null;
  const guides = profile.guides
    .map((guide) => guideBySlug(guide))
    .filter((guide): guide is NonNullable<typeof guide> => Boolean(guide));

  return (
    <section className="hotel-profile" aria-labelledby="hotel-profile-heading">
      <p className="refresh-eyebrow">About this hotel</p>
      <h2 id="hotel-profile-heading">{name} at a glance</h2>

      <ul className="hotel-profile-facts">
        <li><span>Category</span>{profile.category}</li>
        <li><span>Opened</span>{profile.opened}</li>
        {roomCount ? <li><span>Rooms</span>{roomCount.toLocaleString()}</li> : null}
        <li><span>Express Pass</span>{includesExpressPass ? "Express Unlimited included" : "Not included"}</li>
        <li><span>Closest to</span>{profile.parks}</li>
        <li><span>Getting to the parks</span>{profile.transport}</li>
      </ul>

      {profile.overview.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}

      <h3>Who it suits</h3>
      <ul>{profile.bestFor.map((item) => <li key={item}>{item}</li>)}</ul>

      <h3>Getting to the parks</h3>
      <p>{profile.gettingAround}</p>

      <h3>Good to know</h3>
      <ul>{profile.goodToKnow.map((item) => <li key={item}>{item}</li>)}</ul>

      <h3>Reading the rates on this page</h3>
      <p>
        The table above lists every night RateCoaster is tracking for {name}, at the rate type and
        room type you have selected. Each row shows the current nightly rate before tax, the lowest
        rate ever recorded for that night, and when it was last checked. Click a date to see how
        its price has moved. A rate at or close to its recorded low, on a date that suits you, is
        the signal worth acting on. Confirm the price and terms on the official booking site
        before you book.
      </p>

      {guides.length > 0 ? (
        <p className="page-explainer-more">
          <span className="muted">Read more:</span>
          {guides.map((guide) => <a key={guide.slug} href={`/guides/${guide.slug}`}>{guide.title} →</a>)}
        </p>
      ) : null}

      <p className="image-credit">
        Hotel details reviewed {longDate(profile.reviewed)}. Benefits and transport are set by the
        hotel and can change. RateCoaster is not affiliated with the hotel or its operator.
      </p>
    </section>
  );
}
