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
}).superRefine((query, ctx) => {
  for (const key of ["from", "to"] as const) {
    const value = query[key];
    if (!value) continue;
    const date = new Date(`${value}T00:00:00Z`);
    if (value.startsWith("0000") || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: "expected a real calendar date" });
    }
  }
  if (query.from && query.to) {
    const days = (Date.parse(`${query.to}T00:00:00Z`) - Date.parse(`${query.from}T00:00:00Z`)) / 86_400_000;
    if (days < 0 || days > 365) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["to"], message: "request up to 366 days in chronological order" });
    }
  }
});
export type CrowdCalendarQuery = z.infer<typeof CrowdCalendarQuery>;
