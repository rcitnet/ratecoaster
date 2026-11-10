/**
 * The written half of each data page.
 *
 * A price grid with no explanation is a tool; search engines and ad reviewers
 * both read it as a page with nothing to say. More to the point, a first-time
 * visitor does not know what "APH" means or why a cell is green. Each entry
 * here explains what the page shows, how to read it and what it cannot tell
 * you, in the same place as the data.
 *
 * FAQ entries are printed on the page and emitted as FAQ markup together, so
 * the markup can never describe a question the reader cannot see.
 */
export interface Explainer {
  eyebrow: string;
  title: string;
  intro: string[];
  sections: Array<{ heading: string; paragraphs: string[]; bullets?: string[] }>;
  faq: Array<{ question: string; answer: string }>;
  /** Guide slugs offered as further reading. */
  guides: string[];
}

export const EXPLAINERS = {
  hotels: {
    eyebrow: "How to read this page",
    title: "Understanding the hotel rate calendar",
    intro: [
      "The grid above shows one number for each on-site hotel and each night: the least expensive available room for the rate type and party size you have selected, per night, before tax. It covers every night Universal currently has on sale, up to a year ahead, and each hotel is re-checked four times a day.",
      "It is built for one job, which is finding the cheaper nights. Hotel rates at Universal move with demand, and the same room can cost twice as much on a holiday Saturday as on a Tuesday in late January. Scrolling across the year shows where the low stretches are in a way the official booking page, which prices one set of dates at a time, cannot.",
    ],
    sections: [
      {
        heading: "What the colours and labels mean",
        paragraphs: [
          "The green cell in each row is that hotel's lowest tracked night in the window shown. A \"save\" figure under a price appears when you are viewing Annual Passholder rates and the standard rate for the same night is higher. A dash means no rate was available for that night when it was last checked, usually because the hotel was sold out for that party size or the rate plan was not offered.",
          "The Express badge marks the three hotels that include Universal Express Unlimited for every guest: Loews Portofino Bay, Hard Rock Hotel and Loews Royal Pacific. Their rates are higher partly because of that benefit, so compare them with a cheaper hotel plus the Express passes you would otherwise buy.",
        ],
      },
      {
        heading: "Standard and Annual Passholder rates",
        paragraphs: [
          "Use the rate-type control to switch between the public standard rate and the Annual Passholder (APH) rate. APH rates are offered to Universal Orlando annual passholders, and Universal sets them per hotel, per night and per room type. The saving shown under each price is the difference from the standard rate recorded for the same night.",
          "The overview compares the cheapest room on each plan, which may not be the same room. For an exact comparison, open the hotel, choose a room type, and then switch plans.",
        ],
      },
      {
        heading: "Getting from a cheap night to a bookable stay",
        paragraphs: [
          "A single low night is a starting point. For a real stay you need a run of nights with one room type available throughout.",
        ],
        bullets: [
          "Look for several low cells in a row at a hotel you would book.",
          "Open that hotel's page to see room types, the price history for each night and the lowest rate ever recorded.",
          "Check the same dates on the ticket calendar, since admission prices do not always move with hotel rates.",
          "Add roughly 12.5% tax, and parking if you will have a car, before comparing totals.",
          "Confirm the price and cancellation terms on the official booking site.",
        ],
      },
    ],
    faq: [
      {
        question: "Are these the final prices?",
        answer:
          "No. They are nightly room rates before tax, as last observed on Universal's booking pages. Taxes are added at checkout, parking is extra, and availability can change between a check and a booking.",
      },
      {
        question: "Which Universal Orlando hotels include Express Pass?",
        answer:
          "Loews Portofino Bay Hotel, Hard Rock Hotel and Loews Royal Pacific Resort include Universal Express Unlimited at Universal Studios Florida and Islands of Adventure. The other eight on-site hotels do not.",
      },
      {
        question: "Why is a night blank?",
        answer:
          "No rate was returned for that hotel, night, rate type and party size at the last check. The hotel may be sold out or the rate plan may not be offered that night.",
      },
    ],
    guides: ["universal-orlando-hotels-compared", "standard-vs-passholder-hotel-rates", "cheapest-time-to-visit-universal-orlando"],
  },
  tickets: {
    eyebrow: "How to read this page",
    title: "Understanding Universal ticket prices by date",
    intro: [
      "Universal prices admission by the date of first use. The calendar above shows one ticket product at a time, with the price for each possible start date. Lower-priced dates are shaded green and higher-priced dates red, relative to the dates shown.",
      "For a one-day ticket the figure is the price of that day. For a multi-day ticket it is the price of the whole ticket if your first park day falls on that date, with the per-day equivalent underneath. Prices are per person and before tax, and you can switch between adult and child pricing.",
    ],
    sections: [
      {
        heading: "Choosing a product",
        paragraphs: [
          "Tickets differ in length and in park access. A one-park-per-day ticket lets you visit a different park each day. A Park-to-Park ticket lets you move between parks on the same day and is required for the Hogwarts Express. For 2026 dates, tickets of three days or more include Epic Universe on more than one day, while a two-day ticket that includes Epic allows a single day there.",
          "Select a product with the chips above the calendar. Comparing the same start date across two products shows what the extra day or the Park-to-Park upgrade costs for your dates.",
        ],
      },
      {
        heading: "Using the three summary cards",
        paragraphs: [
          "The cards above the calendar show the cheapest and most expensive start dates for the selected product and the difference between them. That difference is the amount one person saves by choosing well, with no other change to the trip. Multiply it by your party to see what the date is worth.",
          "Ticket prices for a date are set well in advance and rarely fall, so there is little to gain from waiting once your dates are fixed. If they are not fixed, you can set a watch on a date and be told if its price changes.",
        ],
      },
      {
        heading: "What this calendar does not include",
        paragraphs: [
          "Express Pass is a separate product with its own calendar. Annual passes, Florida resident offers, military tickets and promotional bundles are not shown. Separately ticketed events such as Halloween Horror Nights are not part of daytime admission. Always check the final price, ticket name and validity window with the seller before buying.",
        ],
      },
    ],
    faq: [
      {
        question: "Why does the same Universal ticket cost more on some dates?",
        answer:
          "Universal uses date-based pricing. Each ticket has a published price for each start date, and dates with higher expected demand, such as weekends and school holidays, are priced higher.",
      },
      {
        question: "Is the price shown per day or for the whole ticket?",
        answer:
          "One-day tickets show the price for that day. Multi-day tickets show the whole-ticket price for a visit starting on that date, with the per-day figure beneath it.",
      },
      {
        question: "Do these prices include tax?",
        answer: "No. Prices are shown before sales tax, which is added at checkout.",
      },
    ],
    guides: ["understanding-universal-ticket-pricing", "universal-orlando-park-to-park-tickets", "epic-universe-first-visit"],
  },
  express: {
    eyebrow: "How to read this page",
    title: "Understanding Express Pass prices",
    intro: [
      "Universal Express is a paid add-on that lets you use a shorter queue at participating rides. It is sold per person, for a specific date, and it does not include park admission. The calendar above shows the price of one Express product for each date it is on sale, per person and before tax.",
      "Express is the most volatile price Universal sells. It is cheapest on quiet days, when it saves little time, and most expensive on the busiest days, when it saves the most. Seeing the whole calendar is the only way to tell whether the date you have in mind is an ordinary one or a peak.",
    ],
    sections: [
      {
        heading: "The different Express products",
        paragraphs: [
          "Use the filters to choose a park, a pass type and a length. The differences matter.",
        ],
        bullets: [
          "Express allows one use of the Express queue per participating ride.",
          "Express Unlimited allows repeat use. It is offered only at Universal Studios Florida and Islands of Adventure.",
          "Epic Universe has its own Express pass, valid only there and for one use per ride. Passes for the other parks do not work at Epic.",
          "Multi-day passes are shown as a whole-pass total. Compare them with single days on that basis.",
        ],
      },
      {
        heading: "Rides Express does not cover",
        paragraphs: [
          "Participating attractions are set by Universal. Hagrid's Magical Creatures Motorbike Adventure was removed from the Express programme on July 1, 2026 and is standby only. A small number of other rides have never been included. If one ride is your reason for buying, check Universal's current list first.",
        ],
      },
      {
        heading: "Before you buy, check the hotel route",
        paragraphs: [
          "Guests of Loews Portofino Bay, Hard Rock Hotel and Loews Royal Pacific receive Express Unlimited at Universal Studios Florida and Islands of Adventure for every registered guest, from check-in day through check-out day. For a party of three or more on a busy date, one night at one of those hotels often costs less than buying passes. Take the price on this page, multiply it by your party and by two days, and compare it with the difference in room rate on the hotel calendar.",
          "That hotel benefit does not apply at Epic Universe, where Express is always a separate purchase.",
        ],
      },
    ],
    faq: [
      {
        question: "Does Express Pass include park admission?",
        answer: "No. Every guest needs a valid park ticket as well as Express.",
      },
      {
        question: "Is Express Pass priced per person?",
        answer:
          "Yes. Each person needs their own pass, and the price is the same for adults and children.",
      },
      {
        question: "Can Express Pass sell out?",
        answer:
          "Yes. Universal limits the number sold for each date, and busy dates, particularly at Epic Universe, have sold out in advance.",
      },
    ],
    guides: ["universal-express-pass-worth-it", "premier-hotel-or-express-pass", "universal-express-now-single-ride"],
  },
  waits: {
    eyebrow: "How to read this page",
    title: "Understanding live wait times",
    intro: [
      "The board above shows the wait each attraction is currently posting, for every park at Universal Orlando. A posted wait is the park's own estimate of how long someone joining the standby queue now will wait to board. RateCoaster collects these every five minutes and stores them, which is what allows the comparison with what is normal for the hour.",
      "Search for a ride by name, or filter by park and by the categories Universal publishes for each attraction, including thrill level, height requirement and whether Express is accepted.",
    ],
    sections: [
      {
        heading: "What the statuses mean",
        paragraphs: [
          "An operating ride shows a wait in minutes. A ride marked down has stopped temporarily, usually for a technical reason or weather, and normally returns the same day. Closed means it is not running today or the park is shut. Rides under refurbishment are closed for a longer scheduled period.",
          "Park averages count only operating attractions with a posted wait, so a stopped ride does not pull the average down.",
        ],
      },
      {
        heading: "Current against typical",
        paragraphs: [
          "Where enough history has been stored, each ride shows how its current wait compares with its typical wait at this hour. That difference is more useful than the raw number. A ride far below its typical wait is worth walking to now. A ride far above it is better left until the evening, when most queues fall.",
          "Open any ride for its own page, with its typical wait by hour, its location and the details Universal publishes about it.",
        ],
      },
      {
        heading: "Getting the most from it",
        paragraphs: [
          "Waits follow a daily curve. They are lowest in the first hour, peak from late morning to mid-afternoon and fall in the last hour or two.",
        ],
        bullets: [
          "Ride the attraction with the longest typical wait first, at opening.",
          "Use the middle of the day for shows, food and rides with short typical waits.",
          "Check this page in mid-afternoon for anything running below typical.",
          "Where a single-rider wait is shown, it is often a fraction of the standby wait.",
        ],
      },
    ],
    faq: [
      {
        question: "Where do the wait times come from?",
        answer:
          "From Queue-Times.com and ThemeParks.wiki, which relay the waits each park posts. RateCoaster collects them every five minutes.",
      },
      {
        question: "How accurate are posted wait times?",
        answer:
          "They are estimates set by each ride's team and are often slightly overstated. Expect the real wait to be within about ten to fifteen minutes of the posted figure.",
      },
      {
        question: "Why is no wait shown for a ride?",
        answer:
          "The ride is temporarily down, closed for the day, under refurbishment, or the park is closed.",
      },
    ],
    guides: ["reading-wait-times-like-a-local", "early-park-admission-explained", "universal-express-pass-worth-it"],
  },
  crowds: {
    eyebrow: "How to read this page",
    title: "How the crowd calendar works",
    intro: [
      "Each day on the calendar has a score from 1 to 10 and a label from very low to very high. The score is an estimate of demand for that park on that date. It is not a count of visitors, which Universal does not publish, and it is not a forecast of any particular queue.",
      "The estimate comes from prices. Universal sets the price of admission, Express Pass and on-site hotel rooms for every date according to its own demand forecasts, and charges more when it expects to be busy. RateCoaster reads those three published signals together and turns them into a single score. In effect the calendar shows what Universal itself expects, with its pricing as the evidence.",
    ],
    sections: [
      {
        heading: "Using the scores",
        paragraphs: [
          "The scores are most reliable for comparing dates with each other. A day scored 3 is expected to be quieter than a day scored 7 in the same park. They are less reliable as absolutes, because a ride breakdown, a storm or a special event can change a day in ways no price anticipates.",
        ],
        bullets: [
          "If your dates are flexible, use the scores to choose between candidate weeks once you have checked prices.",
          "If your dates are fixed, put the park you care about most on your lowest-scored day.",
          "Use a high-scored day as the day to consider Express Pass, and a low-scored day as the day to skip it.",
          "Switch parks with the chips above the calendar. The same date can score differently in each park.",
        ],
      },
      {
        heading: "Past months",
        paragraphs: [
          "Estimates for past dates are kept so that you can look back at how a week or a season scored. Some older dates were reconstructed from pricing data retained at the time and are marked as such. Dates for which no signals were collected show \"No data\" instead of a guess.",
        ],
      },
      {
        heading: "What it cannot see",
        paragraphs: [
          "The calendar does not know about ride closures, weather, park hours or separately ticketed evening events. Check Universal's hours and refurbishment schedule for your dates, and use the live wait times page on the day for what is happening in the park.",
        ],
      },
    ],
    faq: [
      {
        question: "Is the crowd calendar based on attendance?",
        answer:
          "No. Universal does not publish daily attendance. The calendar is a demand estimate built from Universal's published admission, Express Pass and hotel pricing.",
      },
      {
        question: "What does a score of 10 mean?",
        answer:
          "It means all the available pricing signals point to the highest demand of the period. Expect long waits at headline rides and consider Express Pass or an early start.",
      },
      {
        question: "How often is the crowd calendar updated?",
        answer:
          "Scores are recalculated as new hotel, ticket and Express Pass prices are collected, which happens several times a day.",
      },
    ],
    guides: ["choosing-dates-with-prices-and-waits", "cheapest-time-to-visit-universal-orlando", "reading-wait-times-like-a-local"],
  },
  plan: {
    eyebrow: "How this works",
    title: "How the trip planner builds an estimate",
    intro: [
      "The planner takes your dates and party and assembles a whole-trip estimate from prices RateCoaster has already recorded: a hotel stay, park tickets and, if you choose a home airport, a tracked round-trip fare. It is designed to compare whole trips, because the cheapest hotel week is not always the cheapest week overall.",
    ],
    sections: [
      {
        heading: "The hotel part",
        paragraphs: [
          "For each on-site hotel, the planner looks for a complete stay: one room type available on every night of your dates, at the rate type you selected. It then shows the least expensive complete stay and the alternatives. This is stricter than adding up the cheapest room on each night, and deliberately so. A stay made of a different room type each night cannot be booked.",
          "Rates are for the party size you enter and are shown before tax.",
        ],
      },
      {
        heading: "The ticket part",
        paragraphs: [
          "The planner counts the days in your visit and chooses the tracked ticket whose length fits best without exceeding it, preferring broader park access. If your trip is longer than any tracked ticket, it says how many days are not covered. If you search with the Annual Passholder rate, it assumes your pass covers the two original parks and adds only a separately ticketed Epic Universe day where relevant.",
          "Arrival and departure days are often not park days, so a ticket one day shorter than the stay is frequently right. Treat the suggestion as a starting point.",
        ],
      },
      {
        heading: "What is not in the total",
        paragraphs: [
          "The estimate leaves out hotel tax, parking, food, Express Pass and anything bought in the parks. The assumptions used for your result are listed beneath it. Every figure is an observed price, not a quote, and should be confirmed with the seller before you book.",
        ],
        bullets: [
          "Add roughly 12.5% to the hotel subtotal for tax.",
          "Price Express separately on the Express calendar if you plan to buy it.",
          "Save the trip and set a watch if you want to be told when its hotel rate changes.",
        ],
      },
    ],
    faq: [
      {
        question: "Does the trip planner book anything?",
        answer:
          "No. RateCoaster does not sell rooms, tickets or flights. The planner produces an estimate from tracked prices and links to the official sellers.",
      },
      {
        question: "Why does the planner say no complete stay is available?",
        answer:
          "No single room type was available at that hotel on every night of your dates at the last check. Try shifting the dates by a day or choosing a different rate type.",
      },
      {
        question: "Is tax included in the estimate?",
        answer: "No. Hotel and ticket prices are shown before tax.",
      },
    ],
    guides: ["universal-trip-budget-checklist", "choosing-dates-with-prices-and-waits", "how-far-ahead-to-book-universal"],
  },
} as const satisfies Record<string, Explainer>;

export type ExplainerKey = keyof typeof EXPLAINERS;
