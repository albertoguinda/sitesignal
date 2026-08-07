import { Router } from "express";
import { listAlerts } from "../db/queries";
import { alertsQuerySchema, parseOrThrow } from "../http/validation";

export const alertsRouter: Router = Router();

alertsRouter.get("/", async (req, res) => {
  const { siteId, assetId, state, limit } = parseOrThrow(alertsQuerySchema, req.query);
  const organizationId = req.query.orgId as string | undefined;
  res.json(await listAlerts({ siteId, assetId, state, limit, organizationId }));
});
