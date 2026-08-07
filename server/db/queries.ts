import { sql, type SQL } from "drizzle-orm";
import { getDatabase } from "./client";
import {
  METRIC_UNITS,
  type Alert,
  type AlertSeverity,
  type AlertWithAsset,
  type AnalyticsResponse,
  type AssetRow,
  type LatestReading,
  type Metric,
  type MetricSeries,
  type OverviewKpis,
  type RangeKey,
  type Site,
} from "../../shared/types";

/**
 * `db.execute` hands back the driver's native result. node-postgres wraps rows
 * in `{ rows }`; PGlite has done both across versions. Normalising here keeps
 * every call site driver-agnostic.
 */
function toRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

async function query<T>(statement: SQL): Promise<T[]> {
  const { db } = await getDatabase();
  return toRows<T>(await db.execute(statement));
}

const SEVERITY_BY_RANK: Record<number, AlertSeverity> = {
  1: "info",
  2: "warning",
  3: "critical",
};

/** Window and bucket width per range key — day buckets past a week of data. */
export const RANGE_CONFIG: Record<RangeKey, { interval: string; bucket: "hour" | "day" }> = {
  "24h": { interval: "24 hours", bucket: "hour" },
  "7d": { interval: "7 days", bucket: "hour" },
  "30d": { interval: "30 days", bucket: "day" },
  "60d": { interval: "60 days", bucket: "day" },
};

/** `date_trunc`/`interval` arguments are enum-constrained, never user strings. */
function rangeWindow(range: RangeKey): { interval: SQL; bucket: SQL; bucketName: "hour" | "day" } {
  const config = RANGE_CONFIG[range];
  return {
    interval: sql.raw(`interval '${config.interval}'`),
    bucket: sql.raw(`'${config.bucket}'`),
    bucketName: config.bucket,
  };
}

function idList(ids: number[]): SQL {
  return sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `,
  );
}

/**
 * Newest sample and its 24 h-earlier counterpart, per asset and metric.
 * `distinct on` is the cheapest way to express "latest row per group" on
 * Postgres and it rides the (asset_id, metric, recorded_at) index directly.
 */
const LATEST_CTE = sql`
  latest as (
    select distinct on (r.asset_id, r.metric)
      r.asset_id, r.metric, r.value, r.unit, r.recorded_at
    from readings r
    order by r.asset_id, r.metric, r.recorded_at desc
  ),
  previous as (
    select distinct on (r.asset_id, r.metric)
      r.asset_id, r.metric, r.value
    from readings r
    where r.recorded_at <= now() - interval '24 hours'
    order by r.asset_id, r.metric, r.recorded_at desc
  )
`;

interface AssetRowRecord {
  id: number;
  site_id: number;
  name: string;
  type: string;
  status: AssetRow["status"];
  pos_x: number;
  pos_y: number;
  pos_z: number;
  installed_at: Date | string;
  site_name: string;
  site_timezone: string;
  open_alerts: number;
  worst_rank: number | null;
  latest: LatestReading[] | null;
}

function mapAssetRow(record: AssetRowRecord): AssetRow {
  return {
    id: record.id,
    siteId: record.site_id,
    name: record.name,
    type: record.type as AssetRow["type"],
    status: record.status,
    posX: record.pos_x,
    posY: record.pos_y,
    posZ: record.pos_z,
    installedAt: new Date(record.installed_at).toISOString(),
    siteName: record.site_name,
    siteTimezone: record.site_timezone,
    openAlerts: record.open_alerts,
    worstSeverity: record.worst_rank ? (SEVERITY_BY_RANK[record.worst_rank] ?? null) : null,
    latest: record.latest ?? [],
  };
}

export async function listSites(organizationId?: string): Promise<Site[]> {
  if (organizationId) {
    return query<Site>(
      sql`select id, name, lat, lng, timezone from sites where organization_id = ${organizationId} order by name`
    );
  }
  return query<Site>(sql`select id, name, lat, lng, timezone from sites order by name`);
}

export async function getSite(siteId: number): Promise<Site | null> {
  const rows = await query<Site>(
    sql`select id, name, lat, lng, timezone from sites where id = ${siteId}`,
  );
  return rows[0] ?? null;
}

/**
 * The workhorse read: every asset with its latest value per metric, the 24 h
 * delta, and its alert pressure. One round trip, used by the overview table,
 * the analytics picker and the 3D floor plan.
 */
export async function listAssetRows(filter: {
  siteId?: number | undefined;
  assetId?: number | undefined;
  organizationId?: string | undefined;
}): Promise<AssetRow[]> {
  const conditions: SQL[] = [];
  if (filter.siteId !== undefined) conditions.push(sql`a.site_id = ${filter.siteId}`);
  if (filter.assetId !== undefined) conditions.push(sql`a.id = ${filter.assetId}`);
  if (filter.organizationId !== undefined) {
    conditions.push(sql`s.organization_id = ${filter.organizationId}`);
  }
  const where = conditions.length ? sql`where ${sql.join(conditions, sql` and `)}` : sql``;

  const records = await query<AssetRowRecord>(sql`
    with ${LATEST_CTE},
    alert_agg as (
      select
        al.asset_id,
        (count(*) filter (where al.state = 'open'))::int as open_alerts,
        max(case al.severity when 'critical' then 3 when 'warning' then 2 else 1 end)
          filter (where al.state <> 'resolved') as worst_rank
      from alerts al
      group by al.asset_id
    )
    select
      a.id, a.site_id, a.name, a.type, a.status, a.pos_x, a.pos_y, a.pos_z, a.installed_at,
      s.name as site_name,
      s.timezone as site_timezone,
      coalesce(ag.open_alerts, 0) as open_alerts,
      ag.worst_rank::int as worst_rank,
      coalesce(
        json_agg(
          json_build_object(
            'metric', l.metric,
            'value', l.value,
            'unit', l.unit,
            'recordedAt', to_char(l.recorded_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'delta24h', case
              when p.value is null then null
              else (round((l.value - p.value)::numeric, 2))::float8
            end
          )
          order by l.metric
        ) filter (where l.metric is not null),
        '[]'::json
      ) as latest
    from assets a
    join sites s on s.id = a.site_id
    left join latest l on l.asset_id = a.id
    left join previous p on p.asset_id = a.id and p.metric = l.metric
    left join alert_agg ag on ag.asset_id = a.id
    ${where}
    group by a.id, s.name, s.timezone, ag.open_alerts, ag.worst_rank
    order by a.name
  `);

  return records.map(mapAssetRow);
}

interface KpiRecord {
  assets_total: number;
  assets_ok: number;
  assets_warning: number;
  assets_critical: number;
  open_alerts: number;
  ack_alerts: number;
  resolved_alerts: number;
  readings_24h: number;
}

export async function getOverviewKpis(siteId?: number, organizationId?: string): Promise<OverviewKpis> {
  // A single always-true predicate keeps every scoped sub-select uniform:
  // `where <scope> and <condition>` composes without branching on `where`/`and`.
  let scope: SQL;
  if (siteId !== undefined) {
    scope = sql`a.site_id = ${siteId}`;
  } else if (organizationId !== undefined) {
    scope = sql`s.organization_id = ${organizationId}`;
  } else {
    scope = sql`true`;
  }

  const [counts] = await query<KpiRecord>(sql`
    select
      (select count(*) from assets a where ${scope})::int as assets_total,
      (select count(*) from assets a where ${scope} and a.status = 'ok')::int as assets_ok,
      (select count(*) from assets a where ${scope} and a.status = 'warning')::int as assets_warning,
      (select count(*) from assets a where ${scope} and a.status = 'critical')::int as assets_critical,
      (select count(*) from alerts al join assets a on a.id = al.asset_id
        where ${scope} and al.state = 'open')::int as open_alerts,
      (select count(*) from alerts al join assets a on a.id = al.asset_id
        where ${scope} and al.state = 'ack')::int as ack_alerts,
      (select count(*) from alerts al join assets a on a.id = al.asset_id
        where ${scope} and al.state = 'resolved')::int as resolved_alerts,
      (select count(*) from readings r join assets a on a.id = r.asset_id
        where ${scope} and r.recorded_at >= now() - interval '24 hours')::int as readings_24h
  `);

  const averages = await query<{ metric: Metric; value: number }>(sql`
    with ${LATEST_CTE}
    select l.metric, (avg(l.value))::float8 as value
    from latest l
    join assets a on a.id = l.asset_id
    ${siteId === undefined ? sql`` : sql`where a.site_id = ${siteId}`}
    group by l.metric
    order by l.metric
  `);

  const total = counts?.assets_total ?? 0;
  const ok = counts?.assets_ok ?? 0;

  return {
    assetsTotal: total,
    assetsOk: ok,
    assetsWarning: counts?.assets_warning ?? 0,
    assetsCritical: counts?.assets_critical ?? 0,
    openAlerts: counts?.open_alerts ?? 0,
    ackAlerts: counts?.ack_alerts ?? 0,
    resolvedAlerts: counts?.resolved_alerts ?? 0,
    healthScore: total === 0 ? 0 : Math.round((ok / total) * 1000) / 10,
    readingsLast24h: counts?.readings_24h ?? 0,
    averages: averages.map((row) => ({
      metric: row.metric,
      value: Math.round(row.value * 10) / 10,
      unit: METRIC_UNITS[row.metric] ?? "",
    })),
  };
}

interface AlertRecord {
  id: number;
  asset_id: number;
  severity: AlertSeverity;
  message: string;
  state: Alert["state"];
  opened_at: Date | string;
  asset_name: string;
  asset_type: string;
  site_id: number;
  site_name: string;
}

export async function listAlerts(options: {
  siteId?: number | undefined;
  assetId?: number | undefined;
  state?: Alert["state"] | undefined;
  limit?: number | undefined;
  organizationId?: string | undefined;
}): Promise<AlertWithAsset[]> {
  const conditions: SQL[] = [];
  if (options.siteId !== undefined) conditions.push(sql`a.site_id = ${options.siteId}`);
  if (options.assetId !== undefined) conditions.push(sql`al.asset_id = ${options.assetId}`);
  if (options.state !== undefined) conditions.push(sql`al.state = ${options.state}`);
  if (options.organizationId !== undefined) {
    conditions.push(sql`s.organization_id = ${options.organizationId}`);
  }
  const where = conditions.length ? sql`where ${sql.join(conditions, sql` and `)}` : sql``;
  const limit = options.limit ?? 50;

  const records = await query<AlertRecord>(sql`
    select
      al.id, al.asset_id, al.severity, al.message, al.state, al.opened_at,
      a.name as asset_name, a.type as asset_type,
      a.site_id, s.name as site_name
    from alerts al
    join assets a on a.id = al.asset_id
    join sites s on s.id = a.site_id
    ${where}
    order by
      case al.state when 'open' then 0 when 'ack' then 1 else 2 end,
      case al.severity when 'critical' then 0 when 'warning' then 1 else 2 end,
      al.opened_at desc
    limit ${limit}
  `);

  return records.map((record) => ({
    id: record.id,
    assetId: record.asset_id,
    severity: record.severity,
    message: record.message,
    state: record.state,
    openedAt: new Date(record.opened_at).toISOString(),
    assetName: record.asset_name,
    assetType: record.asset_type as AlertWithAsset["assetType"],
    siteId: record.site_id,
    siteName: record.site_name,
  }));
}

interface SeriesRecord {
  asset_id: number;
  asset_name: string;
  metric: Metric;
  t: string;
  v: number;
}

/**
 * Bucketed time series for one metric across any number of assets.
 * Averaging inside the bucket keeps the payload small on long ranges while
 * preserving the shape of the signal.
 */
export async function getSeries(options: {
  assetIds: number[];
  metric: Metric;
  range: RangeKey;
}): Promise<{ series: MetricSeries[]; bucket: "hour" | "day" }> {
  if (options.assetIds.length === 0) return { series: [], bucket: "hour" };

  const { interval, bucket, bucketName } = rangeWindow(options.range);

  // Truncate against the UTC wall clock, not the session timezone: otherwise a
  // server in, say, Europe/Madrid would cut "days" at 22:00 UTC while the client
  // labels every axis in UTC.
  const bucketExpr = sql`date_trunc(${bucket}, r.recorded_at at time zone 'utc')`;

  const records = await query<SeriesRecord>(sql`
    select
      r.asset_id,
      a.name as asset_name,
      r.metric,
      to_char(${bucketExpr}, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as t,
      (avg(r.value))::float8 as v
    from readings r
    join assets a on a.id = r.asset_id
    where r.asset_id in (${idList(options.assetIds)})
      and r.metric = ${options.metric}
      and r.recorded_at >= now() - ${interval}
    group by r.asset_id, a.name, r.metric, ${bucketExpr}
    order by r.asset_id, ${bucketExpr}
  `);

  const byAsset = new Map<number, MetricSeries>();
  for (const record of records) {
    let series = byAsset.get(record.asset_id);
    if (!series) {
      series = {
        assetId: record.asset_id,
        assetName: record.asset_name,
        metric: record.metric,
        unit: METRIC_UNITS[record.metric] ?? "",
        points: [],
        min: Number.POSITIVE_INFINITY,
        max: Number.NEGATIVE_INFINITY,
        avg: 0,
      };
      byAsset.set(record.asset_id, series);
    }
    const value = Math.round(record.v * 100) / 100;
    series.points.push({ t: record.t, v: value });
    series.min = Math.min(series.min, value);
    series.max = Math.max(series.max, value);
  }

  const series = [...byAsset.values()].map((entry) => {
    const sum = entry.points.reduce((acc, point) => acc + point.v, 0);
    return {
      ...entry,
      min: entry.points.length ? Math.round(entry.min * 100) / 100 : 0,
      max: entry.points.length ? Math.round(entry.max * 100) / 100 : 0,
      avg: entry.points.length ? Math.round((sum / entry.points.length) * 100) / 100 : 0,
    };
  });

  // Preserve the caller's asset order so chart colours stay stable.
  series.sort((a, b) => options.assetIds.indexOf(a.assetId) - options.assetIds.indexOf(b.assetId));

  return { series, bucket: bucketName };
}

/** Which metrics an asset actually reports — drives the detail page tabs. */
export async function listAssetMetrics(assetId: number): Promise<Metric[]> {
  const rows = await query<{ metric: Metric }>(
    sql`select distinct metric from readings where asset_id = ${assetId} order by metric`,
  );
  return rows.map((row) => row.metric);
}

export async function getAnalytics(options: {
  assetIds: number[];
  metric: Metric;
  range: RangeKey;
}): Promise<AnalyticsResponse> {
  const { series, bucket } = await getSeries(options);
  return {
    metric: options.metric,
    unit: METRIC_UNITS[options.metric] ?? "",
    range: options.range,
    bucket,
    series,
  };
}
