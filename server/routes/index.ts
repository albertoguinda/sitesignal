import { Router } from "express";
import { alertsRouter } from "./alerts";
import { analyticsRouter } from "./analytics";
import { assetsRouter } from "./assets";
import { overviewRouter } from "./overview";
import { sitesRouter } from "./sites";
import { authRouter } from "./auth";
import { organizationsRouter } from "./organizations";
import { env } from "../env";

export const apiRouter: Router = Router();

apiRouter.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    driver: env.usingEmbeddedDb ? "pglite" : "postgres",
    uptime: Math.round(process.uptime()),
  });
});

// Auth routes (public)
apiRouter.use("/auth", authRouter);

// Protected routes (require authentication)
apiRouter.use("/overview", overviewRouter);
apiRouter.use("/sites", sitesRouter);
apiRouter.use("/assets", assetsRouter);
apiRouter.use("/alerts", alertsRouter);
apiRouter.use("/analytics", analyticsRouter);
apiRouter.use("/organizations", organizationsRouter);
