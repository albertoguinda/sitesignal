import { Router } from "express";
import { getSite, listSites } from "../db/queries";
import { getAmbient, getAmbientForSites } from "../services/weather";
import { HttpError, idParamSchema, parseOrThrow } from "../http/validation";

export const sitesRouter: Router = Router();

sitesRouter.get("/", async (_req, res) => {
  res.json(await listSites());
});

/** Ambient conditions for every site, in one call, for the overview header. */
sitesRouter.get("/ambient", async (_req, res) => {
  const sites = await listSites();
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
