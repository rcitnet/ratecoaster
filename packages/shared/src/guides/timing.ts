import type { GuideContent } from "./types.js";

export const TIMING_GUIDES: GuideContent[] = [
  {
    slug: "cheapest-time-to-visit-universal-orlando",
    title: "The cheapest time to visit Universal Orlando",
    summary:
      "Which weeks are reliably cheap, which are reliably expensive, what the tracked rates show month by month, and why the calendar beats any discount code.",
    category: "timing",
    published: "2026-08-21",
    updated: "2026-11-09",
    takeaways: [
      "The week you choose moves the total more than any promotion applied to a fixed week.",
      "Reliably cheaper: mid-January to early February, late April to mid-May, and late August through September.",
      "Reliably expensive: Christmas to New Year, spring break and Easter, Thanksgiving week, and mid-June to early August.",
      "Cheap and quiet usually go together, but events such as Halloween Horror Nights and Mardi Gras can make a low-rate week busy.",
    ],
    live: "hotel-months",
    sections: [
      {
        heading: "Dates move prices more than discounts do",
        paragraphs: [
          "Universal prices hotel rooms, admission and Express Pass by expected demand, and the swing across a year is wide. The same room, the same ticket and the same family can cost very different amounts depending only on which week is chosen. That variation is usually larger than any promotion, passholder rate or package discount applied to a fixed set of dates.",
          "This is the most useful thing to understand before booking anything. Hunting for a code to take a few percent off a peak week is effort in the wrong place if moving the trip by two weeks would save several times as much. The table below this section is computed from the rates RateCoaster is tracking today, so you can see the size of the swing for the coming twelve months instead of taking it on trust.",
          "Read that table with two things in mind. It shows prices as they stand today, and hotel rates for dates many months away are often the starting price, before any of the offers that tend to appear closer in. A distant month can therefore look expensive now and soften later. And the first and last months in the table are usually partial. The seasonal pattern described next is the long-run shape; the table is the current reading, and where they differ for dates you care about, the table and the calendars are the ones to act on.",
        ],
      },
      {
        heading: "The pattern most years follow",
        paragraphs: [
          "Demand follows school calendars and public holidays closely. The expensive periods are the ones when the largest number of families are free to travel at once, and they are predictable years ahead.",
        ],
        table: {
          caption: "Typical Universal Orlando demand by season",
          head: ["Period", "Demand", "What drives it"],
          rows: [
            ["Early January (after New Year)", "Falling", "Schools return after the holidays"],
            ["Mid-January to early February", "Low", "No school holidays; coolest weather"],
            ["Mid-February to early April", "Rising to high", "Presidents' Day, Mardi Gras concerts, staggered spring breaks"],
            ["Easter week", "Very high", "The peak of spring break"],
            ["Late April to mid-May", "Low to moderate", "Between spring break and summer"],
            ["Late May to early August", "High", "Summer holidays; hottest, wettest weather"],
            ["Mid-August to late September", "Low by day", "Schools return; peak hurricane season; Horror Nights evenings"],
            ["October", "Moderate, busy evenings", "Halloween Horror Nights on select nights"],
            ["Early November to mid-December", "Moderate", "Except Thanksgiving week, which is very high"],
            ["Christmas to New Year", "Highest of the year", "Everything at peak pricing"],
          ],
        },
        after: [
          "Within any week, Friday and Saturday nights cost more than Sunday to Thursday at almost every hotel, and the weekend premium widens in busy seasons. Shifting a three-night stay from Friday-to-Monday to Sunday-to-Wednesday is often the cheapest change a traveller can make.",
        ],
      },
      {
        heading: "The 2026 and 2027 calendar",
        paragraphs: [
          "Events shift demand inside the seasonal pattern, and Universal publishes their dates well ahead. For the current cycle, Mardi Gras ran from February 7 to April 4, 2026. Halloween Horror Nights ran on select nights from August 28 to November 1, 2026. The holiday season, with the Grinch in Seuss Landing and Christmas in the Wizarding World, runs from November 14, 2026 to January 3, 2027.",
          "One closure also matters for anyone travelling in the cooler months. Volcano Bay, the water park, closed for an extended refurbishment on October 26, 2026 and is scheduled to reopen on or before March 24, 2027. A winter or early spring trip in this cycle is a three-park trip, and the hotels beside Volcano Bay lose their walking-distance advantage for the duration.",
        ],
      },
      {
        heading: "Cheap dates and quiet dates are not the same thing",
        paragraphs: [
          "It is tempting to assume that the cheapest week is also the emptiest. Often it is. Not always.",
          "September is the clearest example. Daytime crowds are among the lowest of the year because schools are back, and hotel rates reflect that. Halloween Horror Nights, though, is a separately ticketed evening event that draws large local crowds on event nights, and Universal Studios Florida closes early to day guests on those nights to prepare. A September trip gets quiet days and shortened evenings in one park.",
          "The reverse also happens. A quiet-looking weekday can sit inside an expensive week because a convention has filled the hotels. Price tells you what the trip costs. Waits tell you what it will feel like. The two questions are worth answering separately: use the [hotel](/hotels) and [ticket](/tickets) calendars for the first and the [crowd calendar](/crowd-calendar) for the second.",
        ],
      },
      {
        heading: "Weather is part of the price",
        paragraphs: [
          "Some of the cheapest weeks are cheap for a reason. Late August and September are in the peak of the Atlantic hurricane season, and while a direct hit on Orlando is rare, heavy rain and the occasional park closure are possible. Afternoon thunderstorms from June to September routinely close outdoor coasters for an hour or two.",
          "January and early February are the coolest weeks. Days are usually pleasant for walking, mornings can be cold, and pools are heated but not always inviting. For a trip that is about rides more than pools, those weeks are the best combination of price, queue length and comfort in the year.",
        ],
      },
      {
        heading: "If your dates are fixed",
        paragraphs: [
          "Families tied to school holidays cannot move the week, but they still have levers.",
        ],
        bullets: [
          "Move within the holiday. The first and last few days of a school break are usually cheaper than the middle. For Christmas, the week before the 25th is cheaper than the week after.",
          "Change the hotel category. The gap between categories is not constant, and on peak weeks a Value hotel may be the only one that has not doubled.",
          "Shorten the stay and lengthen the ticket. Two nights with three park days, arriving early and leaving late, costs less than three nights.",
          "Decide about Express early. On peak dates it is at its most expensive and at its most useful, so an Express-included hotel is most likely to win the comparison then.",
          "Book refundable and keep watching. Peak-week rates do sometimes soften as the date approaches.",
        ],
      },
      {
        heading: "How to use this site to find your week",
        paragraphs: [
          "Reading the pattern off the actual numbers is better than trusting a seasonal table, including the one above.",
        ],
        bullets: [
          "Open the [hotel calendar](/hotels) and scan the full year for runs of green cells at a hotel you would book.",
          "Check those dates on the [ticket calendar](/tickets). Hotels and admission do not always move together.",
          "Look at the same dates on the [crowd calendar](/crowd-calendar) to see how Universal itself is pricing demand.",
          "Put the best two candidates into the [trip planner](/plan) and compare whole-trip totals.",
          "Confirm the final price with the official seller before booking.",
        ],
      },
    ],
    faq: [
      {
        question: "What is the cheapest month to go to Universal Orlando?",
        answer:
          "In most years the lowest hotel rates and ticket prices fall in late January, early February and September, with early May and late August close behind. The table on this page shows the current month-by-month median from tracked rates.",
      },
      {
        question: "What is the most expensive time to visit Universal Orlando?",
        answer:
          "The week between Christmas and New Year is the most expensive of the year, followed by Easter week, Thanksgiving week and July.",
      },
      {
        question: "Is September a good time to visit Universal Orlando?",
        answer:
          "It is one of the cheapest and least crowded months by day. It is also hot, in hurricane season, and Universal Studios Florida closes early on Halloween Horror Nights event nights.",
      },
    ],
    related: ["choosing-dates-with-prices-and-waits", "how-far-ahead-to-book-universal", "universal-trip-budget-checklist"],
  },
  {
    slug: "how-far-ahead-to-book-universal",
    title: "How far ahead should you book Universal?",
    summary:
      "Why booking early and watching prices are not in conflict, what moves as your dates approach, and a simple routine for getting the lower price either way.",
    category: "timing",
    published: "2026-08-21",
    updated: "2026-11-09",
    takeaways: [
      "Booking early secures the room and the dates. It does not lock you out of a lower price if the booking is refundable.",
      "Hotel rates move in both directions as a date approaches. Ticket prices for a date rarely fall. Express Pass tends to rise and can sell out.",
      "Book the room on flexible terms, buy tickets when dates are firm, decide on Express a few weeks out, then keep watching the room rate.",
      "Price history is what tells you whether today's rate is good. A single number cannot.",
    ],
    sections: [
      {
        heading: "Book early for choice, watch prices for cost",
        paragraphs: [
          "These are two separate decisions that often get muddled together. Booking early secures the hotel and room type you want, which does get harder as popular dates fill. Family suites at Cabana Bay, two-bedroom suites at Endless Summer and standard rooms at the three Express hotels are the first to go on holiday weeks. Booking early does not, in itself, secure the best price.",
          "Most on-site hotel reservations made directly can be changed or cancelled without penalty up to a deadline shown at checkout. That means an early booking is a commitment to a room, not to a rate. If the rate for your dates falls later, you can usually rebook at the lower one and cancel the original, provided the terms allow it. Read the cancellation terms on the rate you choose, because prepaid and package rates can be more restrictive.",
        ],
      },
      {
        heading: "What actually moves as dates approach",
        paragraphs: [
          "The three main products behave differently over time, and treating them the same leads to the wrong move on at least one of them.",
        ],
        table: {
          caption: "How Universal prices behave before the visit",
          head: ["Product", "Typical behaviour", "What to do"],
          rows: [
            ["Hotel rate", "Volatile. Rises when a hotel fills faster than expected, softens when it does not.", "Book refundable early, then watch."],
            ["Park tickets", "Stable per date. Subject to occasional across-the-board increases.", "Buy when dates are firm."],
            ["Express Pass", "Rises with demand for the date. Can sell out, especially at Epic Universe.", "Decide a few weeks out. Do not leave it to the day on busy dates."],
            ["Passholder room rates", "Released in batches for set travel windows.", "Check again when a new offer is announced."],
          ],
        },
        after: [
          "Hotel rates respond to occupancy. Universal's hotels hold a forecast for every night, and when bookings run ahead of it the rate steps up. When bookings lag, discounted rates and passholder offers appear. Neither direction is guaranteed for a given date, and RateCoaster's history charts show both happening regularly.",
        ],
      },
      {
        heading: "Rough timelines that work",
        paragraphs: [
          "There is no single correct lead time, but these ranges fit how the inventory tends to behave.",
        ],
        bullets: [
          "Christmas, Easter, Thanksgiving and mid-summer: book the room six to nine months ahead. Choice is the constraint.",
          "Ordinary school-term dates: two to four months ahead is plenty, and good rates often appear later than that.",
          "Halloween Horror Nights weekends: treat as a peak period for the hotels closest to Universal Studios Florida.",
          "Epic Universe hotels: Helios Grand has only 500 rooms. Book it as early as you would a holiday week.",
          "Flights: outside the scope of the hotel grid, but the [trip planner](/plan) can include a tracked fare from a home airport where one is available.",
        ],
      },
      {
        heading: "A practical routine",
        paragraphs: [
          "The routine that gets the lower price in either direction takes about five minutes a week.",
        ],
        bullets: [
          "Find dates and a hotel that work on the [hotel calendar](/hotels) and book on refundable terms.",
          "On the hotel's page, set a watch for your stay. With a free account, RateCoaster sends an alert when the tracked rate changes.",
          "If the rate drops by an amount worth the effort, make a new booking at the lower rate, confirm it, then cancel the old one. Do it in that order.",
          "If the rate rises, do nothing. You already hold the lower one.",
          "Buy tickets once the dates are certain. Decide on Express once you can see the crowd outlook for your days.",
          "Stop watching when you pass the cancellation deadline.",
        ],
        after: [
          "The same routine works for a passholder. If a passholder rate appears for nights you have already booked at the standard rate, rebook.",
        ],
      },
      {
        heading: "Why history matters more than today's number",
        paragraphs: [
          "A nightly rate on its own says very little. $260 for a Tuesday at Sapphire Falls might be the lowest that night has been in three months or the highest. Without knowing where the price has been, there is no way to judge whether to wait.",
          "That is the reason RateCoaster stores every change instead of only the current value. Each hotel page shows the lowest rate ever recorded for each night beside the current one, and clicking a date draws the history for that night as a step chart. A current rate sitting at or near its recorded low, after months of tracking, is a reasonable signal to book. A rate that jumped last week on a date that is still far off may come back.",
          "History only goes back as far as tracking does. Early in a hotel's record the \"lowest seen\" figure is less meaningful, and it becomes more useful with every month of data behind it.",
        ],
      },
    ],
    faq: [
      {
        question: "Do Universal Orlando hotel prices go down closer to the date?",
        answer:
          "Sometimes. Rates fall when a hotel is filling more slowly than forecast and rise when it is filling faster. Booking a refundable rate early and rebooking if the price drops covers both cases.",
      },
      {
        question: "Can I cancel a Universal Orlando hotel booking?",
        answer:
          "Most direct room-only bookings can be cancelled without penalty up to a deadline stated at checkout. Packages and prepaid rates can have stricter terms, so read them before booking.",
      },
      {
        question: "When should I buy Express Pass?",
        answer:
          "A few weeks before the visit is a reasonable point: early enough that it has not sold out or peaked, late enough that you can see how busy the dates are expected to be.",
      },
    ],
    related: ["cheapest-time-to-visit-universal-orlando", "how-ratecoaster-compares-prices", "standard-vs-passholder-hotel-rates"],
  },
  {
    slug: "choosing-dates-with-prices-and-waits",
    title: "Choosing trip dates with prices and wait times",
    summary:
      "A method for combining the hotel, ticket, Express and crowd calendars with live wait data, so you are not optimising one number at the expense of the trip.",
    category: "timing",
    published: "2026-08-21",
    updated: "2026-11-09",
    takeaways: [
      "One cheap hotel night does not make a cheap trip. Look for a run of nights where the same room is available throughout.",
      "The crowd calendar reads Universal's own pricing as a demand signal. It is an outlook, not a wait-time promise.",
      "Live waits describe today. Their value for planning is in the comparison with what is typical for that hour and that park.",
      "Decide what you are optimising for first: lowest total, shortest queues, or a fixed set of dates.",
    ],
    live: "crowd-outlook",
    sections: [
      {
        heading: "Start with the calendar, not a single deal",
        paragraphs: [
          "The lowest number on the hotel grid is rarely a trip. It is usually one Tuesday surrounded by ordinary nights. What you want is a run of nights, as long as your stay, where the rate is low across the run and one room type is available on every night of it.",
          "The second condition is stricter than it sounds. The cheapest room on Monday may be a standard queen and the cheapest on Tuesday a different room because the first has sold out. Adding those two prices together describes a stay nobody can book. The [trip planner](/plan) requires a complete same-room stay for exactly that reason, and it will tell you when the dates you picked have no single room type available throughout.",
          "Once you have two or three candidate runs, check the first park day of each on the [ticket calendar](/tickets). Admission is priced by its start date, and a run that begins on a peak-priced Saturday can cost more in tickets than it saves in rooms.",
        ],
      },
      {
        heading: "What the crowd calendar is measuring",
        paragraphs: [
          "Universal does not publish daily attendance. What it does publish, for every date it sells, is three prices: admission, Express Pass and on-site hotel rooms. All three are set by Universal's own demand forecasts. When the company expects a busy day, it charges more for all of them.",
          "The [crowd calendar](/crowd-calendar) reads those three signals together for each park and each date and turns them into a score from 1 to 10 with a label from very low to very high. A score built from all three signals is more reliable than one built from a single price, and RateCoaster records which signals were available for each date.",
          "This makes it a reading of what Universal expects, months ahead, with real money behind the forecast. It is not a measurement of how many people turned up, and it cannot see a ride breakdown, a storm, or a viral reason for one attraction to be mobbed. Use it to rank your candidate dates against each other. Do not use it to predict a particular queue.",
        ],
      },
      {
        heading: "Use waits as context",
        paragraphs: [
          "Live waits describe what is happening now. They cannot tell you what a date three months away will be like. They are still useful for planning, in three ways.",
        ],
        bullets: [
          "They show how differently the parks behave on the same day. Epic Universe, Islands of Adventure and Universal Studios Florida often sit at quite different levels at the same hour.",
          "Each ride page compares the current wait with the typical wait for that hour, built from stored history. A ride well above its typical wait is a sign of a busy day or a recent breakdown. A ride well below it is the one to do next.",
          "Watching the same weekday for a few weeks before your trip gives a feel for the daily rhythm: when the headline rides peak, and how much they fall in the last hour.",
        ],
        after: [
          "RateCoaster's park averages include only operating attractions with a posted wait. Closed and temporarily unavailable rides are left out, so a park average is not dragged down by a ride that is not running. The attraction list beneath it shows whether a couple of headline rides are responsible for a high average.",
        ],
      },
      {
        heading: "Decide what you are optimising",
        paragraphs: [
          "Different travellers should read the same calendars differently, and it helps to say out loud which kind you are.",
          "A family with fixed school dates cannot move the week. Their levers are hotel category, ticket length, which days go to which park, and whether to buy Express. For them the crowd calendar is a tool for assigning parks to days inside a fixed window: put the park you care about most on the lowest-scored day.",
          "A flexible traveller should scan the whole year for low hotel and ticket combinations first, shortlist a few weeks, and only then look at crowd scores to break the tie. Starting from crowd scores tends to lead back to the same handful of January and September weeks, which are already the cheap ones.",
          "Someone on a once-only trip may reasonably choose a quieter, more expensive week over a cheaper, busier one. The calendars make the price of that choice visible, which is all they need to do.",
        ],
      },
      {
        heading: "A sequence that works",
        paragraphs: [
          "Put together, the method is short.",
        ],
        bullets: [
          "Find complete hotel availability for the whole stay at a hotel you would book.",
          "Check the ticket price on the intended first park day and the days either side.",
          "Look up the crowd score for each park day and assign your priority park to the lowest.",
          "Price Express only for the parks and days where you would use it, and compare with an Express-included hotel.",
          "Save the trip in the planner and set a watch on the dates if you are not ready to book.",
        ],
      },
      {
        heading: "Things no calendar can tell you",
        paragraphs: [
          "A few factors sit outside price and crowd data and are worth a quick check once you have dates in mind. Look at Universal's park hours for your days, since shorter hours compress the same crowd into less time. Look for separately ticketed events that close a park early to day guests. Check the refurbishment list for the rides that matter most to your party, because a long-planned trip built around one coaster is spoiled by finding it closed. As of late 2026 that list includes all of Volcano Bay, which is shut until spring 2027.",
        ],
      },
    ],
    faq: [
      {
        question: "How accurate is the RateCoaster crowd calendar?",
        answer:
          "It reflects Universal's own demand expectations as expressed through admission, Express Pass and hotel pricing. It is a relative outlook for comparing dates and is not a measurement of attendance or a prediction of specific wait times.",
      },
      {
        question: "Are cheap dates always less crowded at Universal Orlando?",
        answer:
          "Usually, because Universal prices by expected demand. Evening events and conventions can break the link, so check the crowd outlook and park hours as well as the price.",
      },
      {
        question: "Which day of the week is least busy at Universal Orlando?",
        answer:
          "Midweek days, Tuesday to Thursday, are generally the quietest and Saturdays the busiest, though holiday weeks are busy every day.",
      },
    ],
    related: ["cheapest-time-to-visit-universal-orlando", "reading-wait-times-like-a-local", "how-far-ahead-to-book-universal"],
  },
];
