import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { closeDb, getDb } from "./index.js";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(here, "../drizzle");

async function main() {
  if (!existsSync(resolve(migrationsFolder, "meta/_journal.json"))) {
    console.error(
      `No generated Drizzle migrations found in ${migrationsFolder}. ` +
        "Run `npm run db:generate` to create versioned migrations first."
    );
    process.exit(1);
  }

  const db = getDb();
  await migrate(db, { migrationsFolder });
  console.log(`applied Drizzle migrations from ${migrationsFolder}`);
  await closeDb();
}

main().catch(async (err) => {
  console.error(err);
  await closeDb();
  process.exit(1);
});
