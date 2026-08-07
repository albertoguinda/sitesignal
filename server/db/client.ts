import { mkdirSync } from "node:fs";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { env } from "../env";
import { schema } from "./schema";

/**
 * One Drizzle instance, two drivers.
 *
 * Without DATABASE_URL the app runs on PGlite — a real Postgres compiled to
 * WASM, persisted to disk — so `npm install && npm run dev` produces a working,
 * fully seeded database with no server to provision. Set DATABASE_URL and the
 * exact same schema, migrations and queries run against node-postgres instead.
 */
export type Schema = typeof schema;

/**
 * The driver-agnostic surface. Both `PgliteDatabase` and `NodePgDatabase` are
 * `PgDatabase` specialisations; widening to the base here means call sites see
 * one type instead of a union, which would break Drizzle's overload resolution.
 */
export type Database = PgDatabase<PgQueryResultHKT, Schema>;

export interface DatabaseHandle {
  driver: "pglite" | "postgres";
  db: Database;
  close: () => Promise<void>;
}

async function createEmbedded(): Promise<DatabaseHandle> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");

  mkdirSync(env.pgliteDir, { recursive: true });
  const client = new PGlite(env.pgliteDir);
  await client.waitReady;

  return {
    driver: "pglite",
    db: drizzle(client, { schema }),
    close: () => client.close(),
  };
}

/** host:port from a connection string, never the credentials. */
function safeHost(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname;
  } catch {
    return "unparseable URL";
  }
}

async function createPostgres(url: string): Promise<DatabaseHandle> {
  const { default: pg } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");

  // connectionTimeoutMillis matters on a container: without it an unroutable
  // host hangs the boot instead of failing it.
  const pool = new pg.Pool({ connectionString: url, max: 10, connectionTimeoutMillis: 5_000 });

  // Surface connection problems at boot instead of on the first request, and
  // say something the person who pasted the connection string can act on.
  try {
    const probe = await pool.connect();
    probe.release();
  } catch (error) {
    await pool.end().catch(() => undefined);
    const host = safeHost(url);
    throw new Error(
      `Cannot reach the Postgres in DATABASE_URL (${host}): ${(error as Error).message}. ` +
        `Fix the connection string, or unset DATABASE_URL to fall back to the bundled embedded database.`,
      { cause: error },
    );
  }

  return {
    driver: "postgres",
    db: drizzle(pool, { schema }),
    close: () => pool.end(),
  };
}

export async function createDatabase(): Promise<DatabaseHandle> {
  return env.DATABASE_URL ? createPostgres(env.DATABASE_URL) : createEmbedded();
}

let handle: DatabaseHandle | null = null;

/** Lazily created singleton — shared by the HTTP server, migrator and seeder. */
export async function getDatabase(): Promise<DatabaseHandle> {
  handle ??= await createDatabase();
  return handle;
}

export async function closeDatabase(): Promise<void> {
  if (!handle) return;
  await handle.close();
  handle = null;
}
