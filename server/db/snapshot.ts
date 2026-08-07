import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { env } from "../env";

/**
 * The pre-seeded database that ships with the repository, as a gzipped
 * PGlite data directory. Committing this one file instead of the ~1 000 loose
 * files of a live PGDATA keeps the clone small and lets git treat it as a
 * single binary blob.
 */
export const SNAPSHOT_PATH = resolve(process.cwd(), "data/sitesignal-seed.tar.gz");

export function hasSnapshot(): boolean {
  return existsSync(SNAPSHOT_PATH);
}

export function hasLiveDataDir(): boolean {
  // PGlite writes PG_VERSION last during initdb, so its presence is the
  // cheapest reliable "this directory is a usable cluster" signal.
  return existsSync(resolve(env.pgliteDir, "PG_VERSION"));
}

/**
 * Materialises the shipped snapshot into PGLITE_DIR.
 *
 * Only called when there is no live data directory yet, so it never overwrites
 * a database the user has been working against.
 */
export async function restoreSnapshot(): Promise<void> {
  const { PGlite } = await import("@electric-sql/pglite");
  const bytes = readFileSync(SNAPSHOT_PATH);
  const blob = new Blob([new Uint8Array(bytes)], { type: "application/gzip" });

  const pg = await PGlite.create(env.pgliteDir, { loadDataDir: blob });
  await pg.waitReady;
  await pg.close();
}
