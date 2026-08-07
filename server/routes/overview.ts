import { Router } from "express";
import { getOverviewKpis, listAlerts, listAssetRows, listSites } from "../db/queries";
import { getAmbientForSites } from "../services/weather";
import { overviewQuerySchema, parseOrThrow } from "../http/validation";
import type { OverviewResponse } from "../../shared/types";

export const overviewRouter: Router = Router();

/**
 * Everything the landing screen needs in one round trip: KPIs, the asset table,
 * the recent-alert feed and ambient conditions for the sites in scope.
 */
overviewRouter.get("/", async (req, res) => {
  const { siteId } = parseOrThrow(overviewQuerySchema, req.query);
  const organizationId = req.query.orgId as string | undefined;

  const [kpis, assets, recentAlerts, sites] = await Promise.all([
    getOverviewKpis(siteId, organizationId),
    listAssetRows({ siteId, organizationId }),
    listAlerts({ siteId, limit: 8, organizationId }),
    listSites(organizationId),
  ]);

  const scopedSites = siteId === undefined ? sites : sites.filter((site) => site.id === siteId);
  const ambient = await getAmbientForSites(scopedSites);

  const payload: OverviewResponse = { kpis, assets, recentAlerts, ambient };
  res.json(payload);
});
