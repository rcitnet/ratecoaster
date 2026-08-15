/**
 * Real upstream payloads, captured 2026-08-06.
 *
 * Fixtures taken from live responses rather than hand-written, because the
 * things that break parsers are exactly the things you would not invent:
 * trademark symbols in names, curly apostrophes, single-rider queues modelled
 * as separate rides, closed rides reporting `wait_time: 0`, and SHOW entities
 * with no queue at all. All of those are present below.
 */

/** queue-times.com/parks/334/queue_times.json — Universal Epic Universe */
export const QUEUE_TIMES_EPIC_UNIVERSE = {
  lands: [
    {
      id: 976,
      name: "Celestial Park",
      rides: [
        {
          id: 14688,
          name: "Constellation Carousel",
          is_open: true,
          wait_time: 20,
          last_updated: "2026-08-05T23:31:34.000Z",
        },
        {
          id: 14690,
          name: "Stardust Racers",
          is_open: false,
          wait_time: 0,
          last_updated: "2026-08-05T23:31:34.000Z",
        },
      ],
    },
    {
      id: 975,
      name: "Dark Universe",
      rides: [
        {
          id: 14692,
          name: "Curse of the Werewolf",
          is_open: false,
          wait_time: 0,
          last_updated: "2026-08-05T23:31:34.000Z",
        },
        {
          id: 14698,
          name: "Curse of the Werewolf Single Rider",
          is_open: false,
          wait_time: 0,
          last_updated: "2026-08-05T23:16:54.000Z",
        },
        {
          id: 14694,
          name: "Monsters Unchained: The Frankenstein Experiment",
          is_open: true,
          wait_time: 10,
          last_updated: "2026-08-05T23:31:34.000Z",
        },
        {
          id: 16644,
          name: "Monsters Unchained: The Frankenstein Experiment Single Rider",
          is_open: true,
          wait_time: 0,
          last_updated: "2026-08-01T01:01:37.000Z",
        },
      ],
    },
    {
      id: 973,
      name: "SUPER NINTENDO WORLD",
      rides: [
        {
          id: 14683,
          name: "Mario Kart™: Bowser's Challenge",
          is_open: true,
          wait_time: 50,
          last_updated: "2026-08-05T23:31:34.000Z",
        },
        {
          id: 14684,
          name: "Mario Kart™: Bowser's Challenge Single Rider",
          is_open: true,
          wait_time: 15,
          last_updated: "2026-08-05T23:31:34.000Z",
        },
      ],
    },
    {
      id: 972,
      name: "The Wizarding World of Harry Potter — Ministry of Magic",
      rides: [
        {
          id: 14687,
          name: "Harry Potter and the Battle at the Ministry™",
          is_open: true,
          wait_time: 90,
          last_updated: "2026-08-05T23:31:34.000Z",
        },
      ],
    },
  ],
  rides: [],
};

/** api.themeparks.wiki/v1/entity/{ush}/live — Universal Studios Hollywood */
export const THEMEPARKS_WIKI_HOLLYWOOD = {
  id: "bc4005c5-8c7e-41d7-b349-cdddf1796427",
  name: "Universal Studios Hollywood",
  entityType: "PARK",
  timezone: "America/Los_Angeles",
  liveData: [
    {
      id: "7254c0aa-f0ec-4964-8a44-5c959f786616",
      name: "DinoPlay",
      entityType: "ATTRACTION",
      externalId: "ush.lower_lot.rides.dinoplay",
      status: "CLOSED",
      lastUpdated: "2026-04-20T09:30:56.228Z",
    },
    {
      id: "da1191d8-63b0-45eb-bccf-968b0ea4c5d8",
      name: "Mario Kart™: Bowser’s Challenge",
      entityType: "ATTRACTION",
      externalId: "ush.upper_lot.rides.mario_kart_bowsers_challenge",
      queue: { STANDBY: { waitTime: 125 } },
      status: "OPERATING",
      lastUpdated: "2026-08-06T22:03:59.074Z",
    },
    {
      id: "8215f2cf-6356-421d-80fa-0e9b26f57bcd",
      name: "Revenge of the Mummy – The Ride",
      entityType: "ATTRACTION",
      externalId: "ush.lower_lot.rides.revenge_of_the_mummy_the_ride",
      queue: { STANDBY: { waitTime: 45 }, SINGLE_RIDER: { waitTime: 10 } },
      status: "OPERATING",
      lastUpdated: "2026-08-06T21:37:28.550Z",
    },
    {
      id: "3ee11862-1f2b-4a4f-8abd-9b96bc9e3787",
      name: "WaterWorld",
      entityType: "SHOW",
      externalId: "ush.upper_lot.shows.waterworld",
      status: "OPERATING",
      showtimes: [
        {
          type: "Performance Time",
          endTime: "2026-08-06T16:45:00-07:00",
          startTime: "2026-08-06T16:45:00-07:00",
        },
      ],
      lastUpdated: "2026-08-06T21:30:43.300Z",
    },
    {
      id: "01b6ad76-93a5-46f2-b3d9-6121ab024326",
      name: "Raptor Encounter",
      entityType: "SHOW",
      externalId: "ush.shows.raptor_encounter",
      status: "OPERATING",
      lastUpdated: "2026-08-06T22:32:06.545Z",
    },
    {
      id: "bf4b4ea2-68da-435d-accb-69371bf44def",
      name: "Meet Mario and Luigi",
      entityType: "SHOW",
      externalId: "ush.upper_lot.shows.meet_mario_and_luigi",
      status: "OPERATING",
      lastUpdated: "2026-08-06T19:30:21.752Z",
    },
  ],
};
