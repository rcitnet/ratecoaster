type LandPosition = { left: string; top: string };

/**
 * A compact, illustrative park map. Live-wait providers tell us an
 * attraction's land but do not provide a public, stable coordinate for every
 * ride. Keeping the positions at land level makes the map useful without
 * pretending it is an official turn-by-turn park map.
 */
const LAND_POSITIONS: Record<string, Record<string, LandPosition>> = {
  "universal-studios-florida": {
    "Production Central": { left: "27%", top: "67%" },
    "New York": { left: "45%", top: "72%" },
    "San Francisco": { left: "61%", top: "61%" },
    "The Wizarding World of Harry Potter - Diagon Alley": { left: "68%", top: "38%" },
    "World Expo": { left: "55%", top: "25%" },
    "Springfield, U.S.A.": { left: "33%", top: "27%" },
    "Hollywood": { left: "18%", top: "43%" },
  },
  "islands-of-adventure": {
    "Port of Entry": { left: "50%", top: "80%" },
    "Marvel Super Hero Island": { left: "26%", top: "65%" },
    "Toon Lagoon": { left: "18%", top: "41%" },
    "Jurassic Park": { left: "35%", top: "23%" },
    "The Wizarding World of Harry Potter - Hogsmeade": { left: "58%", top: "20%" },
    "The Lost Continent": { left: "74%", top: "37%" },
    "Seuss Landing": { left: "79%", top: "62%" },
  },
  "epic-universe": {
    "Celestial Park": { left: "50%", top: "52%" },
    "Super Nintendo World": { left: "28%", top: "40%" },
    "Dark Universe": { left: "25%", top: "70%" },
    "The Wizarding World of Harry Potter - Ministry of Magic": { left: "71%", top: "69%" },
    "How to Train Your Dragon - Isle of Berk": { left: "74%", top: "34%" },
  },
  "volcano-bay": {
    "Wave Village": { left: "50%", top: "62%" },
    "River Village": { left: "25%", top: "58%" },
    "Rainforest Village": { left: "25%", top: "27%" },
    "The Volcano": { left: "52%", top: "36%" },
    "The Reef": { left: "74%", top: "45%" },
  },
  "universal-studios-hollywood": {
    "Upper Lot": { left: "35%", top: "32%" },
    "Lower Lot": { left: "68%", top: "67%" },
    "The Wizarding World of Harry Potter": { left: "68%", top: "31%" },
    "Super Nintendo World": { left: "72%", top: "78%" },
  },
};

const PARK_CENTERS: Record<string, LandPosition> = {
  "universal-studios-florida": { left: "50%", top: "50%" },
  "islands-of-adventure": { left: "50%", top: "50%" },
  "epic-universe": { left: "50%", top: "52%" },
  "volcano-bay": { left: "50%", top: "50%" },
  "universal-studios-hollywood": { left: "50%", top: "50%" },
};

function normalized(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
}

export function rideLandPosition(parkSlug: string, land: string | null): LandPosition {
  const lands = LAND_POSITIONS[parkSlug] ?? {};
  if (land && lands[land]) return lands[land];

  // Providers occasionally make small punctuation changes to land names.
  if (land) {
    const normalizedLand = normalized(land);
    const match = Object.entries(lands).find(([name]) => {
      const normalizedName = normalized(name);
      return normalizedName === normalizedLand || normalizedLand.includes(normalizedName) || normalizedName.includes(normalizedLand);
    });
    if (match) return match[1];
  }

  return PARK_CENTERS[parkSlug] ?? { left: "50%", top: "50%" };
}
