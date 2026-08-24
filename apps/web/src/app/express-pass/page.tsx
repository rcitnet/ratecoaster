import { centsToDisplay, ExpressPassType } from "@ratecoaster/shared";
import { getClient, dayNumber, dayOfWeekLabel, getMe, safe } from "@/lib/api";
import { AdSlot } from "@/components/AdSlot";
import { WatchDateButton } from "@/components/WatchDateButton";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Universal Express Pass prices by date",
  description:
    "Express Pass is the most volatile price at Universal, swinging by hundreds of dollars between dates. Compare every day before you buy — or check which hotels include it free.",
  path: "/express-pass",
});

export const revalidate = 300;

const PARK_LABELS: Record<string, string> = {
  "universal-studios-florida": "Universal Studios Florida",
  "islands-of-adventure": "Islands of Adventure",
  "epic-universe": "Epic Universe",
  "volcano-bay": "Volcano Bay",
};

const TYPE_LABELS = {
  standard: "Express",
  unlimited: "Express Unlimited",
  plus: "Express Plus",
} as const;

export default async function ExpressPage({
  searchParams,
}: {
  searchParams: Promise<{
    product?: string;
    park?: string;
    passType?: string;
    days?: string;
  }>;
}) {
  const params = await searchParams;
  const destination = "universal-orlando" as const;
  const parsedPassType = ExpressPassType.safeParse(params.passType);
  const passType = parsedPassType.success ? parsedPassType.data : undefined;
  const parsedDays = Number(params.days);
  const days = Number.isInteger(parsedDays) && parsedDays >= 1 && parsedDays <= 5
    ? parsedDays
    : undefined;
  const park = params.park && PARK_LABELS[params.park] ? params.park : undefined;

  const client = await getClient();
  const products = await safe(client.listExpressPassProducts(destination), []);
  const filteredProducts = products.filter(
    (product) =>
      (!park || product.parkSlugs.includes(park)) &&
      (!passType || product.passType === passType) &&
      (!days || product.days === days)
  );
  const selected = filteredProducts.find((product) => product.slug === params.product)
    ?? filteredProducts[0]
    ?? null;
  const prices = selected
    ? await safe(client.expressPassCalendar({ destination, productSlug: selected.slug }), [])
    : [];
  const availablePrices = prices.filter((price) => price.available);
  const values = availablePrices.map((price) => price.totalCents).sort((a, b) => a - b);
  const low = values[0] ?? null;
  const high = values.at(-1) ?? null;
  const median = values[Math.floor(values.length / 2)] ?? null;
  // The date the cheapest price belongs to, so the watch form opens on the day
  // they are already looking at rather than an arbitrary one a month out.
  const cheapestDate =
    [...availablePrices].sort((a, b) => a.totalCents - b.totalCents)[0]?.validDate ?? null;
  const me = await getMe();
  const filterParams = new URLSearchParams();
  if (park) filterParams.set("park", park);
  if (passType) filterParams.set("passType", passType);
  if (days) filterParams.set("days", String(days));
  const filterSuffix = filterParams.toString() ? `&${filterParams.toString()}` : "";
  return (
    <main className="section">
      <h1>Express Pass prices</h1>
      <p className="lede" style={{ marginTop: 12 }}>
        Compare every current Express product for Universal Studios Florida, Islands of Adventure,
        Epic Universe, and Volcano Bay. Multi-day cards show the exact whole-pass price and the
        storefront&apos;s per-day amount.
      </p>

      <form action="/express-pass" method="get" className="pricing-filter-form">
        <label>
          <span>Park</span>
          <select className="field" name="park" defaultValue={park ?? ""}>
            <option value="">All parks</option>
            {Object.entries(PARK_LABELS).map(([slug, label]) => (
              <option key={slug} value={slug}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Pass type</span>
          <select className="field" name="passType" defaultValue={passType ?? ""}>
            <option value="">All types</option>
            <option value="standard">Express</option>
            <option value="unlimited">Express Unlimited</option>
            <option value="plus">Express Plus</option>
          </select>
        </label>
        <label>
          <span>Duration</span>
          <select className="field" name="days" defaultValue={days ? String(days) : ""}>
            <option value="">All durations</option>
            {[1, 2, 3, 4, 5].map((count) => (
              <option key={count} value={count}>{count} day{count === 1 ? "" : "s"}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn-blue">Apply filters</button>
      </form>

      {filteredProducts.length > 0 ? (
        <div className="chips express-product-chips">
          {filteredProducts.map((product) => (
            <a
              key={product.slug}
              href={`/express-pass?product=${product.slug}${filterSuffix}`}
              className={`chip ${selected?.slug === product.slug ? "on" : ""}`}
            >
              <span>{product.days}D</span>
              {product.name.replace(/^\d-Day /, "")}
            </a>
          ))}
        </div>
      ) : (
        <div className="notice notice-warn">
          <b>No Express product matches those filters.</b> Try selecting all durations or all pass types.
        </div>
      )}

      {selected ? (
        <section className="express-selection">
          <span className="badge badge-purple">{TYPE_LABELS[selected.passType]}</span>
          <h2>{selected.name}</h2>
          <p className="muted">
            {selected.days} day{selected.days === 1 ? "" : "s"} · {selected.parkSlugs.map((slug) => PARK_LABELS[slug] ?? slug).join(" + ")}
          </p>
        </section>
      ) : null}

      {selected && prices.length === 0 ? (
        <div className="notice">
          <b>Prices for this Express product haven&apos;t been collected yet.</b> The product is configured;
          its date calendar will appear after the first Express collection run.
        </div>
      ) : selected ? (
        <>
          <div className="grid grid-3" style={{ margin: "24px 0 28px" }}>
            <div className="card" style={{ background: "var(--teal-tint)", borderColor: "transparent" }}>
              <div className="tiny" style={{ fontWeight: 700, color: "#077368" }}>CHEAPEST PASS</div>
              <div className="cal-price" style={{ fontSize: 32, color: "#077368" }}>{centsToDisplay(low)}</div>
              {/*
                Express is the most volatile price Universal sells, swinging by
                hundreds between dates — which makes it the single best thing on
                the site to be told about rather than to keep checking.
              */}
              <WatchDateButton
                kind="express"
                productId={selected.id}
                productName={selected.name}
                destination={destination}
                signedIn={Boolean(me.user)}
                returnTo="/express-pass"
                defaultDate={cheapestDate ?? undefined}
              />
            </div>
            <div className="card">
              <div className="tiny" style={{ fontWeight: 700, color: "var(--ink-mute)" }}>TYPICAL PASS</div>
              <div className="cal-price" style={{ fontSize: 32 }}>{centsToDisplay(median)}</div>
            </div>
            <div className="card" style={{ background: "var(--coral-tint)", borderColor: "transparent" }}>
              <div className="tiny" style={{ fontWeight: 700, color: "#b03514" }}>PEAK PASS</div>
              <div className="cal-price" style={{ fontSize: 32, color: "#b03514" }}>{centsToDisplay(high)}</div>
            </div>
          </div>

          <div className="cal">
            {prices.map((price) => {
              const total = price.totalCents;
              const band = !price.available || median === null ? ""
                : total <= median * 0.9 ? "cal-low"
                  : total >= median * 1.25 ? "cal-high" : "";
              return (
                <div
                  key={`${price.productSlug}-${price.validDate}`}
                  className={`cal-day ${band} ${price.available && total === low ? "cal-best" : ""}`}
                >
                  <div className="cal-dow">{dayOfWeekLabel(price.validDate)}</div>
                  <div className="tiny muted">{dayNumber(price.validDate)}</div>
                  {price.available ? (
                    <>
                      <div className="cal-price">{centsToDisplay(total)}</div>
                      {selected.days > 1 ? (
                        <div className="tiny muted">{centsToDisplay(price.priceCents)} / day</div>
                      ) : null}
                    </>
                  ) : <div className="tiny muted" style={{ marginTop: 8 }}>Sold out</div>}
                </div>
              );
            })}
          </div>

          <p className="tiny muted" style={{ marginTop: 22 }}>
            Theme park admission is separate. Premier hotels include Express Unlimited for eligible
            participating attractions at Universal Studios Florida and Islands of Adventure; check
            the hotel&apos;s current benefit terms before comparing that perk with a purchased pass.
          </p>
        </>
      ) : null}

      <AdSlot
        placement="express-after-calendar"
        slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_EXPRESS}
      />
    </main>
  );
}
