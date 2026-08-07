import { sql } from "drizzle-orm";
import { closeDatabase, getDatabase } from "./client";
import { runMigrations } from "./migrate";
import { alerts, assets, readings, sites } from "./schema";
import {
  ALERT_SEEDS,
  ASSET_SEEDS,
  HISTORY_DAYS,
  METRIC_PROFILES,
  RANDOM_SEED,
  SITE_SEEDS,
} from "./seed-data";
import { METRIC_UNITS, type Metric } from "../../shared/types";
import { env } from "../env";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const TOTAL_HOURS = HISTORY_DAYS * 24;
/** Rows per INSERT. Measured sweet spot; larger statements gain nothing. */
const INSERT_CHUNK = 2_000;

/** Deterministic PRNG so the demo dataset never shifts between machines. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Box–Muller: noise that looks like sensor noise, not like a uniform band. */
function gaussian(rand: () => number): number {
  const u = Math.max(rand(), Number.EPSILON);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Single-quoted SQL string literal with quotes doubled. */
function literal(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

interface ReadingRow {
  assetId: number;
  metric: string;
  value: number;
  unit: string;
  recordedAt: Date;
}

/**
 * Builds one metric series for one asset.
 *
 * Composed of four parts so the charts show structure a human recognises:
 * a daily cycle peaking mid-afternoon, a slower weekly drift, Gaussian sensor
 * noise, and — for assets that are not healthy — a degradation ramp over the
 * final two weeks plus occasional excursions on critical assets.
 */
function buildSeries(
  assetId: number,
  metric: Metric,
  base: number,
  amplitude: number,
  floor: number | undefined,
  status: "ok" | "warning" | "critical",
  startMs: number,
  samples: number,
  stepHours: number,
  rand: () => number,
): ReadingRow[] {
  const unit = METRIC_UNITS[metric];
  const rows: ReadingRow[] = new Array<ReadingRow>(samples);
  // The degradation ramp covers the last 14 days whatever the resolution is.
  const degradeStart = samples - Math.round((14 * 24) / stepHours);
  const degradeGain = status === "critical" ? 0.95 : status === "warning" ? 0.4 : 0;

  for (let i = 0; i < samples; i += 1) {
    const timestampMs = startMs + i * stepHours * HOUR_MS;
    const hourOfDay = new Date(timestampMs).getUTCHours();

    const daily = amplitude * Math.sin((2 * Math.PI * (hourOfDay - 15)) / 24);
    const weekly = amplitude * 0.35 * Math.sin((2 * Math.PI * i * stepHours) / (24 * 7));
    const noise = amplitude * 0.16 * gaussian(rand);

    let degradation = 0;
    if (degradeGain > 0 && i > degradeStart) {
      const progress = (i - degradeStart) / (samples - degradeStart);
      degradation = amplitude * degradeGain * progress * progress;
      // Critical assets also throw intermittent excursions, not a clean ramp.
      if (status === "critical" && rand() < 0.04) {
        degradation += amplitude * (0.6 + rand() * 0.9);
      }
    }

    let value = base + daily + weekly + noise + degradation;
    if (floor !== undefined) value = Math.max(floor, value);

    rows[i] = {
      assetId,
      metric,
      value: Math.round(value * 100) / 100,
      unit,
      recordedAt: new Date(timestampMs),
    };
  }

  return rows;
}

export interface SeedResult {
  sites: number;
  assets: number;
  readings: number;
  alerts: number;
  /** Sampling step inside the fixed 60-day window, in hours. */
  stepHours: number;
  skipped: boolean;
}

/**
 * Populates the database with the demo dataset.
 * No-op when data already exists unless `force` is set, so booting the server
 * repeatedly never duplicates rows.
 */
export async function seedDatabase({ force = false } = {}): Promise<SeedResult> {
  const { db } = await getDatabase();

  const [existing] = await db.select({ count: sql<number>`count(*)::int` }).from(sites);
  if ((existing?.count ?? 0) > 0 && !force) {
    return { sites: 0, assets: 0, readings: 0, alerts: 0, stepHours: 0, skipped: true };
  }

  if (force) {
    await db.execute(
      sql`truncate table ${readings}, ${alerts}, ${assets}, ${sites} restart identity cascade`,
    );
  }

  const rand = mulberry32(RANDOM_SEED);

  // Align the window to the top of the current hour so the newest sample is
  // always "now-ish" and the 24 h deltas line up exactly.
  const endMs = Math.floor(Date.now() / HOUR_MS) * HOUR_MS;

  /*
   * SEED_READINGS trades resolution, never range: the history stays 60 days
   * and the sampling step widens to hit the requested row count. A cold start
   * on a small container is dominated by this number, so the default is sized
   * for "a fork boots quickly" rather than "every hour is present".
   */
  const seriesCount = ASSET_SEEDS.reduce(
    (total, asset) => total + METRIC_PROFILES[asset.type].length,
    0,
  );
  const targetPerSeries = Math.max(2, Math.floor(env.SEED_READINGS / seriesCount));
  const stepHours = Math.max(1, Math.round(TOTAL_HOURS / (targetPerSeries - 1)));
  const samples = Math.floor(TOTAL_HOURS / stepHours) + 1;
  const startMs = endMs - (samples - 1) * stepHours * HOUR_MS;

  const insertedSites = await db
    .insert(sites)
    .values(
      SITE_SEEDS.map((site) => ({
        name: site.name,
        lat: site.lat,
        lng: site.lng,
        timezone: site.timezone,
      })),
    )
    .returning({ id: sites.id, name: sites.name });

  const siteIdByKey = new Map<string, number>();
  SITE_SEEDS.forEach((site, index) => {
    const row = insertedSites[index];
    if (!row) throw new Error(`Site insert returned no row for "${site.key}"`);
    siteIdByKey.set(site.key, row.id);
  });

  const insertedAssets = await db
    .insert(assets)
    .values(
      ASSET_SEEDS.map((asset) => {
        const siteId = siteIdByKey.get(asset.siteKey);
        if (siteId === undefined) throw new Error(`Unknown site key "${asset.siteKey}"`);
        return {
          siteId,
          name: `${asset.code} · ${asset.name}`,
          type: asset.type,
          status: asset.status,
          posX: asset.pos[0],
          posY: asset.pos[1],
          posZ: asset.pos[2],
          installedAt: new Date(`${asset.installedAt}T08:00:00.000Z`),
        };
      }),
    )
    .returning({ id: assets.id });

  const assetIdByCode = new Map<string, number>();
  ASSET_SEEDS.forEach((asset, index) => {
    const row = insertedAssets[index];
    if (!row) throw new Error(`Asset insert returned no row for "${asset.code}"`);
    assetIdByCode.set(asset.code, row.id);
  });

  const readingRows: ReadingRow[] = [];
  for (const asset of ASSET_SEEDS) {
    const assetId = assetIdByCode.get(asset.code);
    if (assetId === undefined) continue;
    for (const profile of METRIC_PROFILES[asset.type]) {
      readingRows.push(
        ...buildSeries(
          assetId,
          profile.metric,
          profile.base,
          profile.amplitude,
          profile.floor,
          asset.status,
          startMs,
          samples,
          stepHours,
          rand,
        ),
      );
    }
  }

  // 56 000 rows through the parameter binder is slow on the embedded WASM
  // engine, so the reading rows are emitted as literal tuples in one
  // transaction. Every value here is generated above — none of it is user
  // input — and the two text columns are still quote-escaped.
  await db.transaction(async (tx) => {
    for (const batch of chunk(readingRows, INSERT_CHUNK)) {
      const tuples = batch
        .map(
          (row) =>
            `(${row.assetId},${literal(row.metric)},${row.value},${literal(row.unit)},` +
            `'${row.recordedAt.toISOString()}')`,
        )
        .join(",");
      await tx.execute(
        sql.raw(
          `insert into readings (asset_id, metric, value, unit, recorded_at) values ${tuples}`,
        ),
      );
    }
  });

  const alertRows = ALERT_SEEDS.map((alert) => {
    const assetId = assetIdByCode.get(alert.assetCode);
    if (assetId === undefined) throw new Error(`Unknown asset code "${alert.assetCode}"`);
    return {
      assetId,
      severity: alert.severity,
      message: alert.message,
      state: alert.state,
      openedAt: new Date(endMs - alert.daysAgo * DAY_MS),
    };
  });

  await db.insert(alerts).values(alertRows);

  return {
    sites: insertedSites.length,
    assets: insertedAssets.length,
    readings: readingRows.length,
    alerts: alertRows.length,
    stepHours,
    skipped: false,
  };
}

const isDirectRun = process.argv[1]?.replace(/\\/g, "/").endsWith("server/db/seed.ts");

if (isDirectRun) {
  const force = process.argv.includes("--force");
  const startedAt = Date.now();

  runMigrations()
    .then(() => seedDatabase({ force }))
    .then((result) => {
      if (result.skipped) {
        console.log("[seed] database already populated — pass --force to rebuild");
        return;
      }
      const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
      console.log(
        `[seed] ${result.sites} sites · ${result.assets} assets · ` +
          `${result.readings.toLocaleString("en-US")} readings · ${result.alerts} alerts · ` +
          `${HISTORY_DAYS} days at ${result.stepHours} h resolution in ${seconds}s`,
      );
    })
    .catch((error: unknown) => {
      console.error("[seed] failed:", error);
      process.exitCode = 1;
    })
    .finally(() => closeDatabase());
}
