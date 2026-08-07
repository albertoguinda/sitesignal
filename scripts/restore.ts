import { rmSync } from "node:fs";
import { env } from "../server/env";
import { hasSnapshot, restoreSnapshot, SNAPSHOT_PATH } from "../server/db/snapshot";

/**
 * Expands the shipped snapshot into PGLITE_DIR, replacing whatever is there.
 *
 * The server does this automatically on first boot; this script exists to get
 * back to the shipped dataset after experimenting, without paying for a reseed.
 */
async function main(): Promise<void> {
  if (!hasSnapshot()) {
    throw new Error(`No snapshot at ${SNAPSHOT_PATH} — run \`npm run db:snapshot\``);
  }

  const startedAt = Date.now();
  rmSync(env.pgliteDir, { recursive: true, force: true });
  await restoreSnapshot();
  console.log(`[restore] ${env.PGLITE_DIR} rebuilt from snapshot in ${Date.now() - startedAt} ms`);
}

main().catch((error: unknown) => {
  console.error("[restore] failed:", error);
  process.exit(1);
});
