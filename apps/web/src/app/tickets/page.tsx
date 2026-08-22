import { centsToDisplay, GuestCategory } from "@ratecoaster/shared";
import { getClient, dayNumber, dayOfWeekLabel, formatLongDate, getMe, safe } from "@/lib/api";
import { WatchDateButton } from "@/components/WatchDateButton";
import { AdSlot } from "@/components/AdSlot";
import { BookButton } from "@/components/BookButton";
import { CompareButton } from "@/components/CompareButton";

import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Universal ticket prices by date",
  description:
    "Universal prices admission dynamically, so the same ticket costs noticeably more on a December Saturday than a September Tuesday. See every date priced side by side.",
  path: "/tickets",
});

export const revalidate = 300;

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; destination?: string; guest?: string }>;
}) {
  const params = await searchParams;
  const destination = params.destination ?? "universal-orlando";
  const guestCategory = GuestCategory.catch("adult").parse(params.guest);
  const client = await getClient();
  // Decides whether the watch control offers a sign-up or creates the watch.
  const me = await getMe();
  const products = await safe(client.listTicketProducts(destination), []);
  const selected = params.product ?? products[0]?.slug;
  const selectedProduct = products.find((p) => p.slug === selected);
  const calendar = selected
    ? await safe(client.ticketCalendar({ productSlug: selected, guestCategory }), [])
    : [];

  const calendarDays = calendar.map((day) => ({
    ...day,
    displayCents:
      (selectedProduct?.days ?? 1) > 1
        ? (day.totalCents ?? day.priceCents)
        : day.priceCents,
  }));
  const priced = calendarDays.filter(
    (day): day is typeof day & { displayCents: number } =>
      day.available && day.displayCents !== null
  );
  const cheapest = [...priced].sort((a, b) => a.displayCents - b.displayCents)[0];
  const dearest = [...priced].sort((a, b) => b.displayCents - a.displayCents)[0];
  const swing = cheapest && dearest ? dearest.displayCents - cheapest.displayCents : 0;

  return (
    <main className="section">
      <h1>Ticket prices by date</h1>
      <p className="lede" style={{ marginTop: 12 }}>
        Universal prices admission by date — the same ticket costs noticeably more on a December
        Saturday than a September Tuesday. Green days are the cheapest.
      </p>

      <div className="chips">
        {products.map((p) => (
          <a key={p.slug} href={`/tickets?destination=${destination}&product=${p.slug}&guest=${guestCategory}`}
             className={`chip ${selected === p.slug ? "on" : ""}`}>
            {p.name}
          </a>
        ))}
      </div>

      <div className="chips" style={{ marginTop: 0 }} aria-label="Guest age">
        {(["adult", "child"] as const).map((category) => (
          <a
            key={category}
            href={`/tickets?destination=${destination}&product=${selected ?? ""}&guest=${category}`}
            className={`chip ${guestCategory === category ? "on" : ""}`}
            aria-pressed={guestCategory === category}
          >
            {category === "adult" ? "Adult" : "Child"}
          </a>
        ))}
      </div>

      {selectedProduct?.bookingUrl ? (
        <BookButton
          url={selectedProduct.bookingUrl}
          merchant={selectedProduct.bookingMerchant}
          size="lg"
        />
      ) : null}

      {calendar.length === 0 ? (
        <div className="notice">
          <b>Ticket price tracking isn&apos;t live yet.</b> When it is, you&apos;ll see every date
          priced side by side so you can spot the cheap days at a glance.
        </div>
      ) : (
        <>
          {cheapest ? (
            <div className="grid grid-3" style={{ margin: "24px 0 28px" }}>
              <div className="card" style={{ background: "var(--teal-tint)", borderColor: "transparent" }}>
                <div className="tiny" style={{ fontWeight: 700, color: "#077368" }}>CHEAPEST DAY</div>
                <div className="cal-price" style={{ fontSize: 32, color: "#077368" }}>
                  {centsToDisplay(cheapest.displayCents)}
                </div>
                <div className="tiny muted">{formatLongDate(cheapest.validDate)}</div>
                {/* The moment of highest intent on this page: they have just
                    found the cheap date. A CTA 400px further up is a CTA they
                    have to go back for. */}
                {selectedProduct?.bookingUrl ? (
                  <BookButton
                    url={selectedProduct.bookingUrl}
                    merchant={selectedProduct.bookingMerchant}
                  />
                ) : (
                  <CompareButton
                    linkKey={
                      destination === "universal-hollywood"
                        ? "tickets-hollywood"
                        : "tickets-orlando"
                    }
                  />
                )}
                {/* Defaults to the cheapest date, which is the one they are
                    looking at when the thought "tell me if this drops" occurs. */}
                {selectedProduct ? (
                  <WatchDateButton
                    kind="ticket"
                    productId={selectedProduct.id}
                    productName={selectedProduct.name}
                    destination={destination}
                    signedIn={Boolean(me.user)}
                    returnTo={`/tickets?destination=${destination}&product=${selected ?? ""}`}
                    defaultDate={cheapest.validDate}
                  />
                ) : null}
              </div>
              <div className="card" style={{ background: "var(--coral-tint)", borderColor: "transparent" }}>
                <div className="tiny" style={{ fontWeight: 700, color: "#b03514" }}>PEAK DAY</div>
                <div className="cal-price" style={{ fontSize: 32, color: "#b03514" }}>
                  {centsToDisplay(dearest?.displayCents)}
                </div>
                <div className="tiny muted">{dearest ? formatLongDate(dearest.validDate) : ""}</div>
              </div>
              <div className="card" style={{ background: "var(--blue-tint)", borderColor: "transparent" }}>
                <div className="tiny" style={{ fontWeight: 700, color: "var(--blue-dark)" }}>
                  PICKING WELL SAVES
                </div>
                <div className="cal-price" style={{ fontSize: 32, color: "var(--blue-dark)" }}>
                  {centsToDisplay(swing)}
                </div>
                <div className="tiny muted">per ticket, same product</div>
              </div>
            </div>
          ) : null}

          <div className="cal">
            {calendarDays.map((day) => (
              <div key={day.validDate}
                   className={`cal-day ${day.band === "low" ? "cal-low" : day.band === "high" ? "cal-high" : ""} ${day.isWindowLow ? "cal-best" : ""}`}>
                <div className="cal-dow">{dayOfWeekLabel(day.validDate)}</div>
                <div className="tiny muted">{dayNumber(day.validDate)}</div>
                <div className="cal-price">
                  {day.available ? centsToDisplay(day.displayCents) : "Sold out"}
                </div>
                {day.available && (selectedProduct?.days ?? 1) > 1 ? (
                  <div className="tiny muted">{centsToDisplay(day.priceCents)} / day</div>
                ) : null}
                {day.isWindowLow ? (
                  <span className="badge badge-hot" style={{ marginTop: 6 }}>Best</span>
                ) : null}
              </div>
            ))}
          </div>
        </>
      )}

      <AdSlot
        placement="tickets-after-calendar"
        slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_TICKETS}
      />
    </main>
  );
}
