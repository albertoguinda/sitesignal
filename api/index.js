/**
 * Vercel Serverless entry point — standalone, no TS imports.
 * Serves /api/* routes. Vercel's CDN serves the static SPA from dist/.
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
  const client = await p.connect();
  try {
    const res = await client.query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sites') as exists"
    );
    if (!res.rows[0].exists) {
      console.error("[api] tables not found — run migrations first");
    }
  } finally {
    client.release();
  }
  initialised = true;
}

const app = express();
app.disable("x-powered-by");
app.use(compression());
app.use(express.json({ limit: "64kb" }));

app.use("/api", async (_req, res, next) => {
  try {
    await ensureDb();
    next();
  } catch (err) {
    console.error("[api] init failed:", err);
    res.status(500).json({ error: "Database initialisation failed" });
  }
});

app.get("/api/health", async (_req, res) => {
  try {
    const p = getPool();
    const client = await p.connect();
    await client.query("SELECT 1");
    client.release();
    res.json({ status: "ok", driver: "postgres", uptime: Math.round(process.uptime()) });
  } catch (err) {
    res.status(500).json({ status: "error", error: err.message });
  }
});

app.get("/api/overview", async (req, res) => {
  try {
    const p = getPool();
    const siteId = req.query.siteId;
    const orgId = req.query.orgId;
    const params = [];
    let idx = 1;

    let where = "";
    if (orgId) { where += ` WHERE s.organization_id = $${idx++}`; params.push(orgId); }

    const sitesRes = await p.query(`SELECT id, name, lat, lng, timezone FROM sites s${where} ORDER BY id`, params);
    const sites = sitesRes.rows;
    if (sites.length === 0) return res.json({ sites: [], assets: [], kpis: { totalAssets: 0, healthyAssets: 0, openAlerts: 0, avgHealthScore: 0 }, alerts: [] });

    const siteIds = sites.map((s) => s.id);
    const ph = siteIds.map((_, i) => `$${i + 1}`).join(",");

    const assetsRes = await p.query(`SELECT id, site_id, name, type, status FROM assets WHERE site_id IN (${ph})`, siteIds);
    const assets = assetsRes.rows;
    const totalAssets = assets.length;
    const healthyAssets = assets.filter((a) => a.status === "ok").length;

    const alertsRes = await p.query(
      `SELECT al.id, al.asset_id, al.severity, al.message, al.state, al.opened_at
       FROM alerts al JOIN assets a ON a.id = al.asset_id
       WHERE a.site_id IN (${ph}) AND al.state = 'open'`, siteIds
    );

    const readingsRes = await p.query(
      `SELECT DISTINCT ON (r.asset_id, r.metric)
         r.asset_id, r.metric, r.value, r.unit, r.recorded_at
       FROM readings r JOIN assets a ON a.id = r.asset_id
       WHERE a.site_id IN (${ph})
       ORDER BY r.asset_id, r.metric, r.recorded_at DESC`, siteIds
    );

    const readingsByAsset = {};
    for (const r of readingsRes.rows) {
      if (!readingsByAsset[r.asset_id]) readingsByAsset[r.asset_id] = [];
      readingsByAsset[r.asset_id].push({ metric: r.metric, value: r.value, unit: r.unit, recordedAt: r.recorded_at });
    }

    res.json({
      sites,
      assets: assets.map((a) => ({ ...a, readings: readingsByAsset[a.id] || [], posX: 0, posY: 0, posZ: 0 })),
      kpis: { totalAssets, healthyAssets, openAlerts: alertsRes.rows.length, avgHealthScore: totalAssets > 0 ? Math.round((healthyAssets / totalAssets) * 100) : 0 },
      alerts: alertsRes.rows,
    });
  } catch (err) {
    console.error("[api] overview error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/sites", async (req, res) => {
  try {
    const p = getPool();
    const orgId = req.query.orgId;
    if (orgId) {
      const r = await p.query("SELECT * FROM sites WHERE organization_id = $1 ORDER BY id", [orgId]);
      return res.json(r.rows);
    }
    res.json((await p.query("SELECT * FROM sites ORDER BY id")).rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/assets/:id", async (req, res) => {
  try {
    const p = getPool();
    const { id } = req.params;
    const range = req.query.range || "7d";
    const assetR = await p.query("SELECT * FROM assets WHERE id = $1", [id]);
    if (assetR.rows.length === 0) return res.status(404).json({ error: "Not found" });
    const days = range === "30d" ? 30 : range === "24h" ? 1 : 7;
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const readings = (await p.query("SELECT metric, value, unit, recorded_at FROM readings WHERE asset_id = $1 AND recorded_at >= $2 ORDER BY recorded_at", [id, since])).rows;
    const alerts = (await p.query("SELECT * FROM alerts WHERE asset_id = $1 ORDER BY opened_at DESC LIMIT 20", [id])).rows;
    res.json({ ...assetR.rows[0], readings, alerts });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/analytics/series", async (req, res) => {
  try {
    const p = getPool();
    const assetIds = (req.query.assetIds || "").split(",").filter(Boolean).map(Number);
    const metric = req.query.metric;
    const range = req.query.range || "7d";
    if (assetIds.length === 0 || !metric) return res.json([]);
    const days = range === "30d" ? 30 : range === "24h" ? 1 : 7;
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const ph = assetIds.map((_, i) => `$${i + 1}`).join(",");
    const r = await p.query(
      `SELECT asset_id, metric, value, unit, recorded_at FROM readings
       WHERE asset_id IN (${ph}) AND metric = $${assetIds.length + 1} AND recorded_at >= $${assetIds.length + 2}
       ORDER BY recorded_at`, [...assetIds, metric, since]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/alerts", async (_req, res) => {
  try {
    const p = getPool();
    const r = await p.query("SELECT al.*, a.name as asset_name FROM alerts al JOIN assets a ON a.id = al.asset_id ORDER BY al.opened_at DESC LIMIT 50");
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/organizations", async (_req, res) => { res.json([]); });
app.get("/api/auth/me", async (_req, res) => { res.json({ user: null }); });
app.post("/api/auth/magic-link", async (_req, res) => { res.json({ success: true }); });
app.post("/api/auth/logout", async (_req, res) => { res.json({ success: true }); });

export default app;
