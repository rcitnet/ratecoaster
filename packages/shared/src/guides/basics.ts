import type { GuideContent } from "./types.js";

export const BASICS_GUIDES: GuideContent[] = [
  {
    slug: "how-ratecoaster-compares-prices",
    title: "How RateCoaster compares Universal prices",
    summary:
      "What every calendar on this site measures, how often it is refreshed, where the numbers come from, and how to tell a real low from an ordinary Tuesday.",
    category: "start-here",
    published: "2026-08-21",
    updated: "2026-11-09",
    takeaways: [
      "Every price here is an observation of what the official seller published for a specific date, room and rate plan. It is not a quote and nothing is held for you.",
      "Hotel rates are re-checked four times a day, Express Pass prices six times a day, ticket prices twice a day and ride waits every five minutes.",
      "A new row is stored only when a price changes, which is why the history charts show steps rather than a wiggly line.",
      "Standard and Annual Passholder rates, room types and occupancies are kept separate so a discount is never invented by comparing two different things.",
    ],
    sections: [
      {
        heading: "An observed price, not a guaranteed quote",
        paragraphs: [
          "RateCoaster records the prices that Universal's own booking pages publish for a specific stay date, hotel, room type, occupancy and rate plan. The amount in a calendar cell is what the source showed the last time it was checked. It is a snapshot, and it is not inventory held on your behalf.",
          "That distinction matters because hotel and admission inventory moves between the moment a price is collected and the moment you reach a checkout page. A room can sell out, a rate plan can close, and a ticket date can be repriced. The useful signal on this site is the comparison: this week against next week, this hotel against that one, today's rate against the rate three weeks ago. The final decision should always rest on the price and terms the official seller shows at checkout.",
          "Every nightly hotel rate is shown before tax and before any parking charge, because that is how the source publishes it. Orange County and Florida taxes are added at checkout as a percentage of the room rate, so the gap between two hotels is slightly wider in real money than it looks in the grid.",
        ],
      },
      {
        heading: "How often each price is checked",
        paragraphs: [
          "Different products move at different speeds, so they are collected on different schedules. Ride waits change by the minute. Hotel rates respond to how full a property is becoming and can move several times in a week. Admission is priced by date well in advance and changes far less often.",
        ],
        table: {
          caption: "Collection schedule",
          head: ["What", "How often", "How far ahead"],
          rows: [
            ["On-site hotel rates", "Four times a day", "365 nights"],
            ["Express Pass prices", "Six times a day", "As far as Universal sells"],
            ["Ticket prices", "Twice a day", "As far as Universal sells"],
            ["Ride wait times", "Every five minutes", "Live only"],
            ["Park hours", "Twice a day", "Published calendar"],
          ],
        },
        after: [
          "Each table on the site carries a \"checked\" time, so you can see how old a number is.",
        ],
      },
      {
        heading: "Why the history charts look like staircases",
        paragraphs: [
          "Prices are stored append-only and written only when they change. If a room is $219 at six in the morning and still $219 at noon, nothing new is recorded. When it moves to $239, one row is written with the time the change was first seen.",
          "The result is that a price-history chart on a hotel page is a true step function. A long flat stretch means the rate held. A cluster of steps means the hotel was repricing that night actively, which usually happens when the date is filling faster or slower than expected. It also means the \"lowest seen\" figure in each table is the lowest value RateCoaster has ever recorded for that hotel, date and rate plan, not an estimate.",
          "History only reaches back to when tracking began for each product. A date that looks like a record low after two weeks of data is a much weaker signal than the same low after six months, and the charts should be read with that in mind.",
        ],
      },
      {
        heading: "Keeping unlike prices apart",
        paragraphs: [
          "Most misleading travel deals come from comparing two things that are not the same. A suite at a passholder rate set against a standard room at a public rate will always look like a bargain. RateCoaster avoids that in three ways.",
        ],
        bullets: [
          "Rate plans are separate. Standard and Annual Passholder (APH) rates are stored as different plans. A savings figure appears only when both exist for the same hotel and night.",
          "Room types are separate. The hotel overview shows the least expensive available room at each property. A hotel page lets you pin one room type and then switch rate plans, which is the like-for-like comparison.",
          "Occupancy is part of the question. Universal quotes by party size, so the default grid is for two adults and the adults filter re-prices it.",
        ],
        after: [
          "Passholder rates get one extra check before they are stored. Universal marks a passholder rate with a strike-through public price and a discount label. If those markers are missing, the reading is discarded instead of being saved as a discount that does not exist.",
        ],
      },
      {
        heading: "What makes a deal stand out",
        paragraphs: [
          "A low price at one hotel is not automatically good value at another. A night at Loews Portofino Bay and a night at Endless Summer are different products, and one of them includes Express Unlimited for everyone in the room. RateCoaster compares each hotel against its own collected history and keeps the hotel category and Express badge visible beside the number, so a Signature Collection hotel is never ranked against a Value hotel on nightly price alone.",
          "The deals board on the home page works the same way. It takes the cheapest upcoming night at each hotel and ranks the hotels by how that price compares with the hotel's own recorded history. Ranking on raw price would hand every slot to the Value hotels and tell you nothing new.",
        ],
        bullets: [
          "Use the [hotel calendar](/hotels) to find naturally cheaper weeks across the whole year.",
          "Open a hotel page and click a date to see whether the current rate recently rose or fell.",
          "For passholder rates, pin a room type first, then compare it with the matching standard rate.",
          "Check the [ticket calendar](/tickets) for the same dates, because hotel and admission prices do not always move together.",
          "Confirm taxes, parking, occupancy rules and cancellation terms with the seller before booking.",
        ],
      },
      {
        heading: "Where the other numbers come from",
        paragraphs: [
          "Live ride waits come from two public sources, Queue-Times.com and ThemeParks.wiki, which relay the wait times each park posts. RateCoaster stores those readings and rolls them up by hour, which is what powers the \"typical for this hour\" comparison on each ride page.",
          "The [crowd calendar](/crowd-calendar) is a demand estimate, not an attendance count. Universal does not publish attendance by day. What it does publish is prices, and it prices admission, Express Pass and hotel rooms higher on the dates it expects to be busy. The calendar reads those three signals together and scores each date from 1 to 10. It is a reading of Universal's own expectations, which is useful, and it is not a promise about any particular queue.",
        ],
      },
      {
        heading: "What this site does not do",
        paragraphs: [
          "RateCoaster does not sell rooms or tickets, does not hold inventory, and is not affiliated with Universal Destinations & Experiences or Loews Hotels. Some outbound booking links are affiliate links and are labelled where they appear. Advertising and affiliate relationships never change which prices are shown or how they are ordered. More detail on who runs the site and how it is paid for is on the [About page](/about).",
        ],
      },
    ],
    faq: [
      {
        question: "Why is the price at checkout different from the price on RateCoaster?",
        answer:
          "The calendar shows the nightly rate before tax as it was last observed. Checkout adds taxes, may add parking, and reflects inventory at that exact moment. If the room type you saw has sold out, the booking engine will offer the next one up.",
      },
      {
        question: "How current are the hotel rates?",
        answer:
          "Each hotel is re-checked four times a day for the next 365 nights. Every table shows how long ago each number was checked.",
      },
      {
        question: "Does RateCoaster show every room type?",
        answer:
          "The overview grid shows the least expensive available room per hotel and night. Each hotel page has a room-type filter listing every room type the booking engine has returned for that property.",
      },
    ],
    related: ["universal-trip-budget-checklist", "standard-vs-passholder-hotel-rates", "choosing-dates-with-prices-and-waits"],
  },
  {
    slug: "universal-trip-budget-checklist",
    title: "What a Universal Orlando trip really costs: a budget checklist",
    summary:
      "The line items that decide the total, the ones people forget, and the order to price them in so the cheap-looking option does not end up the expensive one.",
    category: "start-here",
    published: "2026-11-09",
    updated: "2026-11-09",
    takeaways: [
      "Hotel, admission and Express Pass are the three prices that move by date. Price all three for the same dates before judging any one of them.",
      "Room rates are quoted before roughly 12.5% in combined state and county tax, and on-site hotels charge for overnight parking.",
      "Express Pass is priced per person per day, so it scales with party size while a room upgrade does not.",
      "Multi-day tickets drop sharply in per-day cost from the third day, and in 2026 tickets of three days or more include Epic Universe on more than one day.",
    ],
    sections: [
      {
        heading: "Start with the three prices that move",
        paragraphs: [
          "Most of a Universal Orlando budget is fixed by three products that Universal reprices by date: the hotel room, park admission and Express Pass. Flights and food matter, but they do not swing by hundreds of dollars depending on which Tuesday you pick. These three do.",
          "They also do not move in step. A week with soft hotel rates can sit on top of a peak admission date, and Express Pass is more volatile than either. Pricing one of them and assuming the others follow is the most common way a budget goes wrong. The [trip planner](/plan) adds them together for a specific set of dates so the comparison is between whole trips, not single line items.",
        ],
      },
      {
        heading: "The hotel line",
        paragraphs: [
          "The rate in any hotel grid, here or on Universal's own site, is the nightly room rate before tax. Universal's hotel pages list Florida sales tax at 6.5% and Orange County occupancy tax at 6%, charged as a percentage of the room rate each night. On a $250 room that is a little over $31 a night that does not appear in the headline number.",
          "Universal's on-site hotels do not add a nightly resort fee, which sets them apart from many Orlando-area hotels. They do charge for overnight self-parking, and the amount depends on the hotel category. If you are driving or renting a car, add the parking rate from the hotel's own page for each night. If you are flying in and staying on site, you may not need a car at all, since every on-site hotel has free transportation to the parks.",
        ],
        bullets: [
          "Nightly rate times nights, for one room type across the whole stay.",
          "Roughly 12.5% tax on top.",
          "Overnight parking per night, if you have a car.",
          "A second room or a suite if the party is larger than the room sleeps. Some of the newer hotels have no standard rooms for five.",
        ],
      },
      {
        heading: "The admission line",
        paragraphs: [
          "Universal prices tickets by the date of first use. A one-day ticket for a quiet weekday in late January and the same ticket for the Saturday before Christmas are different prices. Tickets are sold per person, children aged three to nine pay a slightly lower child price, and children under three are free.",
          "The per-day cost of a ticket falls quickly as days are added. Two single-day tickets cost far more than one two-day ticket, and the per-day figure keeps dropping through four and five days. For 2026, Universal changed how Epic Universe fits in: tickets of three days or more now include Epic Universe on more than one day and there is a three-park Park-to-Park option, while two-day tickets do not carry that multi-day Epic access. If Epic Universe matters to your trip, that rule alone can decide the ticket length. The details are in the [ticket pricing guide](/guides/understanding-universal-ticket-pricing).",
        ],
        bullets: [
          "Adult and child tickets for the right number of park days. Arrival and departure days are not always park days.",
          "Park-to-Park only if you need to change parks mid-day or want to ride the Hogwarts Express between the two original parks.",
          "Sales tax on tickets, added at checkout.",
        ],
      },
      {
        heading: "The Express Pass line",
        paragraphs: [
          "Express Pass is sold per person, per day, and it is the single most volatile price Universal sells. On busy dates one day of Express for one person can cost more than that person's park ticket. Multiply by the party and by the number of days and it can become the largest line in the budget.",
          "There are two ways to shrink it. The first is to buy it only for the day that needs it, which is usually the busiest day of the trip. The second is to stay at one of the three hotels that include Express Unlimited for every registered guest at Universal Studios Florida and Islands of Adventure: Loews Portofino Bay, Hard Rock Hotel and Loews Royal Pacific. A room upgrade is a fixed cost per night while purchased Express scales with headcount, so the larger the party, the more often the upgrade wins. The [Express-hotel comparison](/guides/premier-hotel-or-express-pass) shows how often that is true on the dates RateCoaster is tracking right now.",
          "The hotel benefit does not cover Epic Universe. No hotel includes Express there, so if you want it at Epic it is always a separate purchase.",
        ],
      },
      {
        heading: "The lines people forget",
        paragraphs: [
          "The remaining costs are smaller individually and easy to leave out. Together they often add 15 to 25 percent to a trip that was budgeted on hotel and tickets alone.",
        ],
        bullets: [
          "Day parking at the main garages if you are staying off site. It is charged per vehicle per day.",
          "Airport transfers. On-site hotels are roughly 16 miles from Orlando International Airport, and neither a shuttle nor a ride share is free.",
          "Food. Counter-service meals in the parks, table-service dinners at CityWalk and snacks add up faster than most people plan for, especially with children.",
          "Lockers on rides that require them for larger bags, and a locker at Volcano Bay when the water park is open.",
          "Interactive wands, Power-Up Bands and similar add-ons, which are optional and which children will ask for.",
          "Separately ticketed events such as Halloween Horror Nights, which are not included in daytime admission.",
        ],
      },
      {
        heading: "The order to price things in",
        paragraphs: [
          "Working through the lines in the right order prevents a cheap first choice from forcing an expensive second one.",
        ],
        bullets: [
          "Pick two or three candidate weeks from the [hotel calendar](/hotels), looking for a run of low nights at a hotel you would be happy with.",
          "Check the same weeks on the [ticket calendar](/tickets) and drop any week where admission is at its peak.",
          "Decide whether you want Express at all. If yes, price it for your party on the [Express calendar](/express-pass) and compare that total with moving to an Express-included hotel.",
          "Add tax, parking and transfers.",
          "Only then compare the whole-trip totals for each week.",
        ],
        after: [
          "If your dates are fixed by school holidays, the levers left are hotel category, ticket length and whether to buy Express. If your dates are flexible, the week you choose is usually worth more than every other decision combined.",
        ],
      },
    ],
    faq: [
      {
        question: "Do Universal Orlando hotels charge a resort fee?",
        answer:
          "Universal's on-site hotels do not add a nightly resort fee. They do add state and county tax to the room rate and charge separately for overnight parking.",
      },
      {
        question: "Is Express Pass included in a Universal ticket?",
        answer:
          "No. Express Pass is a separate purchase, priced per person per day. It is included without extra charge only for guests of Loews Portofino Bay, Hard Rock Hotel and Loews Royal Pacific, and only at Universal Studios Florida and Islands of Adventure.",
      },
      {
        question: "What is the cheapest way to add Epic Universe?",
        answer:
          "For most multi-day trips in 2026 it is a ticket of three days or more, which includes Epic Universe on more than one day. Price the exact dates on the ticket calendar, since the per-day cost changes with the start date.",
      },
    ],
    related: ["how-ratecoaster-compares-prices", "cheapest-time-to-visit-universal-orlando", "premier-hotel-or-express-pass"],
  },
];
