import { z } from "zod";
import { GateInfo } from "./auth.js";
import { IsoDate, IsoInstant } from "./common.js";
import { Park } from "./waits.js";

export const CrowdLevel = z.enum(["very-low", "low", "moderate", "high", "very-high"]);
export type CrowdLevel = z.infer<typeof CrowdLevel>;

export const CrowdCalendarDay = z.object({
  date: IsoDate,
  /** A relative 1–10 planning score, not a predicted wait time. */
  score: z.number().min(1).max(10),
  level: CrowdLevel,
  /** How many independent published demand signals were available for this day. */
  confidence: z.enum(["low", "medium", "high"]),
  signals: z.array(z.enum(["ticket", "express", "hotel"])),
});
export type CrowdCalendarDay = z.infer<typeof CrowdCalendarDay>;

export const CrowdCalendarResponse = z.object({
  park: Park,
  days: z.array(CrowdCalendarDay),
  updatedAt: IsoInstant.nullable(),
  gate: GateInfo,
});
export type CrowdCalendarResponse = z.infer<typeof CrowdCalendarResponse>;

export const CrowdCalendarQuery = z.object({
  parkSlug: z.string().optional(),
  from: IsoDate.optional(),
  to: IsoDate.optional(),
});
export type CrowdCalendarQuery = z.infer<typeof CrowdCalendarQuery>;
