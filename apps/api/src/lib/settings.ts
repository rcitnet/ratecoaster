import { eq } from "drizzle-orm";
import { getDb } from "@ratecoaster/db";
import { collectorSettings, endpointConfigs } from "@ratecoaster/db/schema";
import { EndpointConfig, loadEndpointConfig as loadFromFile } from "../collectors/hotels/endpoint-config.js";

/**
 * Endpoint configs and collector settings, read from the database with the
 * original file-based config as a fallback.
 *
 * The fallback is not politeness — it means an existing deployment that has
 * only `config/endpoints/*.json` keeps working after this upgrade, with no
 * migration step and no window where collectors silently stop.
 */

export interface CollectorSetting {
  collector: string;
  enabled: boolean;
  dryRun: boolean;
  intervalMinutes: number | null;
}

/**
 * Dry-run defaults to TRUE for anything not explicitly configured.
 *
 * The safe default matters more than the convenient one: a collector that has
 * never been reviewed should log what it would fetch, not fetch it.
 */
export async function getCollectorSetting(collector: string): Promise<CollectorSetting> {
  const rows = await getDb()
    .select()
    .from(collectorSettings)
    .where(eq(collectorSettings.collector, collector))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return { collector, enabled: true, dryRun: true, intervalMinutes: null };
  }
  return {
    collector: row.collector,
    enabled: row.enabled,
    dryRun: row.dryRun,
    intervalMinutes: row.intervalMinutes,
  };
}

export async function getAllCollectorSettings(): Promise<Map<string, CollectorSetting>> {
  const rows = await getDb().select().from(collectorSettings);
  return new Map(
    rows.map((r) => [
      r.collector,
      {
        collector: r.collector,
        enabled: r.enabled,
        dryRun: r.dryRun,
        intervalMinutes: r.intervalMinutes,
      },
    ])
  );
}

export async function setCollectorSetting(
  collector: string,
  patch: Partial<Pick<CollectorSetting, "enabled" | "dryRun" | "intervalMinutes">>,
  updatedBy?: string
): Promise<void> {
  await getDb()
    .insert(collectorSettings)
    .values({
      collector,
      enabled: patch.enabled ?? true,
      dryRun: patch.dryRun ?? true,
      intervalMinutes: patch.intervalMinutes ?? null,
      updatedBy: updatedBy ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: collectorSettings.collector,
      set: {
        ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
        ...(patch.dryRun !== undefined ? { dryRun: patch.dryRun } : {}),
        ...(patch.intervalMinutes !== undefined
          ? { intervalMinutes: patch.intervalMinutes }
          : {}),
        updatedBy: updatedBy ?? null,
        updatedAt: new Date(),
      },
    });
}

/* ------------------------------------------------------------------ *
 * Endpoint configs
 * ------------------------------------------------------------------ */

export async function loadEndpointConfigFromDb(name: string): Promise<EndpointConfig | null> {
  const rows = await getDb()
    .select()
    .from(endpointConfigs)
    .where(eq(endpointConfigs.name, name))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const parsed = EndpointConfig.safeParse(row.config);
  if (!parsed.success) {
    // A malformed row must not take the collector down; log loudly and let the
    // file fallback handle it.
    console.error(`[settings] endpoint config "${name}" in the database is invalid:`, parsed.error.message);
    return null;
  }
  return parsed.data;
}

/** Database first, file second. */
export async function resolveEndpointConfig(name: string): Promise<EndpointConfig | null> {
  return (await loadEndpointConfigFromDb(name)) ?? (await loadFromFile(name));
}

export async function listEndpointConfigs() {
  return getDb()
    .select({
      name: endpointConfigs.name,
      notes: endpointConfigs.notes,
      lastTestedAt: endpointConfigs.lastTestedAt,
      lastTestOk: endpointConfigs.lastTestOk,
      lastTestMessage: endpointConfigs.lastTestMessage,
      updatedAt: endpointConfigs.updatedAt,
    })
    .from(endpointConfigs);
}

export async function saveEndpointConfig(
  name: string,
  config: unknown,
  updatedBy?: string,
  notes?: string
): Promise<EndpointConfig> {
  // Validate before storing. A config that cannot parse is a config that will
  // fail at 3am inside a cron job instead of here, in front of a person.
  const parsed = EndpointConfig.parse(config);

  await getDb()
    .insert(endpointConfigs)
    .values({
      name,
      config: parsed as unknown as Record<string, unknown>,
      notes: notes ?? null,
      updatedBy: updatedBy ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: endpointConfigs.name,
      set: {
        config: parsed as unknown as Record<string, unknown>,
        notes: notes ?? null,
        updatedBy: updatedBy ?? null,
        updatedAt: new Date(),
      },
    });

  return parsed;
}

export async function recordEndpointTest(
  name: string,
  ok: boolean,
  message: string
): Promise<void> {
  await getDb()
    .update(endpointConfigs)
    .set({ lastTestedAt: new Date(), lastTestOk: ok, lastTestMessage: message.slice(0, 500) })
    .where(eq(endpointConfigs.name, name));
}
