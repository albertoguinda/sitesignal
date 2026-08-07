import { Router } from "express";
import { getSite, listSites } from "../db/queries";
import { getAmbient, getAmbientForSites } from "../services/weather";
import { HttpError, idParamSchema, parseOrThrow } from "../http/validation";

export const sitesRouter: Router = Router();

sitesRouter.get("/", async (req, res) => {
  const organizationId = req.query.orgId as string | undefined;
  res.json(await listSites(organizationId));
});

/** Ambient conditions for every site, in one call, for the overview header. */
sitesRouter.get("/ambient", async (req, res) => {
  const organizationId = req.query.orgId as string | undefined;
  const sites = await listSites(organizationId);
  res.json(await getAmbientForSites(sites));
});

sitesRouter.get("/:id", async (req, res) => {
  const id = parseOrThrow(idParamSchema, req.params.id);
  const site = await getSite(id);
  if (!site) throw new HttpError(404, "Site not found");
  res.json(site);
});

sitesRouter.get("/:id/ambient", async (req, res) => {
  const id = parseOrThrow(idParamSchema, req.params.id);
  const site = await getSite(id);
  if (!site) throw new HttpError(404, "Site not found");

  const ambient = await getAmbient(site);
  if (!ambient) {
    throw new HttpError(502, "Ambient conditions unavailable", "Open-Meteo request failed");
  }
  res.json(ambient);
});
