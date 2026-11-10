/**
 * Editorial profiles for each tracked hotel, keyed by property slug.
 *
 * The rate table on a hotel page answers "what does it cost?". This answers the
 * questions that come before it — what the hotel is, who it suits, how you get
 * to the parks from it — which is what makes the page worth landing on for
 * someone who has not chosen a hotel yet.
 *
 * Perks and transport are set by Universal and change. Keep `reviewed` honest:
 * it is printed on the page.
 */
export interface HotelProfile {
  /** One or two sentences shown under the page title. */
  summary: string;
  category: string;
  opened: string;
  parks: string;
  transport: string;
  overview: string[];
  bestFor: string[];
  gettingAround: string;
  goodToKnow: string[];
  /** Guide slugs to link from the profile. */
  guides: string[];
  reviewed: string;
}

const REVIEWED = "2026-11-09";

export const HOTEL_PROFILES: Record<string, HotelProfile> = {
  "portofino-bay": {
    summary:
      "The quietest and most resort-like of the three hotels that include Universal Express Unlimited, built around a harbour modelled on the Italian village of Portofino.",
    category: "Signature Collection",
    opened: "1999",
    parks: "Universal Studios Florida and Islands of Adventure",
    transport: "Water taxi or walking path to CityWalk",
    overview: [
      "Loews Portofino Bay Hotel was the first hotel to open at Universal Orlando and remains its most traditional luxury property. Its 750 rooms are arranged around a harbour with a piazza, waterside restaurants and nightly live music, and it has three separate pool areas and a full-service spa. The mood is calmer and more adult than at its neighbours.",
      "The headline benefit is Universal Express Unlimited for every registered guest at Universal Studios Florida and Islands of Adventure, valid from check-in day through check-out day. That perk is the reason to compare this hotel's rate with the cost of a cheaper room plus purchased Express, not with the cheaper room alone.",
    ],
    bestFor: [
      "Couples and adults who want a resort stay as much as a park trip.",
      "Families who would otherwise buy Express for three or more people.",
      "Anyone who values a quiet walk back at the end of the day over the shortest one.",
    ],
    gettingAround:
      "Water taxis run from the harbour to CityWalk, where both original parks have their entrances, and a landscaped walking path covers the same route in roughly fifteen to twenty minutes. Portofino Bay is the furthest of the three Express hotels on foot. Epic Universe is reached by shuttle bus.",
    goodToKnow: [
      "Express Unlimited does not cover Epic Universe, Volcano Bay or Hagrid's Magical Creatures Motorbike Adventure.",
      "Themed kids' suites with a separate children's room are available.",
      "It is frequently the highest-priced hotel at the resort, so the gap to Royal Pacific and Hard Rock is worth checking for your dates.",
    ],
    guides: ["premier-hotel-or-express-pass", "universal-orlando-hotels-compared"],
    reviewed: REVIEWED,
  },
  "hard-rock-hotel": {
    summary:
      "The closest hotel to Universal Studios Florida, with Universal Express Unlimited included and the liveliest pool at the resort.",
    category: "Signature Collection",
    opened: "2001",
    parks: "Universal Studios Florida and Islands of Adventure",
    transport: "Short walk or water taxi to CityWalk",
    overview: [
      "Hard Rock Hotel is a 650-room hotel decorated with music memorabilia, in the style of a California mission-revival mansion. It is the smallest of the three Express hotels and the most energetic, with a large pool that has a sand beach, a waterslide and music played underwater, and a calendar of live music events.",
      "Every registered guest receives Universal Express Unlimited at Universal Studios Florida and Islands of Adventure for the whole stay, including the days of arrival and departure. Combined with the shortest walk to a park gate of any hotel here, that makes it the strongest choice for a short, ride-focused trip.",
    ],
    bestFor: [
      "One- and two-night stays built around the two original parks.",
      "Families with children who will want a midday break and a quick return.",
      "Guests who want a lively pool and do not mind some noise.",
    ],
    gettingAround:
      "The entrance to Universal Studios Florida is about a five-minute walk along a garden path, and Islands of Adventure is a few minutes further through CityWalk. Water taxis also run to CityWalk. Epic Universe is reached by shuttle bus.",
    goodToKnow: [
      "One night covers two park days of Express, because the benefit runs through check-out day.",
      "With only 650 rooms it sells out earlier than its neighbours on holiday weeks.",
      "Express Unlimited does not cover Epic Universe, Volcano Bay or Hagrid's Magical Creatures Motorbike Adventure.",
    ],
    guides: ["premier-hotel-or-express-pass", "universal-express-pass-worth-it"],
    reviewed: REVIEWED,
  },
  "royal-pacific": {
    summary:
      "Usually the least expensive way to get Universal Express Unlimited with a room, and the closest hotel to Islands of Adventure.",
    category: "Signature Collection",
    opened: "2002",
    parks: "Islands of Adventure and Universal Studios Florida",
    transport: "Short walk or water taxi to CityWalk",
    overview: [
      "Loews Royal Pacific Resort is a 1,000-room hotel with a South Pacific theme: bamboo, orchids, a lagoon-style pool with a sand beach and a weekly luau. It is the largest of the three Express hotels and has substantial convention space, which shapes its pricing. Midweek rates can rise when a conference is in the building and soften when one is not.",
      "Like Portofino Bay and Hard Rock, it includes Universal Express Unlimited for every registered guest at the two original parks. On most nights it is priced below the other two, which makes it the first hotel to check when working out whether an Express-included room beats buying passes.",
    ],
    bestFor: [
      "Families who want Express included at the lowest room rate that offers it.",
      "Trips centred on Islands of Adventure.",
      "A split stay: one night here for two Express days, then a cheaper hotel.",
    ],
    gettingAround:
      "A walking path leads to the Islands of Adventure side of CityWalk in about five to ten minutes, and water taxis make the same trip. Universal Studios Florida is a short walk further. Epic Universe is reached by shuttle bus.",
    goodToKnow: [
      "Conference demand can make weekday rates behave differently from the other hotels. The history chart for a date shows whether its rate has been moving.",
      "Themed kids' suites are available.",
      "Express Unlimited does not cover Epic Universe, Volcano Bay or Hagrid's Magical Creatures Motorbike Adventure.",
    ],
    guides: ["premier-hotel-or-express-pass", "universal-orlando-hotels-compared"],
    reviewed: REVIEWED,
  },
  "sapphire-falls": {
    summary:
      "A full-service Caribbean-themed resort with a water taxi to the parks, priced below the Express hotels because Express Pass is not included.",
    category: "Signature Collection",
    opened: "2016",
    parks: "Islands of Adventure and Universal Studios Florida",
    transport: "Water taxi or walking path to CityWalk",
    overview: [
      "Loews Sapphire Falls Resort has 1,000 rooms set around a lagoon and waterfalls, with one of the largest pools at Universal Orlando, a table-service restaurant and a well-regarded rum bar. It offers the amenities of the top hotels, including a water taxi to CityWalk.",
      "The important thing to know is what it does not include. Universal places Sapphire Falls in its Signature Collection alongside Portofino Bay, Hard Rock and Royal Pacific, but it does not come with Universal Express Unlimited. Older guides call it a Preferred hotel, which was the name of its former category. Its rate should be compared with Royal Pacific's on the same night: when the gap is small, the Express hotel is usually the better buy.",
    ],
    bestFor: [
      "Guests who want a resort pool and restaurants and do not plan to use Express.",
      "Quieter dates, when Express would add little.",
      "Visitors who like a boat ride to the parks at a lower rate than the Express hotels.",
    ],
    gettingAround:
      "Water taxis run to CityWalk, and a walking path reaches the parks in about fifteen minutes. Volcano Bay is a short shuttle ride away when the water park is open. Epic Universe is reached by shuttle bus.",
    goodToKnow: [
      "No Express Pass of any kind is included.",
      "Early Park Admission is included, as at every on-site hotel.",
      "Check the nightly difference to Royal Pacific before booking. It varies a great deal by date.",
    ],
    guides: ["universal-orlando-hotels-compared", "premier-hotel-or-express-pass"],
    reviewed: REVIEWED,
  },
  "helios-grand": {
    summary:
      "The hotel inside Epic Universe, with its own entrance into the park. It is the most convenient hotel at the resort for Epic and does not include Express Pass.",
    category: "Signature Collection",
    opened: "2025",
    parks: "Epic Universe",
    transport: "Dedicated hotel entrance into Epic Universe",
    overview: [
      "Universal Helios Grand Hotel opened with Epic Universe in 2025. Its 500 rooms sit at the far end of Celestial Park, inside the park boundary, and hotel guests have a dedicated entrance that puts them in the park within a few minutes of leaving the lobby. Many rooms look out over the park, and there is a rooftop bar with views across it.",
      "It is a Signature Collection hotel with matching prices, but it does not include Express Pass for Epic Universe or for any other park. No hotel does at Epic. What you are paying for is location, the views and the newest rooms at the resort.",
    ],
    bestFor: [
      "Trips where Epic Universe is the main event.",
      "Guests who want to return to the room during the day without a bus.",
      "A special-occasion stay with a park view.",
    ],
    gettingAround:
      "Epic Universe is reached on foot through the hotel's own entrance. Universal Studios Florida, Islands of Adventure and CityWalk are a shuttle bus ride away, so allow for that transfer on days at the original parks.",
    goodToKnow: [
      "With 500 rooms it is the smallest Signature Collection hotel and books up early.",
      "Early Park Admission is included and is especially useful here, given the walk is so short.",
      "If you want Express at Epic Universe, budget for it separately for every person.",
    ],
    guides: ["epic-universe-first-visit", "universal-orlando-hotels-compared"],
    reviewed: REVIEWED,
  },
  "cabana-bay": {
    summary:
      "The largest hotel at Universal Orlando and the usual benchmark for value: retro styling, two big pool areas, family suites that sleep six and a walking path to Volcano Bay.",
    category: "Prime Value",
    opened: "2014",
    parks: "Volcano Bay; Universal Studios Florida and Islands of Adventure by shuttle",
    transport: "Shuttle bus or walking path to CityWalk",
    overview: [
      "Universal Cabana Bay Beach Resort is a 2,200-room hotel styled as a 1950s and 60s Florida beach motel, with period colours, classic cars parked out front and a bowling alley. It has two large pool courtyards, one with a waterslide and one with a lazy river, and a food court instead of table-service restaurants.",
      "Rooms come as standard rooms sleeping four and family suites sleeping six, with a sliding partition and a kitchenette with a microwave and small fridge. The suites are the reason many families choose it: one unit for six people at a mid-range rate, with park perks.",
    ],
    bestFor: [
      "Families of five or six who would otherwise need two rooms.",
      "Longer stays where a kitchenette and space matter.",
      "Anyone who wants on-site benefits at a moderate price.",
    ],
    gettingAround:
      "Shuttle buses run to CityWalk for Universal Studios Florida and Islands of Adventure, and a walking path covers the same trip in around twenty minutes or more. Volcano Bay is next door by a dedicated path, though the water park is closed until spring 2027. Epic Universe is reached by shuttle bus.",
    goodToKnow: [
      "Express Pass is not included.",
      "Rooms in the towers nearest the bus stop and the Volcano Bay path save real time. Ask at check-in.",
      "Family suites sell out first on school holidays. If you need one, book early.",
    ],
    guides: ["universal-orlando-hotels-compared", "universal-orlando-with-young-kids"],
    reviewed: REVIEWED,
  },
  aventura: {
    summary:
      "A modern high-rise with compact rooms, a rooftop bar and a food hall, priced in the middle of the range and best suited to adults and small families.",
    category: "Prime Value",
    opened: "2018",
    parks: "Volcano Bay; Universal Studios Florida and Islands of Adventure by shuttle",
    transport: "Shuttle bus or walking path to CityWalk",
    overview: [
      "Universal Aventura Hotel is a 600-room glass tower between Sapphire Falls and Cabana Bay. It is the most contemporary of the hotels near the original parks, with floor-to-ceiling windows, in-room tablets, a food hall with several counters and a rooftop bar and restaurant with views over the resort.",
      "Rooms are smaller than at Cabana Bay and there is less for children to do at the hotel itself, which is why it tends to suit couples, friends and families with older children. Kids' suites with a separate sleeping area are available for those who want them.",
    ],
    bestFor: [
      "Couples and adult groups who want a modern room at a moderate rate.",
      "Short stays where the room is mainly for sleeping.",
      "Guests who want a view. Upper floors look across the parks.",
    ],
    gettingAround:
      "Shuttle buses run to CityWalk, and a walking path reaches the parks in around fifteen to twenty minutes. Volcano Bay is a short walk when the water park is open. Epic Universe is reached by shuttle bus.",
    goodToKnow: [
      "Express Pass is not included.",
      "It has one pool, which is small next to those at Cabana Bay and Sapphire Falls.",
      "Compare its rate with Cabana Bay on the same night. The two swap places as the cheaper Prime Value hotel.",
    ],
    guides: ["universal-orlando-hotels-compared", "on-site-vs-off-site-universal-orlando"],
    reviewed: REVIEWED,
  },
  "stella-nova": {
    summary:
      "One of two Prime Value resorts across the road from Epic Universe, and among the least expensive ways to stay close to the newest park.",
    category: "Prime Value",
    opened: "2025",
    parks: "Epic Universe",
    transport: "Walking path or shuttle bus to Epic Universe",
    overview: [
      "Universal Stella Nova Resort opened in January 2025 as the first of the Epic Universe hotels. It has 750 rooms and a design inspired by galaxies and deep space, in purples and blues, with a large pool, a food hall and a lobby bar.",
      "Rooms are standard rooms with two queen beds, sleeping up to four. There are no suites for larger parties, so a family of five or six needs two rooms or a different hotel. It is close in every respect to its twin next door, Terra Luna, and the two are usually worth pricing against each other.",
    ],
    bestFor: [
      "Parties of up to four whose trip is centred on Epic Universe.",
      "Guests who want a new hotel near Epic without Helios Grand's rate.",
      "Travellers with a car, since it sits beside the main roads south of the original resort.",
    ],
    gettingAround:
      "A dedicated walking path leads to the Epic Universe entrance in roughly five to ten minutes, and shuttle buses run there as well. Shuttle buses also run to CityWalk for Universal Studios Florida and Islands of Adventure, a longer ride. Plan the bus into your day when visiting the original parks.",
    goodToKnow: [
      "Express Pass is not included, and no hotel includes Express for Epic Universe.",
      "Standard rooms sleep four. Check occupancy before comparing with Cabana Bay's suites.",
      "Compare the nightly rate with Terra Luna next door, which has the same room types. Stella Nova has the easier walk to Epic Universe.",
    ],
    guides: ["epic-universe-first-visit", "universal-orlando-hotels-compared"],
    reviewed: REVIEWED,
  },
  "terra-luna": {
    summary:
      "The twin of Stella Nova: a 750-room Prime Value resort beside Epic Universe with an earth-and-moon theme.",
    category: "Prime Value",
    opened: "2025",
    parks: "Epic Universe",
    transport: "Shuttle bus to Epic Universe",
    overview: [
      "Universal Terra Luna Resort opened in early 2025, a few weeks after Stella Nova and directly beside it. It has the same 750-room layout, the same room types and the same kind of facilities, with a pool, a food hall and a bar. Where Stella Nova's design looks out to the galaxies, Terra Luna's theme is exploration closer to home, in warmer, earthier colours.",
      "In practice the choice between the two comes down to price on your dates, how you plan to reach the park, and which look you prefer. Stella Nova has a direct walking path to Epic Universe. From Terra Luna the walk is longer and less direct, and most guests take the shuttle. Their rates track each other closely but are not identical.",
    ],
    bestFor: [
      "Parties of up to four planning mostly Epic Universe days.",
      "Guests choosing between this and Stella Nova on price.",
      "Shorter stays, where the newer rooms matter more than resort facilities.",
    ],
    gettingAround:
      "Shuttle buses run to Epic Universe and are the practical way to get there. Walking is possible, but the route is longer than from Stella Nova, crosses a busy junction and has little shade. Shuttle buses also run to CityWalk for the two original parks, so allow for the transfer on days away from Epic.",
    goodToKnow: [
      "Express Pass is not included, and no hotel includes Express for Epic Universe.",
      "Standard rooms sleep four.",
      "Early Park Admission is included and regularly applies at Epic Universe.",
    ],
    guides: ["epic-universe-first-visit", "early-park-admission-explained"],
    reviewed: REVIEWED,
  },
  "endless-summer-surfside": {
    summary:
      "The smaller of the two Endless Summer hotels: the lowest rates on Universal property, a surf theme, and suites that sleep six, with every park reached by shuttle.",
    category: "Value Inns and Suites",
    opened: "2019",
    parks: "All parks by shuttle",
    transport: "Shuttle bus to CityWalk and Epic Universe",
    overview: [
      "Universal Endless Summer Resort: Surfside Inn and Suites has 750 rooms and a relaxed beach-town look, with a surfboard-shaped pool and a food court. It is one of two neighbouring Value hotels, and between them they usually hold the lowest nightly rates of any on-site hotel.",
      "About half the rooms are two-bedroom suites that sleep six, with a kitchenette and a small dining area. For a family of five or six, a suite here is often the least expensive way to stay on site in a single unit and still receive Early Park Admission.",
    ],
    bestFor: [
      "Travellers who want on-site perks at the lowest room rate.",
      "Families of five or six on a budget.",
      "Guests who prefer the smaller and quieter of the two Endless Summer hotels.",
    ],
    gettingAround:
      "Endless Summer sits across Interstate 4 from the main resort, so there is no walking route to the parks. Shuttle buses run to CityWalk for the original parks and to Epic Universe. Allow for waiting time, especially at park closing.",
    goodToKnow: [
      "Express Pass is not included.",
      "The shuttle makes midday returns to the room slower than at the walkable hotels.",
      "Compare with Dockside next door. Rates differ by night and the room types are the same.",
    ],
    guides: ["universal-orlando-hotels-compared", "on-site-vs-off-site-universal-orlando"],
    reviewed: REVIEWED,
  },
  "endless-summer-dockside": {
    summary:
      "The larger Endless Summer hotel, with 2,050 rooms, two pools and the same low rates and six-person suites as Surfside next door.",
    category: "Value Inns and Suites",
    opened: "2020",
    parks: "All parks by shuttle",
    transport: "Shuttle bus to CityWalk and Epic Universe",
    overview: [
      "Universal Endless Summer Resort: Dockside Inn and Suites is the bigger of the two Endless Summer hotels, with 2,050 rooms across several buildings, two pools and a large food court. The look is sunset colours and weathered boardwalk, a counterpart to Surfside's surf theme.",
      "Like Surfside, it offers standard rooms and two-bedroom suites sleeping six with a kitchenette. Because it has nearly three times as many rooms, it often has availability, and sometimes lower rates, on dates when Surfside has sold through its cheapest rooms.",
    ],
    bestFor: [
      "Budget-led trips that still want Early Park Admission.",
      "Larger families who need a two-bedroom suite on a busy date.",
      "Late bookers, since its size means it is often the last on-site hotel with rooms.",
    ],
    gettingAround:
      "There is no walking route to the parks from Endless Summer. Shuttle buses run to CityWalk and to Epic Universe. The resort is large, so the walk from some buildings to the bus stop adds a few minutes each way.",
    goodToKnow: [
      "Express Pass is not included.",
      "Ask for a building near the lobby and bus stop if mobility or small children make distance matter.",
      "Check Surfside's rate for the same night before booking.",
    ],
    guides: ["universal-orlando-hotels-compared", "universal-trip-budget-checklist"],
    reviewed: REVIEWED,
  },
  "universal-kids-hotel": {
    summary:
      "The 300-room hotel at the entrance to Universal Kids Resort in Frisco, Texas, with bunk beds in every room and the park a short walk away.",
    category: "On-site resort hotel",
    opened: "2026",
    parks: "Universal Kids Resort",
    transport: "Walk to the park entrance",
    overview: [
      "Universal Kids Resort Hotel opened with the park on July 1, 2026. It stands beside the park entrance and is designed, like the park, around families with young children. Every one of its 300 rooms has bunk beds, and the hotel is themed for young guests throughout.",
      "There are four room types: standard, deluxe and signature queen rooms, and family suites. Signature rooms sleep up to five and family suites up to six. Rates move with demand by date in the same way as Universal's Orlando hotels, and weekends and school holidays cost noticeably more than term-time weeknights.",
    ],
    bestFor: [
      "Two-day visits with children under about seven.",
      "Families travelling from outside the Dallas area.",
      "Anyone who wants to walk back for a nap or a swim in the middle of the day.",
    ],
    gettingAround:
      "The park entrance is a short walk from the hotel. The resort is in Frisco, north of Dallas, and most guests arrive by car. Dallas Fort Worth International and Dallas Love Field are the nearest major airports.",
    goodToKnow: [
      "For a one-day visit by a family that lives nearby, a hotel is not needed at all.",
      "Frisco has many ordinary hotels within a short drive, which are worth comparing on busy dates.",
      "Check Universal Kids Resort's site for current hotel guest benefits, which are still settling in the park's first year.",
    ],
    guides: ["universal-kids-resort-frisco-guide", "universal-orlando-with-young-kids"],
    reviewed: REVIEWED,
  },
};

export function hotelProfile(slug: string): HotelProfile | undefined {
  return Object.hasOwn(HOTEL_PROFILES, slug) ? HOTEL_PROFILES[slug] : undefined;
}
