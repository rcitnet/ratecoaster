import type { LiveWait } from "@ratecoaster/shared";
import { RideImage } from "@/components/RideImage";
import { rideImage } from "@/lib/ride-images";

const PARK_NAMES: Record<string, string> = {
  "epic-universe": "Epic Universe",
  "islands-of-adventure": "Islands of Adventure",
  "universal-studios-florida": "Universal Studios",
  "volcano-bay": "Volcano Bay",
};

export function BusiestRides({ rides, allClosed }: { rides: LiveWait[]; allClosed: boolean }) {
  return (
    <aside className="busiest-rides" aria-labelledby="busiest-rides-title">
      <div className="busiest-rides-heading">
        <h3 id="busiest-rides-title">Busiest rides</h3>
        {rides.length > 0 ? <span className="badge badge-coral">Right now</span> : null}
      </div>
      <p className="busiest-rides-intro">Longest posted standby waits across Orlando.</p>
      {rides.length > 0 ? (
        <ol className="busiest-rides-list">
          {rides.map((ride) => (
            <li key={ride.attractionId}>
              <a className="busiest-ride" href={`/waits/${encodeURIComponent(ride.attractionSlug)}`}>
                <RideImage src={rideImage(ride.parkSlug, ride.attractionName) ?? ride.officialImageUrl} />
                <span className="busiest-ride-copy">
                  <strong>{ride.attractionName}</strong>
                  <span>{PARK_NAMES[ride.parkSlug] ?? ride.parkName}</span>
                </span>
                <span className="busiest-ride-time"><strong>{ride.waitMinutes}</strong><span>min</span></span>
              </a>
            </li>
          ))}
        </ol>
      ) : (
        <div className="busiest-rides-empty">
          <strong>{allClosed ? "The parks are closed right now" : "Waiting for fresh ride times"}</strong>
          <p>{allClosed
            ? "The longest waits will appear here once the parks open and rides begin reporting."
            : "Check back as rides report their waits. Only recent times from operating rides appear here."}</p>
        </div>
      )}
      <a className="busiest-rides-more" href="/waits">Explore all ride waits <span aria-hidden="true">→</span></a>
    </aside>
  );
}
