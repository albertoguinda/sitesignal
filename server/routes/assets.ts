import { Router } from "express";
import {
  getSite,
  getSeries,
  listAlerts,
  listAssetMetrics,
  listAssetRows,
} from "../db/queries";
import {
  assetSeriesQuerySchema,
  assetsQuerySchema,
  HttpError,
  idParamSchema,
  parseOrThrow,
} from "../http/validation";
import type { AssetDetailResponse } from "../../shared/types";

export const assetsRouter: Router = Router();

assetsRouter.get("/", async (req, res) => {
  const { siteId } = parseOrThrow(assetsQuerySchema, req.query);
  res.json(await listAssetRows({ siteId }));
});

/**
 * Detail payload for `/assets/:id`: the asset, its site, every sibling on the
 * same floor (the 3D scene renders the whole plan), its alert history and a
 * series per metric it reports.
 */
assetsRouter.get("/:id", async (req, res) => {
  const id = parseOrThrow(idParamSchema, req.params.id);
  const { range } = parseOrThrow(assetSeriesQuerySchema, req.query);

  const [asset] = await listAssetRows({ assetId: id });
  if (!asset) throw new HttpError(404, "Asset not found");

  const site = await getSite(asset.siteId);
  if (!site) throw new HttpError(404, "Site not found");

  const [siblings, alerts, metrics] = await Promise.all([
    listAssetRows({ siteId: asset.siteId }),
    listAlerts({ assetId: id, limit: 25 }),
    listAssetMetrics(id),
  ]);

  const seriesByMetric = await Promise.all(
    metrics.map((metric) => getSeries({ assetIds: [id], metric, range })),
  );

  const payload: AssetDetailResponse = {
    asset,
    site,
    siblings,
    alerts,
    series: seriesByMetric.flatMap((entry) => entry.series),
  };
  res.json(payload);
});

assetsRouter.get("/:id/readings", async (req, res) => {
  const id = parseOrThrow(idParamSchema, req.params.id);
  const { metric, range } = parseOrThrow(assetSeriesQuerySchema, req.query);

  const metrics = await listAssetMetrics(id);
  if (metrics.length === 0) throw new HttpError(404, "Asset has no readings");

  const targets = metric ? metrics.filter((entry) => entry === metric) : metrics;
  if (targets.length === 0) {
    throw new HttpError(404, "Asset does not report that metric", `available: ${metrics.join(", ")}`);
  }

  const results = await Promise.all(
    targets.map((entry) => getSeries({ assetIds: [id], metric: entry, range })),
  );

  res.json({
    range,
    bucket: results[0]?.bucket ?? "hour",
    series: results.flatMap((entry) => entry.series),
  });
});
