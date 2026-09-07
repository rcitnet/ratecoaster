import images from "./ride-images.json";

const catalog: Record<string, Record<string, string>> = images;

function imageKey(name: string): string {
  return name
    .replace(/[™®©]/g, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

// Provider names occasionally differ from Universal's image folder names.
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

/** Match within a park so similarly named rides never borrow another park's photo. */
export function rideImage(parkSlug: string, attractionName: string): string | null {
  const key = imageKey(attractionName);
  const alias = aliases[parkSlug]?.[key];
  return catalog[parkSlug]?.[alias ? imageKey(alias) : key] ?? null;
}
