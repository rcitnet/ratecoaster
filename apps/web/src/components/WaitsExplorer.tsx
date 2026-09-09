"use client";

import { useMemo, useState } from "react";
import {
  deriveParkState,
  formatParkHours,
  parkStateMessage,
  type AttractionKind,
  type LiveWait,
  type LiveWaitsResponse,
} from "@ratecoaster/shared";
import { RideImage } from "@/components/RideImage";

type WebWait = LiveWait & { imageSrc: string | null };
type WebParkEntry = Omit<LiveWaitsResponse["parks"][number], "waits"> & { waits: WebWait[] };
type WebWaitsData = Omit<LiveWaitsResponse, "parks"> & { parks: WebParkEntry[] };

const PARK_COLORS: Record<string, string> = {
  "universal-studios-florida": "#3355ee",
  "islands-of-adventure": "#0fb5a5",
  "epic-universe": "#e6218c",
  "volcano-bay": "#ff6a45",
  "universal-studios-hollywood": "#8b5cf6",
  "universal-kids-resort": "#ffc53d",
};

function relativeTime(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} days ago`;
}

type SortOption = "wait-asc" | "wait-desc" | "name-asc" | "name-desc";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "wait-asc", label: "Shortest wait" },
  { value: "wait-desc", label: "Longest wait" },
  { value: "name-asc", label: "Name A–Z" },
  { value: "name-desc", label: "Name Z–A" },
];

const KIND_ORDER: AttractionKind[] = ["ride", "show", "meet-and-greet", "other"];
const KIND_LABELS: Record<AttractionKind, string> = {
  ride: "Ride",
  show: "Show",
  "meet-and-greet": "Meet & greet",
  other: "Other",
};

function waitClass(minutes: number | null, status: string): string {
  if (status !== "operating" || minutes === null) return "w-off";
  if (minutes <= 20) return "w-low";
  if (minutes <= 45) return "w-mid";
  return "w-high";
}

function statusLabel(status: string): string {
  if (status === "down") return "Down";
  if (status === "refurbishment") return "Refurb";
  return "Closed";
}

function waitValue(attraction: LiveWait) {
  return attraction.status === "operating" && attraction.waitMinutes !== null
    ? attraction.waitMinutes
    : null;
}

function compareNames(left: LiveWait, right: LiveWait) {
  return left.attractionName.localeCompare(right.attractionName, undefined, { sensitivity: "base" });
}

function compareNullable(left: number | null, right: number | null, direction: 1 | -1) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return (left - right) * direction;
}

const SORTERS: Record<SortOption, (left: LiveWait, right: LiveWait) => number> = {
  "wait-asc": (left, right) =>
    compareNullable(waitValue(left), waitValue(right), 1) || compareNames(left, right),
  "wait-desc": (left, right) =>
    compareNullable(waitValue(left), waitValue(right), -1) || compareNames(left, right),
  "name-asc": compareNames,
  "name-desc": (left, right) => compareNames(right, left),
};

export function WaitsExplorer({
  data,
  initialParkSlug,
}: {
  data: WebWaitsData;
  initialParkSlug?: string;
}) {
  const validInitialPark = data.parks.some(({ park }) => park.slug === initialParkSlug)
    ? initialParkSlug ?? null
    : null;
  const [parkSlug, setParkSlug] = useState<string | null>(validInitialPark);
  const [attractionKind, setAttractionKind] = useState<AttractionKind | null>("ride");
  const [rideType, setRideType] = useState<string | null>(null);
  const [sort, setSort] = useState<SortOption>("wait-asc");
  const [query, setQuery] = useState("");

  const parkAttractions = useMemo(
    () =>
      data.parks
        .filter(({ park }) => !parkSlug || park.slug === parkSlug)
        .flatMap(({ waits }) => waits),
    [data, parkSlug]
  );

  const availableKinds = useMemo(
    () =>
      [...new Set(parkAttractions.map((attraction) => attraction.kind))].sort(
        (left, right) => KIND_ORDER.indexOf(left) - KIND_ORDER.indexOf(right)
      ),
    [parkAttractions]
  );

  const availableRideTypes = useMemo(() => {
    const values = new Map<string, string>();
    for (const attraction of parkAttractions) {
      for (const type of attraction.attractionTypes) values.set(type.key, type.label);
    }
    return [...values].map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [parkAttractions]);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = useMemo(
    () =>
      parkAttractions
        .filter((attraction) => !attractionKind || attraction.kind === attractionKind)
        .filter(
          (attraction) =>
            !rideType || attraction.attractionTypes.some((type) => type.key === rideType)
        )
        .filter((attraction) => {
          if (!normalizedQuery) return true;
          const searchable = [
            attraction.attractionName,
            attraction.land ?? "",
            KIND_LABELS[attraction.kind],
            ...attraction.attractionTypes.map((type) => type.label),
          ]
            .join(" ")
            .toLocaleLowerCase();
          return searchable.includes(normalizedQuery);
        })
        .sort(SORTERS[sort]),
    [attractionKind, normalizedQuery, parkAttractions, rideType, sort]
  );

  const filteredIds = useMemo(
    () => new Set(filtered.map((attraction) => attraction.attractionId)),
    [filtered]
  );
  const visibleParks = data.parks
    .filter(({ park }) => !parkSlug || park.slug === parkSlug)
    .map((entry) => ({
      ...entry,
      waits: entry.waits.filter((attraction) => filteredIds.has(attraction.attractionId)).sort(SORTERS[sort]),
    }))
    .filter(({ waits }) => waits.length > 0);
  const allOpen = filtered.filter(
    (attraction) => attraction.status === "operating" && attraction.waitMinutes !== null
  );
  const busiest = [...allOpen].sort((a, b) => (b.waitMinutes ?? 0) - (a.waitMinutes ?? 0))[0];

  function choosePark(nextPark: string | null) {
    setParkSlug(nextPark);
    setRideType(null);
    const url = nextPark ? `/waits?park=${encodeURIComponent(nextPark)}` : "/waits";
    window.history.replaceState(null, "", url);
  }

  function clearFilters() {
    setParkSlug(null);
    setAttractionKind("ride");
    setRideType(null);
    setSort("wait-asc");
    setQuery("");
    window.history.replaceState(null, "", "/waits");
  }

  const hasCustomFilters = Boolean(
    parkSlug || attractionKind !== "ride" || rideType || sort !== "wait-asc" || query
  );

  return (
    <>
      <div className="waits-toolbar" aria-label="Attraction filters">
        <div className="waits-filter-grid">
          <label className="waits-field waits-field-search" htmlFor="waits-search">
            <span>Search</span>
            <input
              id="waits-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ride, show, or land"
            />
          </label>

          <label className="waits-field" htmlFor="waits-park">
            <span>Park</span>
            <select
              id="waits-park"
              value={parkSlug ?? ""}
              onChange={(event) => choosePark(event.target.value || null)}
            >
              <option value="">All parks</option>
              {data.parks.map(({ park }) => (
                <option key={park.id} value={park.slug}>{park.name}</option>
              ))}
            </select>
          </label>

          <label className="waits-field" htmlFor="waits-sort">
            <span>Sort by</span>
            <select
              id="waits-sort"
              value={sort}
              onChange={(event) => setSort(event.target.value as SortOption)}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="waits-field" htmlFor="waits-category">
            <span>Category</span>
            <select
              id="waits-category"
              value={attractionKind ?? ""}
              onChange={(event) => setAttractionKind((event.target.value || null) as AttractionKind | null)}
            >
              <option value="">All categories</option>
              {availableKinds.map((kind) => (
                <option key={kind} value={kind}>{KIND_LABELS[kind]}</option>
              ))}
            </select>
          </label>

          {availableRideTypes.length > 0 ? (
            <label className="waits-field" htmlFor="waits-ride-type">
              <span>Ride type</span>
              <select
                id="waits-ride-type"
                value={rideType ?? ""}
                onChange={(event) => setRideType(event.target.value || null)}
              >
                <option value="">All ride types</option>
                {availableRideTypes.map((type) => (
                  <option key={type.key} value={type.key}>{type.label}</option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <div className="waits-toolbar-foot">
          <span className="tiny muted">Filters update the list instantly.</span>
          {hasCustomFilters ? (
            <button type="button" className="waits-clear" onClick={clearFilters}>Reset filters</button>
          ) : null}
        </div>
      </div>

      <div className="waits-results-head">
        <strong>{filtered.length} attraction{filtered.length === 1 ? "" : "s"}</strong>
        <span className="tiny muted">Updated {relativeTime(data.fetchedAt)}</span>
      </div>

      {allOpen.length > 0 ? (
        <div className="waits-summary">
          <div className="waits-stat">
            <span>Open now</span>
            <strong>{allOpen.length}</strong>
          </div>
          <div className="waits-stat">
            <span>Average wait</span>
            <strong>{Math.round(allOpen.reduce((sum, wait) => sum + (wait.waitMinutes ?? 0), 0) / allOpen.length)}m</strong>
          </div>
          <div className="waits-stat waits-stat-wide">
            <span>Longest right now</span>
            <strong>{busiest?.waitMinutes}m</strong>
            <small>{busiest?.attractionName}</small>
          </div>
          <div className="waits-stat">
            <span>15 min or less</span>
            <strong>{allOpen.filter((wait) => (wait.waitMinutes ?? 99) <= 15).length}</strong>
          </div>
        </div>
      ) : null}

      {visibleParks.length > 0 ? visibleParks.map(({ park, waits, hours }) => {
        const allParkWaits = data.parks.find((entry) => entry.park.id === park.id)?.waits ?? [];
        const allParkOpen = allParkWaits.filter(
          (wait) => wait.status === "operating" && wait.waitMinutes !== null
        );
        const state = deriveParkState({ waits: allParkWaits, hours });
        const todaysHours = formatParkHours(hours, park.timezone);
        const color = PARK_COLORS[park.slug] ?? "#3355ee";
        return (
          <section key={park.slug}>
            <div className="park-head">
              <span className="park-swatch" style={{ background: color }} />
              <div>
                <h2 style={{ margin: 0 }}>{park.name}</h2>
                <div className="tiny muted">
                  {state === "closed"
                    ? `${parkStateMessage(state, 0, 0, hours, park.timezone)}${todaysHours ? ` · today ${todaysHours}` : ""}`
                    : `${waits.length} matching · ${allParkOpen.length} currently open${todaysHours ? ` · open ${todaysHours}` : ""}`}
                </div>
              </div>
            </div>

            <div className="wait-grid">
              {waits.map((wait) => (
                <a
                  className="wait-card"
                  key={wait.attractionId}
                  href={`/waits/${encodeURIComponent(wait.attractionSlug)}`}
                  aria-label={`See wait history and park map for ${wait.attractionName}`}
                >
                  <RideImage src={wait.imageSrc} />
                  <div className="wait-details">
                    <div className="wait-name">{wait.attractionName}</div>
                    <div className="wait-land">
                      {wait.attractionTypes.length > 0
                        ? wait.attractionTypes.map((type) => type.label).join(" · ")
                        : KIND_LABELS[wait.kind]}
                    </div>
                    <div className="wait-land">
                      {wait.land ?? park.name}
                      {wait.singleRiderMinutes !== null ? ` · single rider ${wait.singleRiderMinutes}m` : ""}
                    </div>
                  </div>
                  <div className={`wait-figure ${waitClass(wait.waitMinutes, wait.status)}`}>
                    {wait.status === "operating" && wait.waitMinutes !== null
                      ? wait.waitMinutes
                      : statusLabel(wait.status)}
                    {wait.status === "operating" && wait.waitMinutes !== null ? <span style={{ fontSize: 13 }}>m</span> : null}
                  </div>
                </a>
              ))}
            </div>
          </section>
        );
      }) : (
        <div className="notice">
          <b>No attractions match these filters.</b> Try another park, category, or search term.
        </div>
      )}
    </>
  );
}
