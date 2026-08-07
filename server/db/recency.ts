import { sql } from "drizzle-orm";
import { getDatabase } from "./client";

/**
 * Slides the shipped dataset forward so it always reads as live.
 *
 * The committed snapshot freezes its timestamps at the moment it was generated.
 * Left alone, a fork opened three weeks later would show a dashboard whose
 * newest sample is three weeks old: nothing in the last 24 h, every KPI dead.
 * Shifting every reading and alert by whole hours on boot keeps the demo honest
 * without regenerating any data.
 *
 * Whole hours only: the sampling grid is a multiple of one hour, so the 24 h
 * delta lookup still lands exactly on a stored sample. `assets.installed_at` is
 * deliberately left alone — an install date is history, not telemetry.
 *
 * The gap is computed in SQL rather than JavaScript: `max(recorded_at)` comes
 * back as text carrying the session's UTC offset, which is easy to misparse.
 */
export async function refreshDataRecency(): Promise<number> {
  const { db } = await getDatabase();

  const result = await db.execute(sql`
    select floor(
      extract(epoch from (date_trunc('hour', now()) - max(recorded_at))) / 3600
    )::int as shift_hours
    from readings
  `);
  const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows) ?? [];
  const shiftHours = (rows[0] as { shift_hours?: number | null } | undefined)?.shift_hours ?? 0;

  if (!Number.isFinite(shiftHours) || shiftHours < 1) return 0;

  await db.transaction(async (tx) => {
    await tx.execute(
      sql`update readings set recorded_at = recorded_at + make_interval(hours => ${shiftHours})`,
    );
    await tx.execute(
      sql`update alerts set opened_at = opened_at + make_interval(hours => ${shiftHours})`,
    );
  });

  return shiftHours;
}
