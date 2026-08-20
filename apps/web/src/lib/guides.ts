export interface GuideSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface Guide {
  slug: string;
  title: string;
  summary: string;
  readTime: string;
  sections: GuideSection[];
}

export const GUIDES: Guide[] = [
  {
    slug: "how-ratecoaster-compares-prices",
    title: "How RateCoaster compares Universal prices",
    summary: "What the calendars measure, why prices can move, and how to read a genuine deal.",
    readTime: "5 min read",
    sections: [
      {
        heading: "An observed price, not a guaranteed quote",
        paragraphs: [
          "RateCoaster records prices published for specific dates, products, occupancies, room types, and rate plans. The amount in a calendar is a snapshot of what the source exposed when it was checked; it is not inventory held for the visitor.",
          "That distinction matters because hotel and admission inventory can change between collection and checkout. The useful signal is the comparison across dates and over time. The final purchase decision should always use the price and terms displayed by the official seller at checkout.",
        ],
      },
      {
        heading: "Keeping unlike prices apart",
        paragraphs: [
          "Standard and Annual Passholder hotel rates are stored as separate rate plans. Room types are also retained separately, because comparing a standard room with a suite can make a discount look larger than it really is.",
          "The hotel overview uses the least-expensive available room for each property and night. A hotel page lets you select a room type when you need a like-for-like comparison.",
        ],
      },
      {
        heading: "What makes a deal stand out",
        paragraphs: [
          "A low price in one hotel category is not automatically a strong value in another. RateCoaster compares each hotel against its own collected history and keeps category context visible, so a Premier hotel is not judged against a Value resort on raw nightly price alone.",
        ],
        bullets: [
          "Use the full-year calendar to find naturally cheaper travel dates.",
          "Use price history to see whether the current amount recently rose or fell.",
          "For APH rates, compare the same room type with the corresponding Standard rate.",
          "Confirm taxes, fees, occupancy rules, and cancellation terms before booking.",
        ],
      },
    ],
  },
  {
    slug: "standard-vs-passholder-hotel-rates",
    title: "Standard versus Annual Passholder hotel rates",
    summary: "How to compare APH offers without mistaking a different room or unavailable rate for a discount.",
    readTime: "4 min read",
    sections: [
      {
        heading: "APH is a rate plan, not a hotel category",
        paragraphs: [
          "An Annual Passholder rate is a booking offer with eligibility conditions. It can appear for some hotels, dates, and room types while being absent for others. Its availability is separate from the hotel tier and does not mean every room at that hotel is discounted.",
          "RateCoaster only shows the APH filter where that destination or property has actually published an APH rate. Hotels without one keep a Standard-only view so an empty passholder filter does not imply broken data.",
        ],
      },
      {
        heading: "Compare the same stay",
        paragraphs: [
          "The clean comparison holds the hotel, stay date, occupancy, number of nights, and room type constant. If the Standard room disappears but a larger APH room remains, the two prices no longer answer the same question.",
          "On a hotel page, choose a room type first and then switch rate plans. If the matching Standard rate exists, RateCoaster displays the dollar savings alongside the APH amount.",
        ],
      },
      {
        heading: "Plan around eligibility",
        paragraphs: [
          "A passholder should still read the seller's current eligibility and check-in requirements. The pass itself, the discounted hotel rate, and park admission are different products. The trip planner therefore treats APH hotel pricing separately and, when applicable, only adds separately ticketed Epic Universe admission instead of a general Park-to-Park ticket.",
        ],
      },
    ],
  },
  {
    slug: "premier-hotel-or-express-pass",
    title: "Premier hotel or purchased Express Pass?",
    summary: "A practical way to compare the room premium with the Express benefit for your party.",
    readTime: "5 min read",
    sections: [
      {
        heading: "Compare the whole party, not one price tag",
        paragraphs: [
          "The relevant comparison is the total difference between a complete Premier stay and the hotel you would otherwise book, versus the Express products your party would otherwise purchase. A $150 nightly room difference can have a different meaning for two people than for a family using the included benefit.",
          "Use the hotel calendar for the exact stay dates, then use the Express calendar for the matching park, duration, and pass type. Avoid comparing a multi-day whole-pass total with a single-day per-person amount.",
        ],
      },
      {
        heading: "Check where the benefit applies",
        paragraphs: [
          "A hotel badge is a planning signal, not a substitute for current benefit terms. Participating attractions, parks, hotel guests, and valid dates can change. Admission is separate, and a benefit tied to one set of parks should not be valued as though it covers every destination product.",
        ],
      },
      {
        heading: "A useful decision sequence",
        paragraphs: [
          "First find the least-expensive complete stay you would happily book. Then price the relevant Express option for every guest who needs it. Finally compare that combined alternative with the best complete Premier stay, including taxes and room requirements where available.",
        ],
        bullets: [
          "Keep the same trip dates and party size.",
          "Use whole-pass totals for multi-day Express products.",
          "Do not assign value to a perk your itinerary will not use.",
          "Confirm the current hotel-benefit rules before purchase.",
        ],
      },
    ],
  },
  {
    slug: "understanding-universal-ticket-pricing",
    title: "Understanding Universal ticket pricing by date",
    summary: "Why the same ticket changes price and how to match ticket duration to a trip.",
    readTime: "4 min read",
    sections: [
      {
        heading: "Product and start date both matter",
        paragraphs: [
          "A ticket name describes the duration and park access, while the calendar date determines which published price applies. Two products on the same day are not interchangeable, and the same product can cost more on a higher-demand start date.",
          "RateCoaster keeps adult and child prices separate and shows multi-day products as a whole-ticket total with a per-day reference. That prevents a low per-day number from being mistaken for the amount due for the complete ticket.",
        ],
      },
      {
        heading: "Fit the ticket to the itinerary",
        paragraphs: [
          "The trip planner counts the visit duration and looks for the closest tracked ticket length that does not exceed it, then favors broader park access before comparing price. If no exact duration exists, it says how many trip days are not covered instead of presenting a partial match as complete.",
          "Travel days are not always park days, so treat the recommendation as a starting point. A shorter product may be intentional when arrival, departure, pool, or rest days are already planned.",
        ],
      },
      {
        heading: "Passholder trips need a different assumption",
        paragraphs: [
          "When the hotel search uses an Annual Passholder rate, the planner does not attach a normal multi-park ticket. It assumes eligible admission is already covered and only considers the currently separate Epic Universe admission product. Verify what your particular pass includes for your travel dates.",
        ],
      },
    ],
  },
  {
    slug: "choosing-dates-with-prices-and-waits",
    title: "Choosing trip dates with prices and wait times",
    summary: "Use hotel, ticket, Express, and live wait signals together instead of optimizing one in isolation.",
    readTime: "5 min read",
    sections: [
      {
        heading: "Start with the calendar, not a single deal",
        paragraphs: [
          "One inexpensive hotel night does not make an inexpensive trip. Look for a run of nights where the same room remains available, then check the ticket start date and any Express product you expect to purchase.",
          "The trip planner requires a complete same-room hotel stay. That is stricter—and more useful—than adding the cheapest isolated room from each night when no single room type is actually bookable for the whole visit.",
        ],
      },
      {
        heading: "Use waits as context",
        paragraphs: [
          "Live waits describe what is happening now, not a promise about a future date. They help visitors understand park conditions and can reveal how differently parks behave on the same day, but they should be combined with season, operating hours, events, and the traveler's priorities.",
          "RateCoaster's park averages include operating attractions with a posted wait and exclude closed or unavailable rides. A park-wide average can summarize conditions, while the attraction list shows whether a few headliners are driving it.",
        ],
      },
      {
        heading: "Optimize the cost that matters to you",
        paragraphs: [
          "Families with fixed school dates may get more value from changing hotel tier or ticket duration than shifting the trip. Flexible travelers can scan the full year for lower hotel and ticket combinations first, then decide whether the expected experience is worth adding Express.",
        ],
        bullets: [
          "Find complete hotel availability for the whole stay.",
          "Check the ticket price on the intended first park day.",
          "Price Express only for the parks and days where it would be used.",
          "Save the trip and watch the dates if you are not ready to book.",
        ],
      },
    ],
  },
];

export function guideBySlug(slug: string): Guide | undefined {
  return GUIDES.find((guide) => guide.slug === slug);
}
