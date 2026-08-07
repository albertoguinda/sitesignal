import { resolve } from "node:path";
import { getDatabase, closeDatabase } from "./client";

const MIGRATIONS_FOLDER = resolve(process.cwd(), "drizzle");

/**
 * Applies the generated SQL migrations with the migrator that matches the
 * active driver. Idempotent: Drizzle keeps its own applied-migrations table.
 */
export async function runMigrations(): Promise<void> {
  const handle = await getDatabase();

  if (handle.driver === "pglite") {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(handle.db as never, { migrationsFolder: MIGRATIONS_FOLDER });
    return;
  }

  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  await migrate(handle.db as never, { migrationsFolder: MIGRATIONS_FOLDER });
}

const isDirectRun = process.argv[1]?.replace(/\\/g, "/").endsWith("server/db/migrate.ts");

if (isDirectRun) {
  runMigrations()
    .then(() => console.log("[db] migrations applied"))
    .catch((error: unknown) => {
      console.error("[db] migration failed:", error);
      process.exitCode = 1;
    })
    .finally(() => closeDatabase());
}
