import { dateRange, dayOfWeek, daysBetween } from "../collectors/framework/dates.js";

export type CrowdSignal = "ticket" | "express" | "hotel";
export type CrowdLevel = "very-low" | "low" | "moderate" | "high" | "very-high";

export interface CrowdInputs {
  from: string;
  to: string;
  ticketByDate: ReadonlyMap<string, { value: number; available: boolean }>;
  expressByDate: ReadonlyMap<string, { value: number; available: boolean }>;
  hotelByDate: ReadonlyMap<string, number>;
}

export interface CrowdDay {
  date: string;
  score: number;
  level: CrowdLevel;
  confidence: "low" | "medium" | "high";
  signals: CrowdSignal[];
}

function normalized(value: number, values: number[]): number {
  const low = Math.min(...values);
  const high = Math.max(...values);
  // A flat price does not say "empty" or "packed". It contributes a neutral
  // signal while the other demand signals and day-of-week pattern do their job.
  if (high === low) return 0.5;
  return (value - low) / (high - low);
}

function weekdayPressure(date: string): number {
  // 0 is Sunday, matching the data warehouse and the resort's local calendar.
  switch (dayOfWeek(date)) {
    case 6: return 0.82; // Saturday
    case 0: return 0.7; // Sunday
    case 5: return 0.62; // Friday
    case 1: return 0.46; // Monday
    case 4: return 0.44; // Thursday
    default: return 0.32; // Tuesday / Wednesday
  }
}

export function crowdLevel(score: number): CrowdLevel {
  if (score <= 2) return "very-low";
  if (score <= 4) return "low";
  if (score <= 6) return "moderate";
  if (score <= 8) return "high";
  return "very-high";
}

/**
 * Forecast crowd pressure from first-party Universal demand signals.
 *
 * This deliberately does not claim to know a future wait time. Published
 * admission, Express and hotel demand all move with expected attendance, and
 * their agreement is a useful planning signal; live waits remain the source of
 * truth for what is happening in the park right now.
 */
export function buildCrowdCalendar(input: CrowdInputs): CrowdDay[] {
  const dates = dateRange(input.from, daysBetween(input.from, input.to) + 1);
  const ticketValues = [...input.ticketByDate.values()]
    .filter((value) => value.available)
    .map((value) => value.value);
  const expressValues = [...input.expressByDate.values()]
    .filter((value) => value.available)
    .map((value) => value.value);
  const hotelValues = [...input.hotelByDate.values()];

  return dates.map((date) => {
    const ticket = input.ticketByDate.get(date);
    const express = input.expressByDate.get(date);
    const hotel = input.hotelByDate.get(date);
    const signals: CrowdSignal[] = [];
    const parts: Array<{ value: number; weight: number }> = [
      { value: weekdayPressure(date), weight: 0.16 },
    ];

    if (ticket) {
      signals.push("ticket");
      parts.push({
        value: ticket.available && ticketValues.length ? normalized(ticket.value, ticketValues) : 1,
        weight: 0.42,
      });
    }
    if (express) {
      signals.push("express");
      parts.push({
        value: express.available && expressValues.length ? normalized(express.value, expressValues) : 1,
        weight: 0.25,
      });
    }
    if (hotel !== undefined && hotelValues.length) {
      signals.push("hotel");
      parts.push({ value: normalized(hotel, hotelValues), weight: 0.17 });
    }

    const totalWeight = parts.reduce((total, part) => total + part.weight, 0);
    const pressure = parts.reduce((total, part) => total + part.value * part.weight, 0) / totalWeight;
    const score = Math.max(1, Math.min(10, Math.round((1 + pressure * 9) * 10) / 10));

    return {
      date,
      score,
      level: crowdLevel(score),
      confidence: signals.length >= 3 ? "high" : signals.length >= 2 ? "medium" : "low",
      signals,
    };
  });
}
