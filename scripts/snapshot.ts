import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { env } from "../server/env";
import { SNAPSHOT_PATH } from "../server/db/snapshot";

/**
 * Writes the seeded PGlite directory out as a single gzipped tarball.
 *
 * The repository ships that tarball instead of the ~1 000 loose files of a
 * live PGDATA: it is one binary artefact git handles cleanly, it clones in a
 * fraction of the time, and `server/db/snapshot.ts` expands it on first boot so
 * a fork lands on a full dashboard without running the seeder.
 *
 * Regenerate with `npm run db:snapshot` after changing the schema or the seed.
 */
async function main(): Promise<void> {
  const pg = new PGlite(env.pgliteDir);
  await pg.waitReady;

  const counts = await pg.query<{ readings: number; assets: number }>(
    "select (select count(*)::int from readings) as readings, (select count(*)::int from assets) as assets",
  );
  const row = counts.rows[0];
  if (!row || row.readings === 0) {
    throw new Error(`No data in ${env.pgliteDir} — run \`npm run db:reset\` first`);
  }

  const blob = await pg.dumpDataDir("gzip");
  const bytes = Buffer.from(await blob.arrayBuffer());
  mkdirSync(dirname(SNAPSHOT_PATH), { recursive: true });
  writeFileSync(SNAPSHOT_PATH, bytes);
  await pg.close();

  console.log(
    `[snapshot] ${row.assets} assets · ${row.readings.toLocaleString("en-US")} readings · ` +
      `${(bytes.length / 1_048_576).toFixed(1)} MB → ${SNAPSHOT_PATH}`,
  );
}

main().catch((error: unknown) => {
  console.error("[snapshot] failed:", error);
  process.exit(1);
});
