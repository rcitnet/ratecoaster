import type { GuideContent } from "./types.js";

export const TICKET_GUIDES: GuideContent[] = [
  {
    slug: "understanding-universal-ticket-pricing",
    title: "Understanding Universal ticket pricing by date",
    summary:
      "Why the same ticket changes price, how the 2026 rules for Epic Universe work, and how to match ticket length to the trip you are taking.",
    category: "tickets",
    published: "2026-08-21",
    updated: "2026-11-09",
    takeaways: [
      "Universal Orlando tickets are priced by the date of first use. The same ticket costs more on high-demand dates.",
      "The per-day cost falls steeply as days are added, most of all between one day and three.",
      "From 2026, tickets of three days or more include Epic Universe on more than one day. Two-day tickets do not.",
      "Compare multi-day tickets by their whole-ticket total. A low per-day figure is not the amount you pay.",
    ],
    live: "ticket-range",
    sections: [
      {
        heading: "Product and start date both set the price",
        paragraphs: [
          "A Universal Orlando ticket has two parts that determine its price. The product is the combination of length and park access, such as a one-day one-park ticket or a three-day Park-to-Park ticket. The start date is the first day you will use it. Universal publishes a price for each product on each start date, and those prices rise with expected demand.",
          "Two consequences follow. Two products on the same day are not interchangeable, so a cheaper product is cheaper because it does less. And the same product on two different days is not the same price, so moving the first park day by a day or two can change the total for a family by a noticeable amount without changing anything else about the trip.",
          "Single-day tickets are valid only on the date chosen. Multi-day tickets start on the chosen date and must be used within a set window after it, which Universal states on the ticket. Check that window if your park days are spread out across a longer holiday.",
        ],
      },
      {
        heading: "The products, in plain terms",
        paragraphs: [
          "Universal's ticket names are long, but they are built from a small number of choices.",
        ],
        bullets: [
          "Length: one to five days for most visitors, with longer tickets sold in some markets.",
          "One park per day, or Park-to-Park. A one-park-per-day ticket lets you visit a different park each day but not two on the same day. Park-to-Park lets you move between parks on the same day.",
          "Which parks: Universal Studios Florida and Islands of Adventure are the base. Epic Universe is included on some tickets and sold as a one-day ticket by itself. Volcano Bay is an add-on when the water park is operating.",
          "Guest category: adult prices apply from age ten, child prices from three to nine, and children under three do not need a ticket.",
        ],
        after: [
          "RateCoaster tracks adult and child prices separately for each product, and the [ticket calendar](/tickets) lets you switch between them.",
        ],
      },
      {
        heading: "What changed for Epic Universe in 2026",
        paragraphs: [
          "When Epic Universe opened in May 2025, multi-day tickets treated it as a single-visit add-on. A ticket of any length included one day at Epic Universe and no more, and there was no park-hopping into it.",
          "For 2026 dates Universal changed that. Tickets of three days or longer now include Epic Universe on more than one day, and there is a three-park Park-to-Park option that covers Universal Studios Florida, Islands of Adventure and Epic Universe. Two-day tickets were left out of the change: a two-day visit that includes Epic is still a day at one of the original parks plus a day at Epic Universe.",
          "For planning, that makes three days the natural minimum for a trip that wants proper time at all three theme parks. It also changes the sum for a two-day visitor, who may find that the three-day ticket costs little more than the two-day one on their dates and removes the one-visit limit.",
        ],
      },
      {
        heading: "Per-day price and whole-ticket price",
        paragraphs: [
          "Universal advertises multi-day tickets with a per-day figure, because it looks small. The amount charged is the whole ticket. A five-day ticket at a low per-day rate is still five days of admission.",
          "RateCoaster shows multi-day products as the whole-ticket total with the per-day figure beside it for reference. That is the right way round for budgeting, and it also makes the shape of the discount obvious. Adding a third day to a two-day ticket typically costs a fraction of the first day. Adding a fifth to a four-day ticket costs less again. If you are unsure between two lengths, the longer one is usually a small premium for a much more relaxed trip.",
          "The trade is against everything else that an extra day costs: another hotel night, another day of food, and possibly another day of Express. A longer ticket only saves money if it lets you skip Express by spreading rides over more time, which it often does.",
        ],
      },
      {
        heading: "Fit the ticket to the itinerary",
        paragraphs: [
          "The [trip planner](/plan) counts the park days in a visit and looks for the closest tracked ticket length that does not exceed it. It then favours broader park access before comparing price. If there is no exact length, it tells you how many trip days are not covered instead of quietly presenting a partial match as complete.",
          "Treat its suggestion as a starting point. Arrival and departure days are not always park days, and a pool day or a rest day in the middle of a week is a good idea with children. A ticket one day shorter than the trip is frequently the right choice.",
        ],
        bullets: [
          "Count the days you will actually enter a park.",
          "Decide whether any day needs two parks. If none does, one park per day is enough.",
          "Decide how many days you want at Epic Universe. More than one points to a three-day or longer ticket.",
          "Price the first park day on the calendar, then the day before and after it.",
        ],
      },
      {
        heading: "Passholder trips need a different assumption",
        paragraphs: [
          "If someone in the party holds a Universal Orlando annual pass, their admission to Universal Studios Florida and Islands of Adventure is already covered on dates their tier allows. No pass tier includes Epic Universe as of late 2026, so a passholder buys Epic separately as a dated one-day ticket, at a passholder discount once the pass has been activated.",
          "When the hotel search in the planner uses an Annual Passholder rate, it therefore does not attach a normal multi-park ticket. It assumes eligible admission is covered and considers only the separate Epic Universe day. Verify what your own pass includes on your dates, including any blockouts.",
        ],
      },
      {
        heading: "When to buy",
        paragraphs: [
          "Ticket prices for a given date are set well ahead and change less often than hotel rates. Waiting rarely produces a lower price for the same date, and Universal raises prices across the board from time to time, which can land between the day you looked and the day you bought. Tickets bought at the gate have also generally cost more than the same ticket bought online in advance.",
          "The practical advice is to buy once the dates are firm. If the dates are not firm, set a watch on the date you are leaning toward from the [ticket calendar](/tickets) and you will be told if its price changes.",
        ],
      },
    ],
    faq: [
      {
        question: "Why do Universal Orlando ticket prices change by date?",
        answer:
          "Universal uses date-based pricing. Each ticket product has a published price for each start date, and prices are higher on dates with higher expected demand such as weekends, school holidays and Christmas.",
      },
      {
        question: "Do multi-day Universal tickets include Epic Universe?",
        answer:
          "For 2026 dates, tickets of three days or more include Epic Universe on more than one day. Two-day tickets that include Epic allow one day there.",
      },
      {
        question: "What age is a child ticket at Universal Orlando?",
        answer:
          "Child tickets are for ages three to nine. Guests ten and over need an adult ticket, and children under three are admitted free.",
      },
      {
        question: "Is it cheaper to buy Universal tickets in advance?",
        answer:
          "Generally yes. Prices are date-based and set in advance, and gate prices have typically been higher than online prices for the same ticket.",
      },
    ],
    related: ["universal-orlando-park-to-park-tickets", "universal-trip-budget-checklist", "epic-universe-first-visit"],
  },
  {
    slug: "universal-orlando-park-to-park-tickets",
    title: "Park-to-Park or one park per day: which Universal ticket to buy",
    summary:
      "What Park-to-Park adds, what the Hogwarts Express has to do with it, how Epic Universe fits in, and how to tell whether the upgrade is worth paying for.",
    category: "tickets",
    published: "2026-11-09",
    updated: "2026-11-09",
    takeaways: [
      "A one-park-per-day ticket still lets you visit every park on the ticket, one per day. Park-to-Park adds the ability to switch parks during a day.",
      "The Hogwarts Express between the two Wizarding World lands requires Park-to-Park, because it crosses from one park to the other.",
      "Park-to-Park matters most on short trips. Over four or five days, one park per day covers everything with time to spare.",
      "Universal Studios Florida and Islands of Adventure share an entrance plaza. Epic Universe is a bus ride away, so hopping to it costs real time.",
    ],
    live: "ticket-range",
    sections: [
      {
        heading: "What the two ticket types allow",
        paragraphs: [
          "Every Universal Orlando ticket is one of two kinds. A one-park-per-day ticket, which Universal also calls a base ticket, admits you to one park each day. You can choose a different park each day, and you can leave and re-enter the same park, but once you have entered one park you cannot enter another until tomorrow.",
          "A Park-to-Park ticket removes that limit. You can go to Islands of Adventure in the morning and Universal Studios Florida in the afternoon, or back and forth as often as you like. For 2026 there are two-park and three-park versions, the latter adding Epic Universe.",
          "The upgrade is priced per ticket, not per day. On a one-day ticket it is a large jump, because a one-day Park-to-Park ticket is effectively admission to two parks. On a five-day ticket the same flexibility is a modest addition spread across the whole trip.",
        ],
      },
      {
        heading: "The Hogwarts Express question",
        paragraphs: [
          "For many families the decision comes down to one ride. The Hogwarts Express runs between King's Cross Station in Universal Studios Florida, beside Diagon Alley, and Hogsmeade Station in Islands of Adventure. It is a different experience in each direction, and it is a ride as well as transport.",
          "Because it carries you from one park into the other, you need a Park-to-Park ticket to board. Team members check tickets at the station. A base ticket lets you visit Diagon Alley on one day and Hogsmeade on another, and you will see both lands in full, but you will not ride the train.",
          "Whether that is worth the upgrade for every member of the party is a fair question. For a household of committed Harry Potter fans it is close to the point of the trip. For a mixed group it is one attraction among many.",
        ],
      },
      {
        heading: "When Park-to-Park earns its price",
        paragraphs: [
          "The upgrade pays for itself in time on short visits and in flexibility on any visit.",
        ],
        bullets: [
          "One or two days total. There is not enough time to give each park a full day, and hopping lets you take the best of both.",
          "Evening plans in a different park, such as a nighttime show at one after a day at the other.",
          "Weather. Florida afternoon storms close outdoor coasters. Being able to move to a park with more indoor rides rescues the day.",
          "Uneven interest. If part of the group wants one more ride on a coaster in the other park, they can go.",
          "Following the queues. With [live wait times](/waits) in hand, you can move to whichever park is quieter that afternoon.",
        ],
      },
      {
        heading: "When one park per day is enough",
        paragraphs: [
          "On a longer trip, the base ticket does everything most parties need. With four or five days, each park gets at least one full day and the best ones get two. Nobody has to cross the resort at four in the afternoon with tired children.",
          "It also suits a party with young children, for whom moving parks mid-day is more of a cost than a benefit, and a party on a tight budget, for whom the upgrade multiplied across four or five tickets is a meaningful sum that could cover a day of Express or a better hotel instead.",
          "If you buy base tickets and regret it, Universal has generally allowed tickets to be upgraded at guest services for the difference in price, so starting with the cheaper ticket is a low-risk choice. Confirm that when you buy.",
        ],
      },
      {
        heading: "How Epic Universe changes hopping",
        paragraphs: [
          "Universal Studios Florida and Islands of Adventure sit side by side and share the CityWalk entrance plaza. Walking from one gate to the other takes about ten minutes, and the Hogwarts Express connects them from the inside. Hopping between them is easy.",
          "Epic Universe is on a separate site a few miles south. Getting there from the original parks means a shuttle bus or a drive, and with waiting and security it can take half an hour or more each way. Hopping to or from Epic in the middle of a day is possible on a three-park Park-to-Park ticket, but it is not the casual stroll that hopping between the original two is.",
          "Epic Universe also rewards a full day. Its five worlds have enough in them that most first-time visitors do not finish in one visit. A reasonable plan on a three-park ticket is to give Epic whole days and keep the hopping for the original pair.",
        ],
      },
      {
        heading: "Reading the price difference on this site",
        paragraphs: [
          "The [ticket calendar](/tickets) lists each product RateCoaster tracks as its own calendar. To see what Park-to-Park costs on your dates, open the one-park product and the Park-to-Park product of the same length and compare the same start date. The box on this page shows the current low and high for each tracked one-day product.",
          "The difference is not the same every day. On peak dates both rise, and the gap between them can widen or narrow. As with everything else Universal sells, the date is part of the product.",
        ],
      },
    ],
    faq: [
      {
        question: "Do you need a Park-to-Park ticket to ride the Hogwarts Express?",
        answer:
          "Yes. The Hogwarts Express travels between Universal Studios Florida and Islands of Adventure, so a Park-to-Park ticket is required to board.",
      },
      {
        question: "Can you visit both parks without a Park-to-Park ticket?",
        answer:
          "Yes, on different days. A multi-day one-park-per-day ticket lets you choose a different park each day.",
      },
      {
        question: "Can you park hop to Epic Universe?",
        answer:
          "With a three-park Park-to-Park ticket for 2026 dates, yes. Epic Universe is a shuttle or car journey from the other two parks, so allow time for the transfer.",
      },
    ],
    related: ["understanding-universal-ticket-pricing", "epic-universe-first-visit", "universal-trip-budget-checklist"],
  },
];
