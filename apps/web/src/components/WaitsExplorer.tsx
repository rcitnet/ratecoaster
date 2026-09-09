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

function FilterChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`chip ${selected ? "on" : ""}`}
      aria-pressed={selected}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

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
  const [interest, setInterest] = useState<string | null>(null);
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

  const availableInterests = useMemo(() => {
    const values = new Map<string, string>();
    for (const attraction of parkAttractions) {
      for (const item of attraction.interests) values.set(item.key, item.label);
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
        .filter(
          (attraction) =>
            !interest || attraction.interests.some((item) => item.key === interest)
        )
        .filter((attraction) => {
          if (!normalizedQuery) return true;
          const searchable = [
            attraction.attractionName,
            attraction.land ?? "",
            KIND_LABELS[attraction.kind],
            ...attraction.attractionTypes.map((type) => type.label),
            ...attraction.interests.map((item) => item.label),
          ]
            .join(" ")
            .toLocaleLowerCase();
          return searchable.includes(normalizedQuery);
        })
        .sort(SORTERS[sort]),
    [attractionKind, interest, normalizedQuery, parkAttractions, rideType, sort]
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
    setInterest(null);
    const url = nextPark ? `/waits?park=${encodeURIComponent(nextPark)}` : "/waits";
    window.history.replaceState(null, "", url);
  }

  return (
    <>
      <div className="waits-filters" aria-label="Attraction filters">
        <label className="waits-search-label" htmlFor="waits-search">
          Search attractions
        </label>
        <input
          id="waits-search"
          className="waits-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search rides, shows, lands, or categories"
        />

        <div className="waits-control-group">
          <div className="waits-control-label">Park</div>
          <div className="chips waits-control-chips">
            <FilterChip label="All parks" selected={!parkSlug} onClick={() => choosePark(null)} />
            {data.parks.map(({ park }) => (
              <button
                type="button"
                key={park.id}
                className={`chip ${parkSlug === park.slug ? "on" : ""}`}
                aria-pressed={parkSlug === park.slug}
                onClick={() => choosePark(park.slug)}
              >
                <span
                  className="chip-dot"
                  style={{ background: PARK_COLORS[park.slug] ?? "#3355ee" }}
                  aria-hidden="true"
                />
                {park.name}
              </button>
            ))}
          </div>
        </div>

        <div className="waits-filter-columns">
          <div className="waits-control-group">
            <div className="waits-control-label">Sort</div>
            <div className="chips waits-control-chips">
              {SORT_OPTIONS.map((option) => (
                <FilterChip
                  key={option.value}
                  label={option.label}
                  selected={sort === option.value}
                  onClick={() => setSort(option.value)}
                />
              ))}
            </div>
          </div>

          <div className="waits-control-group">
            <div className="waits-control-label">Attraction category</div>
            <div className="chips waits-control-chips">
              <FilterChip label="All categories" selected={!attractionKind} onClick={() => setAttractionKind(null)} />
              {availableKinds.map((kind) => (
                <FilterChip
                  key={kind}
                  label={KIND_LABELS[kind]}
                  selected={attractionKind === kind}
                  onClick={() => setAttractionKind(kind)}
                />
              ))}
            </div>
          </div>
        </div>

        {availableRideTypes.length > 0 ? (
          <div className="waits-control-group">
            <div className="waits-control-label">Official ride type</div>
            <div className="chips waits-control-chips">
              <FilterChip label="All ride types" selected={!rideType} onClick={() => setRideType(null)} />
              {availableRideTypes.map((type) => (
                <FilterChip key={type.key} label={type.label} selected={rideType === type.key} onClick={() => setRideType(type.key)} />
              ))}
            </div>
          </div>
        ) : null}

        {availableInterests.length > 0 ? (
          <div className="waits-control-group">
            <div className="waits-control-label">Official interest</div>
            <div className="chips waits-control-chips">
              <FilterChip label="All interests" selected={!interest} onClick={() => setInterest(null)} />
              {availableInterests.map((item) => (
                <FilterChip key={item.key} label={item.label} selected={interest === item.key} onClick={() => setInterest(item.key)} />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="waits-results-head">
        <strong>{filtered.length} attraction{filtered.length === 1 ? "" : "s"}</strong>
        <span className="tiny muted">Updated {relativeTime(data.fetchedAt)}</span>
      </div>

      {allOpen.length > 0 ? (
        <div className="grid grid-4 waits-summary">
          <div className="card" style={{ background: "var(--teal-tint)", borderColor: "transparent" }}>
            <div className="tiny" style={{ color: "#077368", fontWeight: 700 }}>OPEN NOW</div>
            <div className="cal-price" style={{ fontSize: 30, color: "#077368" }}>{allOpen.length}</div>
          </div>
          <div className="card" style={{ background: "var(--blue-tint)", borderColor: "transparent" }}>
            <div className="tiny" style={{ color: "var(--blue-dark)", fontWeight: 700 }}>AVERAGE WAIT</div>
            <div className="cal-price" style={{ fontSize: 30, color: "var(--blue-dark)" }}>
              {Math.round(allOpen.reduce((sum, wait) => sum + (wait.waitMinutes ?? 0), 0) / allOpen.length)}m
            </div>
          </div>
          <div className="card" style={{ background: "var(--coral-tint)", borderColor: "transparent" }}>
            <div className="tiny" style={{ color: "#b03514", fontWeight: 700 }}>LONGEST RIGHT NOW</div>
            <div className="cal-price" style={{ fontSize: 30, color: "#b03514" }}>{busiest?.waitMinutes}m</div>
            <div className="tiny muted" style={{ marginTop: 2 }}>{busiest?.attractionName}</div>
          </div>
          <div className="card" style={{ background: "var(--yellow-tint)", borderColor: "transparent" }}>
            <div className="tiny" style={{ color: "#7a5410", fontWeight: 700 }}>WALK-ONS</div>
            <div className="cal-price" style={{ fontSize: 30, color: "#7a5410" }}>
              {allOpen.filter((wait) => (wait.waitMinutes ?? 99) <= 15).length}
            </div>
            <div className="tiny muted" style={{ marginTop: 2 }}>15 minutes or less</div>
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
