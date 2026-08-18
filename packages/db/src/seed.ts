import { closeDb, getDb } from "./index.js";
import { parks, properties, ticketProducts } from "./schema.js";
import { PARKS, PROPERTIES, TICKET_PRODUCTS } from "./seed-data.js";

/**
 * Idempotent seed. Safe to re-run: reference rows are upserted on their slug so
 * you can add a hotel or fix a tier and re-seed without touching observations.
 */
async function main() {
  const db = getDb();

  for (const p of PROPERTIES) {
    await db
      .insert(properties)
      .values({
        destination: p.destination,
        slug: p.slug,
        name: p.name,
        tier: p.tier,
        operator: p.operator,
        onSite: p.onSite,
        includesExpressPass: p.includesExpressPass,
        earlyParkAdmission: p.earlyParkAdmission,
        roomCount: p.roomCount,
        latitude: p.latitude,
        longitude: p.longitude,
        collectorConfig: p.collectorConfig,
      })
      .onConflictDoUpdate({
        target: properties.slug,
        set: {
          name: p.name,
          tier: p.tier,
          operator: p.operator,
          includesExpressPass: p.includesExpressPass,
          earlyParkAdmission: p.earlyParkAdmission,
          roomCount: p.roomCount,
          collectorConfig: p.collectorConfig,
        },
      });
  }
  console.log(`seeded ${PROPERTIES.length} properties`);

  for (const p of PARKS) {
    await db
      .insert(parks)
      .values({
        destination: p.destination,
        slug: p.slug,
        name: p.name,
        timezone: p.timezone,
        queueTimesId: p.queueTimesId,
        themeParksWikiId: p.themeParksWikiId,
      })
      .onConflictDoUpdate({
        target: parks.slug,
        set: {
          name: p.name,
          queueTimesId: p.queueTimesId,
          themeParksWikiId: p.themeParksWikiId,
        },
      });
  }
  console.log(`seeded ${PARKS.length} parks`);

  for (const t of TICKET_PRODUCTS) {
    await db
      .insert(ticketProducts)
      .values({
        destination: t.destination,
        slug: t.slug,
        name: t.name,
        kind: t.kind,
        days: t.days,
        parkCount: t.parkCount,
        collectorConfig: t.collectorConfig,
      })
      .onConflictDoUpdate({
        target: ticketProducts.slug,
        set: { name: t.name, kind: t.kind, days: t.days, parkCount: t.parkCount },
      });
  }
  console.log(`seeded ${TICKET_PRODUCTS.length} ticket products`);

  await closeDb();
}

main().catch(async (err) => {
  console.error(err);
  await closeDb();
  process.exit(1);
});
