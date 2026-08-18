import { and, eq } from "drizzle-orm";
import { roomTypes } from "@ratecoaster/db/schema";
import type { CollectorContext } from "../framework/types.js";

const roomTypeCache = new Map<string, string>();

/** Resolve the operator's room code to RateCoaster's stable room-type id. */
export async function upsertRoomType(
  ctx: CollectorContext,
  propertyId: string,
  externalCode: string,
  name: string,
  maxOccupancy: number | null
): Promise<string> {
  const key = `${propertyId}:${externalCode}`;
  const cached = roomTypeCache.get(key);
  if (cached) return cached;

  const existing = await ctx.db
    .select({ id: roomTypes.id })
    .from(roomTypes)
    .where(and(eq(roomTypes.propertyId, propertyId), eq(roomTypes.externalCode, externalCode)))
    .limit(1);

  if (existing[0]) {
    roomTypeCache.set(key, existing[0].id);
    return existing[0].id;
  }

  const [created] = await ctx.db
    .insert(roomTypes)
    .values({ propertyId, externalCode, name, maxOccupancy })
    .onConflictDoUpdate({
      target: [roomTypes.propertyId, roomTypes.externalCode],
      set: { name, maxOccupancy },
    })
    .returning({ id: roomTypes.id });

  const id = created!.id;
  roomTypeCache.set(key, id);
  return id;
}
