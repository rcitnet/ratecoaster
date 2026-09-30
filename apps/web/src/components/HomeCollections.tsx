"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { centsToDisplay, formatParkHours, parkStateMessage, RATE_CODE_LABELS, type Deal } from "@ratecoaster/shared";
import type { HomeParkPulse } from "@/components/HomeHero";
import hotelImages from "@/lib/hotel-images.json";

const SAVED_KEY = "ratecoaster.saved-stays.v1";
const tiers: Record<string, string> = { premier: "Premier", preferred: "Preferred", "prime-value": "Prime Value", value: "Value", "universal-classic": "Universal Classic", partner: "Partner" };
const parkColors: Record<string, string> = { "epic-universe": "#5a3bc4", "islands-of-adventure": "#258a77", "universal-studios-florida": "#d51b78", "volcano-bay": "#bb7d20" };

function HotelPhoto({ slug, name }: { slug: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const available = Object.hasOwn(hotelImages, slug);
  return <div className="refresh-hotel-photo">
    {available && !failed ? <Image src={`/hotels/${slug}.webp`} alt={name} fill
      sizes="(max-width: 700px) 90vw, (max-width: 1000px) 45vw, 40vw"
      onError={() => setFailed(true)} /> : <div className="refresh-photo-fallback"><span aria-hidden="true">⌂</span><span>{name}</span></div>}
  </div>;
}

export function HomeDeals({ deals }: { deals: Deal[] }) {
  const [saved, setSaved] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [onlySaved, setOnlySaved] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    function read() {
      try {
        const parsed: unknown = JSON.parse(localStorage.getItem(SAVED_KEY) ?? "[]");
        setSaved(Array.isArray(parsed) ? parsed.filter((slug): slug is string => typeof slug === "string") : []);
      } catch { setSaved([]); }
      setReady(true);
    }
    read();
    function sync(event: StorageEvent) { if (event.key === SAVED_KEY || event.key === null) read(); }
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  function toggle(deal: Deal) {
    const exists = saved.includes(deal.propertySlug);
    const next = exists ? saved.filter((slug) => slug !== deal.propertySlug) : [...saved, deal.propertySlug];
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(next));
      setSaved(next);
      setMessage(`${deal.propertyName} ${exists ? "removed from" : "added to"} your saved stays.`);
    } catch { setMessage("Your browser couldn’t save this stay. Allow local storage to keep a shortlist on this device."); }
  }
  const visible = onlySaved ? deals.filter((deal) => saved.includes(deal.propertySlug)) : deals;
  const savedCount = deals.filter((deal) => saved.includes(deal.propertySlug)).length;

  return <>
    <div className="refresh-section-head">
      <div><h2>Great stays. Better finds.</h2><p>Our strongest current pick in each Orlando hotel category.</p></div>
      <div className="refresh-head-actions">
        <button className="btn btn-ghost btn-sm" disabled={!ready} aria-pressed={onlySaved}
          onClick={() => setOnlySaved(!onlySaved)}><span aria-hidden="true">♡</span> Saved picks {savedCount}</button>
        <a href="/hotels" className="refresh-text-link">All hotel rates <span aria-hidden="true">→</span></a>
      </div>
    </div>
    {deals.length === 0 ? <div className="notice"><b>We’re gathering hotel rates.</b> Explore <a href="/hotels">our hotels</a> or <a href="/waits">live ride waits</a> while new prices are collected.</div> :
      visible.length === 0 ? <div className="refresh-empty">No saved picks in today’s selection. Show all picks and tap a heart to start your shortlist.</div> :
      <div className="refresh-deals">
        {visible.map((deal, index) => {
          const isSaved = saved.includes(deal.propertySlug);
          const href = `/hotels/${deal.propertySlug}?${new URLSearchParams({ rateCode: deal.rateCode, stayDate: deal.stayDate })}`;
          return <article className={`refresh-deal ${index === 0 ? "refresh-deal-featured" : ""}`} key={deal.propertySlug}>
            <div className="refresh-deal-visual">
              <a href={href} tabIndex={-1} aria-hidden="true"><HotelPhoto slug={deal.propertySlug} name={deal.propertyName} /></a>
              {index === 0 && <span className="refresh-feature-tag">✦ Featured find</span>}
              <button className="refresh-save" disabled={!ready} aria-label={`${isSaved ? "Unsave" : "Save"} ${deal.propertyName}`}
                aria-pressed={isSaved} onClick={() => toggle(deal)}>{isSaved ? "♥" : "♡"}</button>
            </div>
            <div className="refresh-deal-body">
              <div className="refresh-eyebrow">{tiers[deal.tier] ?? deal.tier} · Best in category</div>
              <h3><a href={href}>{deal.propertyName}</a></h3>
              <div className="refresh-deal-perks">
                {deal.includesExpressPass && <span className="refresh-tag">Express Unlimited included</span>}
                {deal.percentileOfHistory !== null && deal.percentileOfHistory < 5 && <span className="refresh-tag">Among its lowest tracked rates</span>}
                {deal.savingsCents !== null && deal.savingsCents > 0 && <span className="refresh-tag">{centsToDisplay(deal.savingsCents)} less than standard / night</span>}
                {deal.isEstimated && <span className="refresh-tag refresh-tag-estimated">Estimated rate</span>}
              </div>
              <p>{new Date(`${deal.stayDate}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })} · {deal.nights} {deal.nights === 1 ? "night" : "nights"}</p>
              <p>{RATE_CODE_LABELS[deal.rateCode]} rate</p>
              <div className="refresh-deal-bottom"><div className="refresh-price">{centsToDisplay(deal.nightlyCents)} <small>/ night</small></div><a href={href} className={`btn btn-sm ${index === 0 ? "btn-primary" : "btn-ghost"}`}>See deal <span aria-hidden="true">→</span></a></div>
            </div>
          </article>;
        })}
      </div>}
    <p className="refresh-trust">Nightly room rates before taxes and fees. Picks compare each hotel with its own tracked history. Saved stays are stored on this device.</p>
    <p className="refresh-save-status" role="status">{message}</p>
  </>;
}

export function HomeParkCards({ parks }: { parks: HomeParkPulse[] }) {
  const [selected, setSelected] = useState("all");
  const visible = selected === "all" ? parks : parks.filter(({ park }) => park.slug === selected);
  if (parks.length === 0) return <div className="notice"><b>Live park waits are refreshing.</b> A new snapshot will appear after the next collection.</div>;
  return <>
    <div className="refresh-park-tabs" role="group" aria-label="Filter parks">
      {[{ slug: "all", name: "All parks" }, ...parks.map(({ park }) => park)].map((park) =>
        <button key={park.slug} aria-pressed={selected === park.slug} onClick={() => setSelected(park.slug)}>{park.name}</button>)}
    </div>
    <div className="refresh-parks">
      {visible.map(({ park, average, state, hours, openCount, walkOnCount, shortest }) => {
        const hoursLabel = formatParkHours(hours, park.timezone);
        return <a className="refresh-park" href={`/waits?park=${park.slug}`} key={park.slug} style={{ borderTopColor: parkColors[park.slug] ?? "#5a3bc4" }}>
          <h3>{park.name}</h3>
          {state === "closed" || average === null ? <div className="refresh-park-status">{state === "closed" ? "Closed" : "No waits posted"}</div> :
            <div className="refresh-minutes">{average} <small>min average</small></div>}
          <p>{parkStateMessage(state, openCount, walkOnCount, hours, park.timezone)}</p>
          {hoursLabel && <p>Today: {hoursLabel}</p>}
          {shortest && state !== "closed" && <p className="refresh-shortest"><b>Shortest posted:</b> {shortest.attractionName} · {shortest.waitMinutes}m</p>}
          <span className="refresh-text-link">See attractions <span aria-hidden="true">→</span></span>
        </a>;
      })}
    </div>
  </>;
}
