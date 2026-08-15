import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export * as schema from "./schema.js";
export * from "./schema.js";

let _client: postgres.Sql | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getConnectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env, or run `docker compose up -d db`."
    );
  }
  return url;
}

/**
 * Lazily-created singleton pool.
 *
 * The collectors are long-running batch jobs and the API is request/response;
 * both want a pool rather than a connection per call, and both want the same
 * one when they run in the same process during development.
 */
export function getDb() {
  if (!_db) {
    _client = postgres(getConnectionString(), {
      max: Number(process.env.DB_POOL_MAX ?? 10),
      idle_timeout: 20,
      // Dates come back as `YYYY-MM-DD` strings rather than JS Dates, which is
      // what we want: a stay date has no timezone and must not acquire one.
      types: {
        date: {
          to: 1082,
          from: [1082],
          serialize: (v: string) => v,
          parse: (v: string) => v,
        },
      },
    });
    _db = drizzle(_client, { schema });
  }
  return _db;
}

export async function closeDb() {
  await _client?.end({ timeout: 5 });
  _client = null;
  _db = null;
}

export type Db = ReturnType<typeof getDb>;
