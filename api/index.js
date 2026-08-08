/**
 * Vercel Serverless — standalone, matches the exact contracts in shared/types.ts.
 */
import express from "express";
import compression from "compression";
import { Pool } from "pg";

let initialised = false;
let pool = null;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 10_000,
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}

async function ensureDb() {
  if (initialised) return;
  const p = getPool();
  const c = await p.connect();
  try {
    await c.query("SELECT 1");
  } finally {
    c.release();
  }
  initialised = true;
}

const LATEST_CTE = `
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
  )`;

const METRIC_UNITS = { temperature: "°C", vibration: "mm/s", humidity: "%" };

function esc(v) { return String(v).replace(/'/g, "''"); }

const app = express();
app.disable("x-powered-by");
app.use(compression());
app.use(express.json({ limit: "64kb" }));

app.use("/api", async (_req, res, next) => {
  try { await ensureDb(); next(); } catch (err) { res.status(500).json({ error: "DB init failed" }); }
});

// ── Health ──────────────────────────────────────────────
app.get("/api/health", async (_req, res) => {
  const c = await getPool().connect();
  try { await c.query("SELECT 1"); res.json({ status: "ok", driver: "postgres", uptime: Math.round(process.uptime()) }); }
  catch (err) { res.status(500).json({ status: "error", error: err.message }); }
  finally { c.release(); }
});

// ── Sites ───────────────────────────────────────────────
app.get("/api/sites", async (req, res) => {
  try {
    const orgId = req.query.orgId;
    let q, params;
    if (orgId) { q = "select id, name, lat, lng, timezone from sites where organization_id = $1 order by name"; params = [orgId]; }
    else { q = "select id, name, lat, lng, timezone from sites order by name"; params = []; }
    res.json((await getPool().query(q, params)).rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Overview (matches OverviewResponse exactly) ──────────
app.get("/api/overview", async (req, res) => {
  try {
    const p = getPool();
    const siteId = req.query.siteId ? Number(req.query.siteId) : undefined;
    const orgId = req.query.orgId;

    // Build scope predicate
    let scope = "true";
    const scopeParams = [];
    if (siteId !== undefined) { scope = `a.site_id = $${scopeParams.length + 1}`; scopeParams.push(siteId); }
    else if (orgId) { scope = `s.organization_id = $${scopeParams.length + 1}`; scopeParams.push(orgId); }

    // KPIs
    const kpiQ = `
      select
        (select count(*) from assets a join sites s on s.id = a.site_id where ${scope})::int as assets_total,
        (select count(*) from assets a join sites s on s.id = a.site_id where ${scope} and a.status = 'ok')::int as assets_ok,
        (select count(*) from assets a join sites s on s.id = a.site_id where ${scope} and a.status = 'warning')::int as assets_warning,
        (select count(*) from assets a join sites s on s.id = a.site_id where ${scope} and a.status = 'critical')::int as assets_critical,
        (select count(*) from alerts al join assets a on a.id = al.asset_id join sites s on s.id = a.site_id where ${scope} and al.state = 'open')::int as open_alerts,
        (select count(*) from alerts al join assets a on a.id = al.asset_id join sites s on s.id = a.site_id where ${scope} and al.state = 'ack')::int as ack_alerts,
        (select count(*) from alerts al join assets a on a.id = al.asset_id join sites s on s.id = a.site_id where ${scope} and al.state = 'resolved')::int as resolved_alerts,
        (select count(*) from readings r join assets a on a.id = r.asset_id join sites s on s.id = a.site_id where ${scope} and r.recorded_at >= now() - interval '24 hours')::int as readings_24h`;
    const kpiRes = (await p.query(kpiQ, scopeParams)).rows[0];
    const total = kpiRes.assets_total || 0;
    const ok = kpiRes.assets_ok || 0;

    // Averages
    const avgScope = siteId !== undefined ? `where a.site_id = ${siteId}` : "";
    const avgQ = `
      with ${LATEST_CTE}
      select l.metric, (avg(l.value))::float8 as value
      from latest l
      join assets a on a.id = l.asset_id
      ${avgScope}
      group by l.metric order by l.metric`;
    const avgRows = (await p.query(avgQ)).rows;
    const averages = avgRows.map(r => ({ metric: r.metric, value: Math.round(r.value * 10) / 10, unit: METRIC_UNITS[r.metric] || "" }));

    const kpis = {
      assetsTotal: total,
      assetsOk: ok,
      assetsWarning: kpiRes.assets_warning,
      assetsCritical: kpiRes.assets_critical,
      openAlerts: kpiRes.open_alerts,
      ackAlerts: kpiRes.ack_alerts,
      resolvedAlerts: kpiRes.resolved_alerts,
      healthScore: total === 0 ? 0 : Math.round((ok / total) * 1000) / 10,
      readingsLast24h: kpiRes.readings_24h,
      averages,
    };

    // Asset rows (latest readings per metric with 24h delta)
    const assetScope = siteId !== undefined ? `and a.site_id = ${siteId}` : (orgId ? `and s.organization_id = '${esc(orgId)}'` : "");
    const assetsQ = `
      with ${LATEST_CTE},
      alert_agg as (
        select al.asset_id,
          (count(*) filter (where al.state = 'open'))::int as open_alerts,
          max(case al.severity when 'critical' then 3 when 'warning' then 2 else 1 end) filter (where al.state <> 'resolved') as worst_rank
        from alerts al group by al.asset_id
      )
      select
        a.id, a.site_id, a.name, a.type, a.status, a.pos_x, a.pos_y, a.pos_z, a.installed_at,
        s.name as site_name, s.timezone as site_timezone,
        coalesce(ag.open_alerts, 0) as open_alerts,
        ag.worst_rank::int as worst_rank,
        coalesce(
          json_agg(json_build_object(
            'metric', l.metric, 'value', l.value, 'unit', l.unit,
            'recordedAt', to_char(l.recorded_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'delta24h', case when p.value is null then null else (round((l.value - p.value)::numeric, 2))::float8 end
          ) order by l.metric) filter (where l.metric is not null), '[]'::json
        ) as latest
      from assets a
      join sites s on s.id = a.site_id
      left join latest l on l.asset_id = a.id
      left join previous p on p.asset_id = a.id and p.metric = l.metric
      left join alert_agg ag on ag.asset_id = a.id
      where 1=1 ${assetScope}
      group by a.id, s.name, s.timezone, ag.open_alerts, ag.worst_rank
      order by a.name`;
    const assetRows = (await p.query(assetsQ)).rows.map(r => ({
      id: r.id, siteId: r.site_id, name: r.name, type: r.type, status: r.status,
      posX: r.pos_x, posY: r.pos_y, posZ: r.pos_z,
      installedAt: new Date(r.installed_at).toISOString(),
      siteName: r.site_name, siteTimezone: r.site_timezone,
      openAlerts: r.open_alerts,
      worstSeverity: r.worst_rank ? ({ 1: "info", 2: "warning", 3: "critical" }[r.worst_rank] || null) : null,
      latest: r.latest || [],
    }));

    // Recent alerts
    const alertScope = siteId !== undefined ? `and a.site_id = ${siteId}` : (orgId ? `and s.organization_id = '${esc(orgId)}'` : "");
    const alertsQ = `
      select al.id, al.asset_id, al.severity, al.message, al.state, al.opened_at,
        a.name as asset_name, a.type as asset_type, a.site_id, s.name as site_name
      from alerts al
      join assets a on a.id = al.asset_id
      join sites s on s.id = a.site_id
      where 1=1 ${alertScope}
      order by case al.state when 'open' then 0 when 'ack' then 1 else 2 end,
        case al.severity when 'critical' then 0 when 'warning' then 1 else 2 end,
        al.opened_at desc
      limit 8`;
    const recentAlerts = (await p.query(alertsQ)).rows.map(r => ({
      id: r.id, assetId: r.asset_id, severity: r.severity, message: r.message, state: r.state,
      openedAt: new Date(r.opened_at).toISOString(),
      assetName: r.asset_name, assetType: r.asset_type, siteId: r.site_id, siteName: r.site_name,
    }));

    // Ambient: empty array (weather requires separate service, skip for demo)
    res.json({ kpis, assets: assetRows, recentAlerts, ambient: [] });
  } catch (err) {
    console.error("[api] overview error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Asset detail (matches AssetDetailResponse) ──────────
app.get("/api/assets/:id", async (req, res) => {
  try {
    const p = getPool();
    const id = Number(req.params.id);
    const range = req.query.range || "7d";
    const days = range === "30d" ? 30 : range === "24h" ? 1 : range === "60d" ? 60 : 7;

    // Asset with latest readings
    const assetQ = `
      with ${LATEST_CTE}
      select a.*, s.name as site_name, s.timezone as site_timezone, s.lat as site_lat, s.lng as site_lng,
        coalesce(
          json_agg(json_build_object(
            'metric', l.metric, 'value', l.value, 'unit', l.unit,
            'recordedAt', to_char(l.recorded_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'delta24h', case when p.value is null then null else (round((l.value - p.value)::numeric, 2))::float8 end
          ) order by l.metric) filter (where l.metric is not null), '[]'::json
        ) as latest
      from assets a
      join sites s on s.id = a.site_id
      left join latest l on l.asset_id = a.id
      left join previous p on p.asset_id = a.id and p.metric = l.metric
      where a.id = $1
      group by a.id, s.name, s.timezone, s.lat, s.lng`;
    const assetRes = (await p.query(assetQ, [id])).rows[0];
    if (!assetRes) return res.status(404).json({ error: "Not found" });

    const asset = {
      id: assetRes.id, siteId: assetRes.site_id, name: assetRes.name, type: assetRes.type, status: assetRes.status,
      posX: assetRes.pos_x, posY: assetRes.pos_y, posZ: assetRes.pos_z,
      installedAt: new Date(assetRes.installed_at).toISOString(),
      siteName: assetRes.site_name, siteTimezone: assetRes.site_timezone,
      openAlerts: 0, worstSeverity: null,
      latest: assetRes.latest || [],
    };

    // Siblings on same site
    const siblingsQ = `
      with ${LATEST_CTE},
      alert_agg as (
        select al.asset_id,
          (count(*) filter (where al.state = 'open'))::int as open_alerts,
          max(case al.severity when 'critical' then 3 when 'warning' then 2 else 1 end) filter (where al.state <> 'resolved') as worst_rank
        from alerts al group by al.asset_id
      )
      select a.id, a.site_id, a.name, a.type, a.status, a.pos_x, a.pos_y, a.pos_z, a.installed_at,
        s.name as site_name, s.timezone as site_timezone,
        coalesce(ag.open_alerts, 0) as open_alerts,
        ag.worst_rank::int as worst_rank,
        coalesce(
          json_agg(json_build_object('metric', l.metric, 'value', l.value, 'unit', l.unit,
            'recordedAt', to_char(l.recorded_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'delta24h', case when p.value is null then null else (round((l.value - p.value)::numeric, 2))::float8 end
          ) order by l.metric) filter (where l.metric is not null), '[]'::json
        ) as latest
      from assets a join sites s on s.id = a.site_id
      left join latest l on l.asset_id = a.id
      left join previous p on p.asset_id = a.id and p.metric = l.metric
      left join alert_agg ag on ag.asset_id = a.id
      where a.site_id = $1
      group by a.id, s.name, s.timezone, ag.open_alerts, ag.worst_rank
      order by a.name`;
    const siblings = (await p.query(siblingsQ, [assetRes.site_id])).rows.map(r => ({
      id: r.id, siteId: r.site_id, name: r.name, type: r.type, status: r.status,
      posX: r.pos_x, posY: r.pos_y, posZ: r.pos_z,
      installedAt: new Date(r.installed_at).toISOString(),
      siteName: r.site_name, siteTimezone: r.site_timezone,
      openAlerts: r.open_alerts,
      worstSeverity: r.worst_rank ? ({ 1: "info", 2: "warning", 3: "critical" }[r.worst_rank] || null) : null,
      latest: r.latest || [],
    }));

    // Series
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const seriesQ = `
      select r.asset_id, a.name as asset_name, r.metric,
        to_char(date_trunc('hour', r.recorded_at at time zone 'utc'), 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as t,
        (avg(r.value))::float8 as v
      from readings r join assets a on a.id = r.asset_id
      where r.asset_id = $1 and r.recorded_at >= $2
      group by r.asset_id, a.name, r.metric, date_trunc('hour', r.recorded_at at time zone 'utc')
      order by r.asset_id, date_trunc('hour', r.recorded_at at time zone 'utc')`;
    const seriesRes = (await p.query(seriesQ, [id, since])).rows;

    // Group by metric
    const byMetric = new Map();
    for (const r of seriesRes) {
      if (!byMetric.has(r.metric)) byMetric.set(r.metric, { assetId: r.asset_id, assetName: r.asset_name, metric: r.metric, unit: METRIC_UNITS[r.metric] || "", points: [], min: Infinity, max: -Infinity, avg: 0 });
      const s = byMetric.get(r.metric);
      const v = Math.round(r.v * 100) / 100;
      s.points.push({ t: r.t, v });
      s.min = Math.min(s.min, v);
      s.max = Math.max(s.max, v);
    }
    const series = [...byMetric.values()].map(s => {
      const sum = s.points.reduce((a, p) => a + p.v, 0);
      return { ...s, min: s.points.length ? Math.round(s.min * 100) / 100 : 0, max: s.points.length ? Math.round(s.max * 100) / 100 : 0, avg: s.points.length ? Math.round((sum / s.points.length) * 100) / 100 : 0 };
    });

    // Alerts for this asset
    const alertsRes = (await p.query("select id, asset_id, severity, message, state, opened_at from alerts where asset_id = $1 order by opened_at desc", [id])).rows;
    const alerts = alertsRes.map(r => ({ id: r.id, assetId: r.asset_id, severity: r.severity, message: r.message, state: r.state, openedAt: new Date(r.opened_at).toISOString() }));

    res.json({ asset, site: { id: assetRes.site_id, name: assetRes.site_name, lat: assetRes.site_lat, lng: assetRes.site_lng, timezone: assetRes.site_timezone }, siblings, alerts, series });
  } catch (err) { console.error("[api] asset error:", err); res.status(500).json({ error: err.message }); }
});

// ── Analytics series ────────────────────────────────────
app.get("/api/analytics/series", async (req, res) => {
  try {
    const p = getPool();
    const assetIds = (req.query.assetIds || "").split(",").filter(Boolean).map(Number);
    const metric = req.query.metric;
    const range = req.query.range || "7d";
    if (assetIds.length === 0 || !metric) return res.json({ metric: metric || "", unit: "", range, bucket: "hour", series: [] });

    const days = range === "30d" ? 30 : range === "24h" ? 1 : range === "60d" ? 60 : 7;
    const bucket = days > 7 ? "day" : "hour";
    const bucketExpr = `date_trunc('${bucket}', r.recorded_at at time zone 'utc')`;
    const ph = assetIds.map((_, i) => `$${i + 1}`).join(",");
    const since = new Date(Date.now() - days * 86400000).toISOString();

    const q = `
      select r.asset_id, a.name as asset_name, r.metric,
        to_char(${bucketExpr}, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as t,
        (avg(r.value))::float8 as v
      from readings r join assets a on a.id = r.asset_id
      where r.asset_id in (${ph}) and r.metric = $${assetIds.length + 1} and r.recorded_at >= $${assetIds.length + 2}
      group by r.asset_id, a.name, r.metric, ${bucketExpr}
      order by r.asset_id, ${bucketExpr}`;
    const rows = (await p.query(q, [...assetIds, metric, since])).rows;

    const byAsset = new Map();
    for (const r of rows) {
      if (!byAsset.has(r.asset_id)) byAsset.set(r.asset_id, { assetId: r.asset_id, assetName: r.asset_name, metric: r.metric, unit: METRIC_UNITS[r.metric] || "", points: [], min: Infinity, max: -Infinity, avg: 0 });
      const s = byAsset.get(r.asset_id);
      const v = Math.round(r.v * 100) / 100;
      s.points.push({ t: r.t, v });
      s.min = Math.min(s.min, v);
      s.max = Math.max(s.max, v);
    }
    const series = [...byAsset.values()].map(s => {
      const sum = s.points.reduce((a, p) => a + p.v, 0);
      return { ...s, min: s.points.length ? Math.round(s.min * 100) / 100 : 0, max: s.points.length ? Math.round(s.max * 100) / 100 : 0, avg: s.points.length ? Math.round((sum / s.points.length) * 100) / 100 : 0 };
    });
    series.sort((a, b) => assetIds.indexOf(a.assetId) - assetIds.indexOf(b.assetId));

    res.json({ metric, unit: METRIC_UNITS[metric] || "", range, bucket, series });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Alerts ──────────────────────────────────────────────
app.get("/api/alerts", async (req, res) => {
  try {
    const p = getPool();
    const siteId = req.query.siteId ? Number(req.query.siteId) : undefined;
    const limit = Number(req.query.limit) || 50;
    let q = `select al.id, al.asset_id, al.severity, al.message, al.state, al.opened_at,
      a.name as asset_name, a.type as asset_type, a.site_id, s.name as site_name
      from alerts al join assets a on a.id = al.asset_id join sites s on s.id = a.site_id`;
    const params = [];
    if (siteId !== undefined) { q += " where a.site_id = $1"; params.push(siteId); }
    q += ` order by case al.state when 'open' then 0 when 'ack' then 1 else 2 end,
      case al.severity when 'critical' then 0 when 'warning' then 1 else 2 end,
      al.opened_at desc limit $${params.length + 1}`;
    params.push(limit);
    const rows = (await p.query(q, params)).rows.map(r => ({
      id: r.id, assetId: r.asset_id, severity: r.severity, message: r.message, state: r.state,
      openedAt: new Date(r.opened_at).toISOString(),
      assetName: r.asset_name, assetType: r.asset_type, siteId: r.site_id, siteName: r.site_name,
    }));
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Organizations ───────────────────────────────────────
app.get("/api/organizations", async (_req, res) => { res.json([]); });

// ── Auth stubs (demo mode) ──────────────────────────────
app.get("/api/auth/me", async (_req, res) => { res.json({ user: null }); });
app.post("/api/auth/magic-link", async (_req, res) => { res.json({ success: true }); });
app.post("/api/auth/logout", async (_req, res) => { res.json({ success: true }); });

// ── SPA fallback ────────────────────────────────────────
app.get(/^(?!\/api).*/, async (_req, res) => { res.status(404).json({ error: "Not found" }); });

export default app;
