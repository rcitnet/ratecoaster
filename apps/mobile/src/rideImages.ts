type ImageCatalog = Record<string, Record<string, string>>;

// This is the same checked-in attraction catalogue used by the website. Keeping
// one source means a newly-added website image appears in the app as well.
const images = require("../../web/src/lib/ride-images.json") as ImageCatalog;
const SITE = "https://www.ratecoaster.net";

function key(value: string) {
  return value
    .replace(/[™®©]/g, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

const aliases: Record<string, Record<string, string>> = {
  "universal-studios-florida": {
    hogwartsexpressfirsttrain: "Hogwarts Express - King's Cross Station",
    hogwartsexpresslasttrain: "Hogwarts Express - King's Cross Station",
  },
  "volcano-bay": {
    ohnooftheohyahandohnodropslides: "Ohno of Ohyah & Ohno Drop Slides",
    ohyahoftheohyahandohnodropslides: "Ohyah of Ohyah & Ohno Drop Slides",
  },
};

export function rideImageUrl(parkSlug: string, attractionName: string) {
  const attractionKey = key(attractionName);
  const alias = aliases[parkSlug]?.[attractionKey];
  const path = images[parkSlug]?.[alias ? key(alias) : attractionKey];
  return path ? `${SITE}${path}` : null;
}
