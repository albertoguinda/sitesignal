import { Router } from "express";
import { getAnalytics } from "../db/queries";
import { analyticsQuerySchema, parseOrThrow } from "../http/validation";

export const analyticsRouter: Router = Router();

/** Multi-asset comparison for a single metric: `?assetIds=1,4,9&metric=temperature&range=7d`. */
analyticsRouter.get("/series", async (req, res) => {
  const { assetIds, metric, range } = parseOrThrow(analyticsQuerySchema, req.query);
  res.json(await getAnalytics({ assetIds, metric, range }));
});
