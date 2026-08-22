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
  {
    slug: "cheapest-time-to-visit-universal-orlando",
    title: "The cheapest time to visit Universal Orlando",
    summary:
      "Which weeks are reliably cheap, which are reliably expensive, and why the gap between them is usually larger than any discount code.",
    readTime: "6 min read",
    sections: [
      {
        heading: "Dates move prices more than discounts do",
        paragraphs: [
          "Universal prices hotels and admission by demand, and the swing across a year is wide. The same room, the same ticket and the same family can cost dramatically different amounts depending only on which week is chosen. That variation is usually larger than any promotion, passholder rate or package deal applied to a fixed set of dates.",
          "This is the single most useful thing to understand before booking. Hunting for a code to shave a few percent off a peak week is effort spent in the wrong place if moving the trip two weeks would save far more.",
        ],
      },
      {
        heading: "The pattern most years follow",
        paragraphs: [
          "Demand tracks school calendars and holidays almost perfectly. The expensive periods are the ones when the largest number of families are simultaneously free to travel, and they are predictable years in advance.",
        ],
        bullets: [
          "Reliably expensive: late December through New Year, spring break, Thanksgiving week, and mid-June to mid-August.",
          "Often cheaper: mid-January through early February, late April to mid-May, and September through early October.",
          "Halloween season raises evening demand at Universal Orlando specifically, which can lift nearby hotel prices even midweek.",
          "Weekends cost more than midweek almost everywhere, and the gap widens in busy seasons.",
        ],
      },
      {
        heading: "Cheap dates and quiet dates are not the same thing",
        paragraphs: [
          "It is tempting to assume the cheapest week is also the emptiest. Often it is, but not always — a low hotel rate can coincide with a busy park if an event is running, and a quiet park can sit inside an expensive week.",
          "The two questions are worth answering separately. Price tells you what the trip costs; wait times tell you what it will feel like. A week that is cheap and busy may still be the right answer for a family on a tight budget, and a week that is dear and quiet may be worth it for a once-in-a-lifetime trip.",
        ],
      },
      {
        heading: "How to use this site to find your week",
        paragraphs: [
          "Rather than guessing at the pattern above, read it off the actual numbers. The hotel calendar shows a full year of nightly rates, the ticket calendar shows admission priced by date, and the wait-time history shows how busy each part of the year tends to be.",
        ],
        bullets: [
          "Open the hotel calendar and scan for the green stretches across the whole year.",
          "Cross-check those dates on the ticket calendar — the two do not always move together.",
          "If your dates are fixed, compare hotel tiers instead; that is the remaining lever.",
          "Confirm the final price with the official seller before booking anything.",
        ],
      },
    ],
  },
  {
    slug: "how-far-ahead-to-book-universal",
    title: "How far ahead should you book Universal?",
    summary:
      "Why booking early and watching prices are not in conflict, and what actually changes as your dates approach.",
    readTime: "5 min read",
    sections: [
      {
        heading: "Book early for choice, watch prices for cost",
        paragraphs: [
          "These are two separate decisions that often get muddled. Booking early secures the room type and hotel you want, which genuinely does get harder as popular dates fill. It does not, on its own, secure the best price.",
          "Most on-site hotel bookings can be changed or cancelled within the terms shown at checkout, which means an early booking is not a commitment to that price — it is a commitment to that room. If the rate falls later, the booking can often be rebooked at the lower one.",
        ],
      },
      {
        heading: "What actually moves as dates approach",
        paragraphs: [
          "Hotel rates respond to how full a property is becoming. A hotel filling faster than expected tends to rise; one filling slowly may soften. Neither is guaranteed, and both directions happen.",
          "Admission pricing behaves differently. Ticket prices for a given date tend to be set well in advance and change less often, so waiting rarely helps much and can hurt if a general price increase lands in between.",
        ],
        bullets: [
          "Hotel rates: genuinely volatile, worth watching after booking.",
          "Tickets: relatively stable per date, but subject to across-the-board increases.",
          "Express Pass: the most volatile of all, and often cheapest well before the date.",
        ],
      },
      {
        heading: "A practical approach",
        paragraphs: [
          "Book the room when you find dates and a hotel that work, on refundable terms if they are offered. Then keep watching that date. If the rate drops meaningfully, rebook. If it rises, you already have the lower one.",
          "This is the entire reason RateCoaster records price history rather than only today's number: without knowing what a rate has been, there is no way to judge whether the one in front of you is good.",
        ],
      },
    ],
  },
  {
    slug: "universal-orlando-with-young-kids",
    title: "Universal Orlando with young children",
    summary:
      "What actually matters when the party includes small children — height limits, hotel choice, and where the money is best spent.",
    readTime: "6 min read",
    sections: [
      {
        heading: "Height limits shape the trip more than anything else",
        paragraphs: [
          "Universal's headline attractions are thrill rides with height requirements, and a family with a child below those limits will experience a very different park than the marketing suggests. Checking the requirements against your children's actual heights, before choosing dates or tickets, prevents the most common disappointment.",
          "Universal publishes current height requirements for every attraction, and they do change as rides open and close. Check them close to your trip rather than relying on an article — including this one.",
        ],
      },
      {
        heading: "Where Express Pass is and isn't worth it",
        paragraphs: [
          "Express Pass skips the standby queue on most attractions. Its value depends on how many of those attractions your family can actually ride. A group that can ride everything gets far more from it than a group spending much of the day on attractions with no queue to skip.",
          "For families with young children, the honest calculation often favours spending that money on an extra day, a better hotel, or simply not spending it. Rider Switch — which lets adults take turns without queueing twice — reduces the pressure further.",
        ],
      },
      {
        heading: "Hotel choice matters more with small children",
        paragraphs: [
          "Proximity is worth more when someone in the party needs a midday nap. A hotel within walking distance of the parks turns a two-hour round trip into a twenty-minute one, and that difference compounds across a week.",
          "The Premier hotels include Express Unlimited for every guest in the room, which can make an expensive room cheaper overall than a budget room plus Express for four people. Whether that maths works depends entirely on your party size and dates.",
        ],
        bullets: [
          "Compare the total: room rate plus Express for your party, against a Premier room.",
          "Weigh walking distance against nightly rate if young children nap.",
          "Check what each hotel actually includes before comparing rates — the perks differ by tier.",
        ],
      },
    ],
  },
  {
    slug: "universal-express-pass-worth-it",
    title: "Is Universal Express Pass worth it?",
    summary:
      "An honest look at when Express Pass pays for itself, when it doesn't, and the cheaper way to get it.",
    readTime: "5 min read",
    sections: [
      {
        heading: "What you are actually buying",
        paragraphs: [
          "Express Pass buys time, not access. Everyone in the park can ride the same attractions; Express holders wait less. So its value is entirely a function of how long the queues would otherwise be, which varies enormously by date.",
          "On a quiet January weekday, when many attractions have short waits anyway, the same Express Pass delivers a fraction of the benefit it does on a busy Saturday in July — while often costing less. That inversion is why buying it reflexively is a mistake in both directions.",
        ],
      },
      {
        heading: "The free route most people miss",
        paragraphs: [
          "Universal Orlando's Premier hotels include Express Unlimited for every guest in the room, for the whole stay, at no extra cost. For a family of four on a busy week, that perk can be worth more than the difference between a Premier room and a cheaper one.",
          "This is the comparison worth doing before buying Express separately: the total cost of a cheaper room plus Express for everyone, against the total cost of a Premier room. It frequently comes out in favour of the Premier hotel, and almost nobody checks.",
        ],
        bullets: [
          "Premier hotels include Express Unlimited for all room guests.",
          "The value scales with party size — the more people, the better the maths.",
          "It applies to the whole stay, including arrival and departure days.",
        ],
      },
      {
        heading: "When buying it separately makes sense",
        paragraphs: [
          "If you are staying off-site, or at a hotel tier that does not include it, buying Express for the single busiest day of the trip is often better value than buying it for every day. Queues are not uniformly long across a week.",
          "Prices for Express vary by date more sharply than any other product Universal sells, so checking the calendar before choosing which day to buy is worth real money.",
        ],
      },
      {
        heading: "Check before you commit",
        paragraphs: [
          "Express Pass availability and terms change, some attractions are excluded, and the perks attached to each hotel tier are set by Universal and can be revised. Confirm the current details on the official site before booking — this guide explains how to think about the decision, not what today's terms are.",
        ],
      },
    ],
  },
];

export function guideBySlug(slug: string): Guide | undefined {
  return GUIDES.find((guide) => guide.slug === slug);
}
