import { getClient, safe } from "@/lib/api";
import { AdSlot } from "@/components/AdSlot";
import { WaitsExplorer } from "@/components/WaitsExplorer";
import { pageMetadata } from "@/lib/seo";
import { rideImage } from "@/lib/ride-images";
import { PageIntro } from "@/components/PageIntro";

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
    <main className="section page-refresh waits-refresh">
      <PageIntro eyebrow="The park pulse" title="Your next ride starts here."
        image={{ src: "/brand/home-adventure.webp", alt: "Jurassic World VelociCoaster at Islands of Adventure", label: "Islands of Adventure · Universal Orlando" }}
        action={{ href: "/crowd-calendar", label: "Plan a lighter park day" }}>
      <p className="lede" style={{ marginTop: 12 }}>
        Search, sort, and filter Universal attractions using classifications published by
        Universal, with current wait times updated throughout the day.
      </p>
      </PageIntro>

      <WaitsExplorer data={webData} initialParkSlug={params.park} />

      <AdSlot
        placement="waits-after-boards"
        slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_WAITS}
      />
    </main>
  );
}
