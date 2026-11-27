import type { GuideContent } from "./types.js";

export const HOTEL_GUIDES: GuideContent[] = [
  {
    slug: "universal-orlando-hotels-compared",
    title: "Universal Orlando's eleven hotels compared",
    summary:
      "The three hotel categories, which hotels include Express Unlimited, how each one gets you to the parks, and who each is best for.",
    category: "hotels",
    published: "2026-11-09",
    updated: "2026-11-09",
    takeaways: [
      "Universal Orlando has eleven on-site hotels in three categories: Signature Collection, Prime Value, and Value Inns and Suites.",
      "Only three include Express Unlimited: Loews Portofino Bay, Hard Rock Hotel and Loews Royal Pacific. Sapphire Falls and Helios Grand are Signature Collection hotels without it.",
      "Every on-site hotel gets Early Park Admission and free transportation to the parks.",
      "Location now splits the resort in two: eight hotels sit near the original parks and three sit beside Epic Universe.",
    ],
    live: "hotel-lows",
    sections: [
      {
        heading: "Three categories, and one perk that does not follow them",
        paragraphs: [
          "Universal groups its eleven on-site hotels into three categories. The Signature Collection is the full-service tier, with table-service restaurants, larger pools and the highest rates. Prime Value hotels are mid-priced with food courts, big pools and themed design. Value Inns and Suites are the least expensive and sit slightly apart from the main resort.",
          "Older articles describe four tiers called Premier, Preferred, Prime Value and Value. Universal retired those names when Epic Universe opened and folded Premier and Preferred into the Signature Collection. That renaming created the single most expensive misunderstanding in Universal trip planning: Signature Collection does not mean Express Pass is included.",
          "Free Universal Express Unlimited comes with three hotels only, the three that used to be called Premier. Loews Sapphire Falls and Universal Helios Grand carry Signature Collection prices and do not include it. Hotel pages on RateCoaster show an Express badge only on the three that do.",
        ],
        table: {
          caption: "Universal Orlando on-site hotels",
          head: ["Hotel", "Category", "Rooms", "Express Unlimited included", "Nearest park"],
          rows: [
            ["Loews Portofino Bay Hotel", "Signature Collection", "750", "Yes", "Universal Studios Florida"],
            ["Hard Rock Hotel", "Signature Collection", "650", "Yes", "Universal Studios Florida"],
            ["Loews Royal Pacific Resort", "Signature Collection", "1,000", "Yes", "Islands of Adventure"],
            ["Loews Sapphire Falls Resort", "Signature Collection", "1,000", "No", "Islands of Adventure"],
            ["Universal Helios Grand Hotel", "Signature Collection", "500", "No", "Epic Universe"],
            ["Universal Cabana Bay Beach Resort", "Prime Value", "2,200", "No", "Volcano Bay"],
            ["Universal Aventura Hotel", "Prime Value", "600", "No", "Volcano Bay"],
            ["Universal Stella Nova Resort", "Prime Value", "750", "No", "Epic Universe"],
            ["Universal Terra Luna Resort", "Prime Value", "750", "No", "Epic Universe"],
            ["Endless Summer Resort: Surfside", "Value", "750", "No", "Shuttle to all"],
            ["Endless Summer Resort: Dockside", "Value", "2,050", "No", "Shuttle to all"],
          ],
        },
      },
      {
        heading: "What every on-site hotel includes",
        paragraphs: [
          "Some benefits come with all eleven hotels regardless of price, and they are the reason an on-site Value room can be a better buy than a cheaper room down the road.",
        ],
        bullets: [
          "Early Park Admission: entry to a designated park up to one hour before it opens to the public, every day of the stay including check-in and check-out days. Valid admission is still required.",
          "Free transportation to the parks and CityWalk by shuttle bus, water taxi or walking path, depending on the hotel.",
          "The ability to charge in-park purchases to the room and have merchandise delivered to the hotel.",
        ],
        after: [
          "The parks and attractions offered for early entry change by season, and Universal publishes the current schedule. The [Early Park Admission guide](/guides/early-park-admission-explained) covers how to use the hour well.",
        ],
      },
      {
        heading: "The three Express hotels",
        paragraphs: [
          "Loews Portofino Bay, Hard Rock Hotel and Loews Royal Pacific give every registered guest Universal Express Unlimited at Universal Studios Florida and Islands of Adventure for the whole stay, check-in and check-out days included. One night therefore covers two park days. The benefit does not extend to Epic Universe or Volcano Bay.",
          "Hard Rock is the shortest walk to Universal Studios Florida, and Royal Pacific is the shortest walk to Islands of Adventure. Portofino Bay is the furthest of the three on foot and the quietest, built around a harbour modelled on the Italian village. All three also have water taxis to CityWalk.",
          "These are the most expensive rooms at the resort on most nights. Whether they are the most expensive trip is a separate question, because the alternative is buying Express for each person. That comparison is worked through, with current numbers, in [Express-included hotel or purchased Express Pass?](/guides/premier-hotel-or-express-pass)",
        ],
      },
      {
        heading: "Sapphire Falls and Helios Grand",
        paragraphs: [
          "Loews Sapphire Falls is a Caribbean-themed full-service hotel with a water taxi to CityWalk and a walking path to both original parks. It is usually priced below the three Express hotels, and it suits people who want a resort-style pool and restaurants and do not care about Express.",
          "Universal Helios Grand is the newest and most distinctive hotel on property. It stands inside the Epic Universe site and has its own entrance into the park, so the walk from lobby to park is a few minutes. It does not include Express for Epic Universe or for any other park. Guests reach the original parks by shuttle bus. It is the right choice for a trip built around Epic Universe and a weak choice for a trip built around the older parks.",
        ],
      },
      {
        heading: "The Prime Value hotels",
        paragraphs: [
          "Cabana Bay Beach Resort is the largest hotel at the resort and the one most families end up comparing everything else against. It has a 1950s beach-motel theme, two large pool areas, a bowling alley, standard rooms and family suites with a kitchenette. It has a walking path to Volcano Bay and shuttle buses to CityWalk for the two original parks, with a walking path as an alternative.",
          "Aventura is a modern tower next to Sapphire Falls with a rooftop bar and smaller rooms, better suited to couples than to large families. Stella Nova and Terra Luna are twin 750-room resorts that opened in early 2025 across the road from Epic Universe. They are the least expensive way to stay near Epic. Stella Nova has a dedicated walking path to the park entrance, while most Terra Luna guests take the shuttle bus. Standard rooms at these two sleep four.",
        ],
      },
      {
        heading: "The Value hotels",
        paragraphs: [
          "Endless Summer Resort is two neighbouring hotels, Surfside Inn and Suites and Dockside Inn and Suites, with a surf theme. They are across Interstate 4 from the main resort, so everything is reached by shuttle bus. Rooms are simple and the two-bedroom suites sleep six, which makes them the lowest-cost on-site option for larger families who would otherwise need two rooms.",
          "The trade is time. A shuttle ride each way, plus waiting for the bus at closing, is noticeably slower than walking back from the park to Hard Rock or Royal Pacific. For a family that returns to the room at midday, that difference is felt every day.",
        ],
      },
      {
        heading: "Choosing by the trip you are taking",
        paragraphs: [
          "The hotels sort themselves fairly cleanly once you know which parks matter most and whether you would otherwise buy Express.",
        ],
        bullets: [
          "Mostly Universal Studios Florida and Islands of Adventure, and you want Express: price Portofino Bay, Hard Rock and Royal Pacific against a cheaper room plus purchased Express.",
          "Mostly the original parks, no Express: Cabana Bay, Aventura or Sapphire Falls, depending on budget and how much resort you want.",
          "Mostly Epic Universe: Helios Grand if the budget allows, otherwise Stella Nova or Terra Luna.",
          "Lowest total cost with park perks: Endless Summer, accepting the shuttle.",
          "Five or six people in one unit: a Cabana Bay family suite or an Endless Summer two-bedroom suite.",
        ],
        after: [
          "Then check the dates. The [hotel calendar](/hotels) shows every hotel side by side for a full year, and the gap between categories is not constant. There are weeks when a Signature Collection hotel is unusually close to a Prime Value one, and those are the weeks worth finding.",
        ],
      },
    ],
    faq: [
      {
        question: "Which Universal Orlando hotels include Express Pass?",
        answer:
          "Loews Portofino Bay Hotel, Hard Rock Hotel and Loews Royal Pacific Resort include Universal Express Unlimited for every registered guest, valid at Universal Studios Florida and Islands of Adventure. No hotel includes Express for Epic Universe.",
      },
      {
        question: "Does Helios Grand include Express Pass for Epic Universe?",
        answer:
          "No. Helios Grand has a dedicated entrance into Epic Universe and Early Park Admission, but Express Pass for Epic Universe is always a separate purchase.",
      },
      {
        question: "Is Sapphire Falls a Premier hotel?",
        answer:
          "Universal no longer uses the Premier name. Sapphire Falls is in the Signature Collection, but it does not include Express Unlimited.",
      },
      {
        question: "Do all Universal hotels get Early Park Admission?",
        answer:
          "Yes. All eleven on-site hotels include Early Park Admission to a designated park up to one hour before opening, with valid park admission.",
      },
    ],
    related: ["premier-hotel-or-express-pass", "on-site-vs-off-site-universal-orlando", "early-park-admission-explained"],
  },
  {
    slug: "standard-vs-passholder-hotel-rates",
    title: "Standard versus Annual Passholder hotel rates",
    summary:
      "How passholder (APH) hotel rates work, how to compare them without fooling yourself, and what the tracked discount actually looks like.",
    category: "hotels",
    published: "2026-08-21",
    updated: "2026-11-09",
    takeaways: [
      "An APH rate is a separate rate plan with eligibility rules. Universal sets it per hotel and per night, and can change or withdraw it for any date.",
      "The only fair comparison holds the hotel, night, room type and occupancy constant and changes the rate plan alone.",
      "Where both rates exist, RateCoaster shows the dollar difference per night. Where no APH rate was published, the night is blank and no discount is implied.",
      "The pass, the discounted room and park admission are three different products. An annual pass does not include Epic Universe.",
    ],
    live: "passholder-savings",
    sections: [
      {
        heading: "APH is a rate plan, not a hotel category",
        paragraphs: [
          "An Annual Passholder rate is a booking offer with conditions attached. Universal's booking engine publishes it for some hotels, some dates and some room types, and leaves it out for others. It has nothing to do with the hotel's category, and its presence on one night says nothing about the next.",
          "The discount is not a promise. It is set per hotel and per night, it is released for particular travel windows, and Universal can reduce or withdraw it for any date. A passholder rate you saw last month is not guaranteed to exist today. The table below shows what RateCoaster's tracked rates look like right now: on how many upcoming nights each hotel has a passholder rate below its standard rate, and by how much.",
          "RateCoaster only offers the Annual Passholder filter for a destination or hotel where the booking engine has actually published an APH rate. Hotels without one show a standard-only view, so an empty passholder column never looks like broken data or a hidden deal.",
        ],
      },
      {
        heading: "Compare the same stay",
        paragraphs: [
          "The clean comparison holds five things still: the hotel, the stay date, the number of nights, the occupancy and the room type. Then it changes the rate plan and nothing else.",
          "The overview grid on the [hotels page](/hotels) shows the least expensive available room for each plan, and those are not always the same room. If the cheapest standard room has sold out and the cheapest remaining passholder room is a larger one, the two prices are answering different questions. The grid is for finding candidate dates. The comparison itself belongs on the hotel page.",
        ],
        bullets: [
          "Open the hotel's page and choose a room type from the filter.",
          "Switch between Standard and Annual Passholder with that room pinned.",
          "Read the \"You save\" column, which appears only when the matching standard rate exists for the same night.",
          "Click a date to see the price history for that exact night and plan.",
        ],
      },
      {
        heading: "How a false discount is kept out",
        paragraphs: [
          "The worst error a price tracker can make with passholder rates is to store a discount that does not exist, because people act on it. Universal selects the passholder rate through the booking link, and marks the result with a strike-through public price and an Annual Passholder discount label. RateCoaster's collector looks for both markers on every passholder reading. If either is missing, the reading is thrown away and counted as a rejection, not saved as a rate.",
          "A second trap is stay averaging. For a multi-night search, Universal's room cards show an average across the stay, not the price of each night. RateCoaster queries one night at a time so that the number in each cell is that night's rate and nothing else.",
        ],
      },
      {
        heading: "Eligibility, and what the pass does not cover",
        paragraphs: [
          "Booking a passholder rate means a valid annual pass is expected at check-in, and the name on the reservation generally needs to match a passholder. Read the terms shown at checkout, because a rate that is cancelled at the front desk is not a saving.",
          "It also helps to keep three products apart in your head. The pass is admission to Universal Studios Florida and Islands of Adventure, with blockout dates on the lower tiers. The APH hotel rate is a room discount that the pass makes you eligible for. Park admission to Epic Universe is neither: as of late 2026 no annual pass tier includes it, and passholders buy Epic Universe as a separate dated ticket, with a passholder discount on one-day tickets once the pass has been activated at a park gate.",
          "This is why the [trip planner](/plan) treats a passholder trip differently. When the hotel search uses an APH rate, it assumes admission to the two original parks is already covered and adds only the separately ticketed Epic Universe day if you ask for one.",
        ],
      },
      {
        heading: "When the passholder rate is and is not the story",
        paragraphs: [
          "A passholder rate is one lever among several. Moving a stay from a Friday to a Tuesday, or from a peak week to a shoulder week, also changes the nightly rate, and the two effects stack: the passholder rate on a cheap night is lower again. The [cheapest time to visit](/guides/cheapest-time-to-visit-universal-orlando) guide shows the month-by-month picture from tracked rates.",
          "The discount matters most in two situations. One is a repeat visitor who already holds a pass and simply needs to know which nights to book. The other is a family doing the sum of whether buying one pass pays for itself through the room discount alone, which is covered in [Is an annual pass worth it for the hotel discount?](/guides/universal-annual-pass-hotel-discount-math)",
        ],
      },
    ],
    faq: [
      {
        question: "What does APH mean on Universal hotel rates?",
        answer:
          "APH stands for Annual Passholder. It is a discounted rate plan that Universal Orlando's on-site hotels offer to passholders on selected dates and room types.",
      },
      {
        question: "Is the passholder hotel discount always available?",
        answer:
          "It is published per hotel, per night and per room type, and Universal can withdraw it for any date. The table on this page shows how many tracked nights currently have one at each hotel.",
      },
      {
        question: "Does every guest in the room need an annual pass?",
        answer:
          "The rate is tied to a passholder on the reservation. Check the terms at checkout for the current requirement, since the hotel can ask to see the pass at check-in.",
      },
    ],
    related: ["universal-annual-pass-hotel-discount-math", "how-ratecoaster-compares-prices", "universal-orlando-hotels-compared"],
  },
  {
    slug: "universal-annual-pass-hotel-discount-math",
    title: "Is a Universal annual pass worth it for the hotel discount alone?",
    summary:
      "How to work out whether one pass pays for itself through passholder room rates, using tracked nightly savings instead of the advertised maximum.",
    category: "hotels",
    published: "2026-11-09",
    updated: "2026-11-09",
    takeaways: [
      "The break-even is simple: the price of one pass against the room savings across your nights, plus the admission that person no longer needs to buy.",
      "Advertised \"up to\" discounts describe the best night at the best hotel. The median tracked saving for your hotel is the number to plan with.",
      "The lowest pass tiers have blockout dates, and the cheapest hotel nights often fall outside them, which helps.",
      "No pass tier includes Epic Universe in 2026, so a trip centred on Epic gets less from a pass.",
    ],
    live: "passholder-savings",
    sections: [
      {
        heading: "The idea",
        paragraphs: [
          "Universal Orlando sells four annual pass tiers: Seasonal, Power, Preferred and Premier. Any of them makes the holder eligible for Annual Passholder hotel rates when those rates are offered. Only one person on the reservation needs the pass for the room rate to apply, although everyone still needs park admission.",
          "That creates a well-known planning move. One adult buys the cheapest pass that covers the travel dates. That pass replaces the multi-day ticket the adult would have bought anyway, and it unlocks the passholder rate on the room for the whole party. If the room savings plus the avoided ticket exceed the price of the pass, the pass was free, and it remains valid for a year.",
        ],
      },
      {
        heading: "Doing the sum properly",
        paragraphs: [
          "The calculation has four inputs, and three of them can be read off this site for your exact dates.",
        ],
        bullets: [
          "Room saving per night: on the hotel's page, pin a room type, select Annual Passholder and read the \"You save\" column for each night of the stay.",
          "Number of nights where an APH rate actually exists. A night with no passholder rate contributes nothing.",
          "The ticket the passholder no longer buys: the price of the multi-day ticket for that one person on your dates, from the [ticket calendar](/tickets).",
          "The price of the pass tier that is valid on your dates, from Universal's annual pass page.",
        ],
        after: [
          "Pass pays for itself when (room saving per night times nights) plus (avoided ticket) is greater than (pass price). Remember that the room saving is before tax, so the real saving is about 12.5% larger than the sum of the nightly differences.",
          "The dollar saving scales with the room rate and the number of nights. It is smallest for a short stay at a Value hotel and largest for a long stay at a Signature Collection hotel, so the same pass can be an easy win for one trip and a poor buy for another. The table on this page shows the current median saving per night at each hotel.",
        ],
      },
      {
        heading: "Why the advertised maximum misleads",
        paragraphs: [
          "Passholder hotel offers are advertised as savings of \"up to\" a percentage. That figure is the deepest discount on any night at any participating hotel during the offer window. It is real, and it is not what a typical night looks like.",
          "The box on this page shows what RateCoaster's tracked rates say right now: for each hotel, on how many upcoming nights a passholder rate is below the standard rate, the median saving on those nights, and the range that the middle half of nights fall in. The median is the planning number. Then check your own nights on the hotel's page, because the figure that matters is the saving on the room you would book on the dates you are going.",
          "Offers are also released for set travel windows and can be changed. A saving that exists when you plan is not locked in until the room is booked, which is one more reason to book a refundable rate once the sum works.",
        ],
      },
      {
        heading: "Blockout dates and tier choice",
        paragraphs: [
          "The Seasonal and Power passes have blockout dates when the pass is not valid for park entry. Blockouts concentrate around holidays and the busiest summer weeks. If your trip falls inside a blockout, the cheap pass does not replace a ticket on those days and the sum changes.",
          "The helpful coincidence is that blockout dates and expensive hotel dates overlap heavily. A trip planned for low-rate weeks is usually also outside the lower tiers' blockouts. Check the current blockout calendar for the tier before buying, because it is published a year ahead and does shift.",
          "The upper tiers add benefits that can matter to the sum. Preferred and Premier passholders get free regular self-parking at the main garages after the first visit, and the Power pass gets half-price parking, which is worth real money to anyone staying off site. Those parking benefits do not apply to hotel parking.",
        ],
      },
      {
        heading: "Where Epic Universe changes the answer",
        paragraphs: [
          "Annual passes cover Universal Studios Florida and Islands of Adventure. As of late 2026 none of the four tiers includes Epic Universe. Passholders can buy a discounted one-day Epic Universe ticket, and a newly bought pass has to be activated at a park gate before that discounted ticket can be purchased online.",
          "For a trip that splits time evenly between the original parks and Epic, the pass still replaces the admission for the original parks and the passholder buys Epic days separately. For a trip that is mostly Epic Universe, the pass replaces very little admission, and the case rests on the room discount alone. In that situation a three-day or longer ticket, which includes Epic on more than one day in 2026, is often the better buy for everyone in the party.",
        ],
      },
      {
        heading: "Who should and should not do this",
        paragraphs: [
          "The move works best for parties staying four or more nights at a Prime Value or Signature Collection hotel, on dates outside the school holidays, who mainly want the two original parks. It works less well for short stays, Value hotel stays, holiday-week trips and Epic-first trips.",
          "It is also worth being realistic about the second visit. A pass that paid for itself on trip one is a free option on trip two, and that is where most of the long-run value is. If a return within twelve months is unlikely, judge the pass on this trip's numbers only.",
        ],
      },
    ],
    faq: [
      {
        question: "Do all guests in the room need an annual pass to get the passholder hotel rate?",
        answer:
          "The rate is tied to a passholder on the reservation. Everyone still needs their own park admission. Check the current terms at checkout.",
      },
      {
        question: "Does the Universal Orlando annual pass include Epic Universe?",
        answer:
          "Not as of late 2026. Passholders can buy discounted one-day Epic Universe tickets after activating their pass at a park gate.",
      },
      {
        question: "Which Universal annual pass is cheapest?",
        answer:
          "The Seasonal Pass is the entry tier and has the most blockout dates. Power, Preferred and Premier have progressively fewer restrictions and more benefits.",
      },
    ],
    related: ["standard-vs-passholder-hotel-rates", "understanding-universal-ticket-pricing", "universal-orlando-hotels-compared"],
  },
  {
    slug: "on-site-vs-off-site-universal-orlando",
    title: "On-site or off-site: where to stay for Universal Orlando",
    summary:
      "What an on-site room buys beyond the bed, how to put a dollar value on it, and the cases where staying off site is the better call.",
    category: "hotels",
    published: "2026-11-09",
    updated: "2026-11-09",
    takeaways: [
      "On-site rooms come with Early Park Admission and free transport, and three hotels add Express Unlimited. Off-site rooms come with none of these.",
      "Add daily parking at the main garages to any off-site comparison if you plan to drive in.",
      "Off site wins on space per dollar, on kitchen facilities, and on trips that split time with Disney or other attractions.",
      "The cheapest on-site hotels are often closer to nearby off-site prices than people expect, especially midweek.",
    ],
    sections: [
      {
        heading: "What an on-site room includes",
        paragraphs: [
          "The room rate at any of Universal's eleven hotels buys three things besides the room. The first is Early Park Admission, which lets you into a designated park up to an hour before the public on every day of the stay. The second is free transport to the parks by bus, boat or footpath, which removes the daily parking charge at the garages. The third, at three hotels only, is Universal Express Unlimited for every registered guest at Universal Studios Florida and Islands of Adventure.",
          "None of these come with an off-site hotel, however close it is. A handful of nearby partner hotels offer their own shuttle to CityWalk, and some vacation packages sold by Universal add Early Park Admission to a partner-hotel stay, but a room booked on its own at a partner hotel does not include it.",
        ],
      },
      {
        heading: "Putting a number on the perks",
        paragraphs: [
          "A fair comparison converts the perks into dollars for your own trip and adds them to the off-site price.",
        ],
        bullets: [
          "Parking: regular self-parking at the main garages is charged per vehicle per day. Multiply by park days. On-site guests who do not rent a car avoid both this and the rental.",
          "Early entry: harder to price, but concrete. An hour before opening is typically enough for one or two headline rides with a short wait. On a busy day that hour can replace two or three hours of afternoon queueing.",
          "Express Unlimited: at the three hotels that include it, value it at what you would otherwise have paid for Express for each person, each day, from the [Express calendar](/express-pass). If you would not have bought Express, value it at zero.",
          "Time: a walk or boat from an on-site hotel against a drive, a garage, and a walk through CityWalk. For a party that goes back to the room at midday, double it.",
        ],
        after: [
          "Then look at the actual rates. The [hotel calendar](/hotels) shows the least expensive room at each on-site hotel for every night of the next year. On many midweek nights outside the holidays, Endless Summer and Cabana Bay are within a modest margin of ordinary chain hotels on International Drive once parking is added to the off-site side.",
        ],
      },
      {
        heading: "When off site is the better choice",
        paragraphs: [
          "Staying on site is not automatically right, and the perks only count if you use them.",
        ],
        bullets: [
          "Large groups. A rented house or a two-bedroom condo gives far more space per dollar than hotel rooms, with a kitchen and laundry.",
          "Split trips. If half the days are at Walt Disney World, SeaWorld or the coast, a central off-site base saves driving on the non-Universal days.",
          "Peak holiday weeks. On-site rates rise sharply at Christmas, Easter and Thanksgiving. Off-site rates rise too, but the gap usually widens.",
          "Late risers. Early Park Admission is worth nothing to a party that will not be at the gate before opening.",
          "Loyalty points. A stay covered by hotel points changes the sum entirely.",
        ],
      },
      {
        heading: "When on site is clearly better",
        paragraphs: [
          "The case for on site is strongest in three situations. The first is a short trip, where every hour matters and early entry plus a short walk are a large share of the usable time. The second is a party that would buy Express anyway, where an Express-included hotel can cost less than an off-site room plus passes. The third is a family with young children who need a midday break, where the round trip decides whether the break happens at all.",
          "Epic Universe adds a fourth. Helios Grand, Stella Nova and Terra Luna sit beside the park. There are far fewer off-site hotels within an easy distance of Epic than there are around the original parks, so the on-site advantage there is larger.",
        ],
      },
      {
        heading: "A reasonable way to decide",
        paragraphs: [
          "Price the on-site option first, because it is the one with moving parts. Use the hotel calendar to find the cheapest on-site hotel you would accept on your dates, and note whether it includes Express. Then find the off-site alternative, add parking for each park day, and add the Express you would buy. Compare the two totals, and let the time saved break a near tie.",
          "If you are comparing off-site hotels, the on-site grid is still useful as a benchmark. A nearby hotel that costs more than Cabana Bay on the same night needs a good reason.",
        ],
      },
    ],
    faq: [
      {
        question: "Do off-site hotels get Early Park Admission at Universal Orlando?",
        answer:
          "Not from the room alone. Early Park Admission comes with Universal's eleven on-site hotels. Some Universal vacation packages add it to a partner-hotel stay, so check what a package includes.",
      },
      {
        question: "Is it cheaper to stay off site at Universal Orlando?",
        answer:
          "Often on the room rate, less often on the whole trip. Add daily parking and any Express Pass you would buy before comparing.",
      },
      {
        question: "Can you walk to Universal Orlando from on-site hotels?",
        answer:
          "From most of them. The hotels around the original parks have walking paths to CityWalk, and Helios Grand has its own entrance to Epic Universe. Endless Summer guests use shuttle buses.",
      },
    ],
    related: ["universal-orlando-hotels-compared", "premier-hotel-or-express-pass", "universal-trip-budget-checklist"],
  },
];
