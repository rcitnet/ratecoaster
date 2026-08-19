import { and, eq, sql } from "drizzle-orm";
import type { RateSource } from "@ratecoaster/shared";
import {
  ticketPriceCurrent,
  ticketPriceObservations,
} from "@ratecoaster/db/schema";
import type { CollectorContext } from "../framework/types.js";

export interface TicketPriceReading {
  productId: string;
  validDate: string;
  guestCategory: "adult" | "child" | "all-ages";
  /** The storefront's displayed per-day price. */
  priceCents: number;
  /** Exact full-ticket price, especially important for multi-day products. */
  totalCents: number | null;
  available: boolean;
  source?: RateSource;
  isEstimated?: boolean;
  merchant?: string | null;
}

/** Write-on-change persistence shared by first-party ticket adapters. */
export async function persistTicketPrice(
  ctx: CollectorContext,
  reading: TicketPriceReading
): Promise<void> {
  const { db, stats } = ctx;
  const source = reading.source ?? "observed";
  const isEstimated = reading.isEstimated ?? false;
  const merchant = reading.merchant ?? null;

  const existing = await db
    .select({
      priceCents: ticketPriceCurrent.priceCents,
      totalCents: ticketPriceCurrent.totalCents,
      available: ticketPriceCurrent.available,
      source: ticketPriceCurrent.source,
    })
    .from(ticketPriceCurrent)
    .where(
      and(
        eq(ticketPriceCurrent.productId, reading.productId),
        eq(ticketPriceCurrent.validDate, reading.validDate),
        eq(ticketPriceCurrent.guestCategory, reading.guestCategory)
      )
    )
    .limit(1);

  const prev = existing[0];
  const changed =
    !prev ||
    prev.priceCents !== reading.priceCents ||
    prev.totalCents !== reading.totalCents ||
    prev.available !== reading.available ||
    prev.source !== source;

  if (changed) {
    await db.insert(ticketPriceObservations).values({
      productId: reading.productId,
      validDate: reading.validDate,
      guestCategory: reading.guestCategory,
      priceCents: reading.priceCents,
      totalCents: reading.totalCents,
      available: reading.available,
      source,
      isEstimated,
      merchant,
    });
    stats.writtenCount++;
  }

  await db
    .insert(ticketPriceCurrent)
    .values({
      productId: reading.productId,
      validDate: reading.validDate,
      guestCategory: reading.guestCategory,
      priceCents: reading.priceCents,
      totalCents: reading.totalCents,
      previousCents: prev?.priceCents ?? null,
      available: reading.available,
      source,
      isEstimated,
      merchant,
      observedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        ticketPriceCurrent.productId,
        ticketPriceCurrent.validDate,
        ticketPriceCurrent.guestCategory,
      ],
      set: {
        priceCents: reading.priceCents,
        totalCents: reading.totalCents,
        available: reading.available,
        source,
        isEstimated,
        merchant,
        previousCents: changed
          ? (prev?.priceCents ?? null)
          : sql`${ticketPriceCurrent.previousCents}`,
        observedAt: new Date(),
      },
    });
}
