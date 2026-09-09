import { getClient, safe } from "@/lib/api";
import { AdSlot } from "@/components/AdSlot";
import { WaitsExplorer } from "@/components/WaitsExplorer";
import { pageMetadata } from "@/lib/seo";
import { rideImage } from "@/lib/ride-images";

export const metadata = pageMetadata({
  title: "Live Universal attraction wait times",
  description:
    "Current wait times for rides and attractions at Universal Studios Florida, Islands of Adventure, Epic Universe, Volcano Bay and Universal Studios Hollywood, updated every few minutes.",
  path: "/waits",
});

export const revalidate = 60;

export default async function WaitsPage({
  searchParams,
}: {
  searchParams: Promise<{ park?: string }>;
}) {
  const params = await searchParams;
  const client = await getClient();
  const data = await safe(
    client.liveWaits({ destination: "universal-orlando", ridesOnly: false }),
    { parks: [], attribution: [], fetchedAt: new Date().toISOString() }
  );
  const webData = {
    ...data,
    parks: data.parks.map((entry) => ({
      ...entry,
      waits: entry.waits.map((wait) => ({
        ...wait,
        imageSrc: rideImage(entry.park.slug, wait.attractionName) ?? wait.officialImageUrl,
      })),
    })),
  };

  return (
    <main className="section">
      <h1>Live attraction waits</h1>
      <p className="lede" style={{ marginTop: 12 }}>
        Search, sort, and filter Universal attractions using classifications published by
        Universal, with current wait times updated throughout the day.
      </p>

      <WaitsExplorer data={webData} initialParkSlug={params.park} />

      <AdSlot
        placement="waits-after-boards"
        slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_WAITS}
      />
    </main>
  );
}
