import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { RideImage } from "@/components/RideImage";
import { getClient, relativeTime, safe, PARK_COLORS } from "@/lib/api";
import { rideImage } from "@/lib/ride-images";
import { pageMetadata, breadcrumbSchema, jsonLd } from "@/lib/seo";
import type { WaitRollupPoint } from "@ratecoaster/shared";

export const revalidate = 60;

function statusText(status: string, wait: number | null): string {
  if (status === "operating" && wait !== null) return `${wait} min`;
  if (status === "down") return "Temporarily down";
  if (status === "refurbishment") return "Under refurbishment";
  return "Currently closed";
}

function hourLabel(hour: number): string {
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 || 12;
  return `${display} ${suffix}`;
}

function WaitHistory({ points }: { points: WaitRollupPoint[] }) {
  const visible = points.filter((point) => point.p50Minutes !== null && point.sampleCount > 0);
  if (visible.length < 2) return null;

  const width = 720;
  const height = 260;
  const pad = { top: 28, right: 24, bottom: 42, left: 36 };
  const values = visible.map((point) => point.p50Minutes ?? 0);
  const max = Math.max(...values, 15);
  const x = (index: number) => pad.left + (index / (visible.length - 1)) * (width - pad.left - pad.right);
  const y = (value: number) => height - pad.bottom - (value / max) * (height - pad.top - pad.bottom);
  const line = visible
    .map((point, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(point.p50Minutes ?? 0)}`)
    .join(" ");
  const area = `${line} L ${x(visible.length - 1)} ${height - pad.bottom} L ${x(0)} ${height - pad.bottom} Z`;

  return (
    <div className="wait-history-chart" role="img" aria-label="Typical wait by time of day">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height}>
        {[0, 0.5, 1].map((fraction) => {
          const value = Math.round(max * fraction);
          const lineY = y(value);
          return (
            <g key={fraction}>
              <line x1={pad.left} x2={width - pad.right} y1={lineY} y2={lineY} stroke="#e6e3f1" />
              <text x={pad.left - 8} y={lineY + 4} textAnchor="end" fontSize="11" fill="#7d76a3">
                {value}m
              </text>
            </g>
          );
        })}
        <path d={area} fill="#e8ecff" />
        <path d={line} fill="none" stroke="#3355ee" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
        {visible.map((point, index) => (
          <g key={point.hour}>
            <circle cx={x(index)} cy={y(point.p50Minutes ?? 0)} r="4" fill="#3355ee" />
            {(index === 0 || index === visible.length - 1 || point.hour % 3 === 0) ? (
              <text x={x(index)} y={height - 14} textAnchor="middle" fontSize="11" fill="#7d76a3">
                {hourLabel(point.hour)}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const client = await getClient();
  const live = await safe(client.liveWaits({ ridesOnly: true }), { parks: [], attribution: [], fetchedAt: new Date().toISOString() });
  const ride = live.parks.flatMap((park) => park.waits.map((wait) => ({ ...wait, park: park.park }))).find((wait) => wait.attractionSlug === slug);

  if (!ride) {
    return pageMetadata({ title: "Ride not found", description: "We don't track this ride yet.", path: `/waits/${slug}`, noindex: true });
  }

  return pageMetadata({
    title: `${ride.attractionName} wait times and park map`,
    description: `Current and typical wait times for ${ride.attractionName} at ${ride.park.name}, plus its location in the park.`,
    path: `/waits/${slug}`,
  });
}

export default async function RideWaitPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const client = await getClient();
  const live = await safe(client.liveWaits({ ridesOnly: true }), { parks: [], attribution: [], fetchedAt: new Date().toISOString() });
  const found = live.parks
    .flatMap((entry) => entry.waits.map((wait) => ({ ...wait, park: entry.park })))
    .find((wait) => wait.attractionSlug === slug);

  if (!found) notFound();

  const history = await safe(client.waitRollup(found.attractionSlug), []);
  const hasHistory = history.filter((point) => point.p50Minutes !== null && point.sampleCount > 0).length >= 2;
  const mapQuery = encodeURIComponent(`${found.attractionName}, ${found.park.name}`);
  const mapEmbedUrl = `https://www.google.com/maps?output=embed&q=${mapQuery}&z=18&t=k`;

  return (
    <main className="section ride-detail-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Live ride waits", path: "/waits" },
            { name: found.attractionName, path: `/waits/${found.attractionSlug}` },
          ])),
        }}
      />
      <a href={`/waits?park=${found.park.slug}`} className="tiny muted">← Back to {found.park.name}</a>

      <header className="ride-detail-hero">
        <RideImage src={rideImage(found.park.slug, found.attractionName)} />
        <div>
          <span className="badge" style={{ background: `${PARK_COLORS[found.park.slug] ?? "#3355ee"}18`, color: PARK_COLORS[found.park.slug] ?? "#3355ee" }}>
            {found.park.name}
          </span>
          <h1>{found.attractionName}</h1>
          <p className="lede">{found.land ? `In ${found.land}` : "Park location details"}</p>
        </div>
        <div className="ride-live-wait">
          <span className="tiny">LIVE WAIT</span>
          <strong>{statusText(found.status, found.waitMinutes)}</strong>
          <small>Updated {relativeTime(found.observedAt)}</small>
        </div>
      </header>

      <div className="ride-detail-grid">
        <section className="card">
          <h2>Typical waits by time of day</h2>
          {hasHistory ? (
            <>
              <p className="tiny muted">Based on recorded wait observations. The line shows the typical posted wait for each hour.</p>
              <WaitHistory points={history} />
            </>
          ) : (
            <div className="notice" style={{ marginBottom: 0 }}>
              We&apos;re still collecting enough wait history for this ride. Check back soon for its typical day.
            </div>
          )}
        </section>

        <section className="card">
          <h2>Where to find it</h2>
          <p className="tiny muted">{found.land ? `Located in ${found.land}.` : "Use the map to find this ride in the park."}</p>
          <div className="ride-park-map">
            <iframe
              src={mapEmbedUrl}
              title={`Map showing ${found.attractionName}`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
          <a className="btn btn-blue btn-sm" href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`} target="_blank" rel="noreferrer">
            Open in Google Maps ↗
          </a>
        </section>
      </div>
    </main>
  );
}
