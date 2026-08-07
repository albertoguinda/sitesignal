import express from "express";
import cookieParser from "cookie-parser";
import { ZodError } from "zod";
import { apiRouter } from "../routes";
import { authenticate } from "../middleware/auth";
import { HttpError } from "../http/validation";
import type { ApiError } from "../../shared/types";

/**
 * Creates a test Express app without starting the server.
 * This allows us to test routes in isolation.
 */
export function createTestApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(cookieParser());
  app.use(express.json({ limit: "64kb" }));
  app.use(authenticate);

  app.use("/api", apiRouter);

  // Error handler (mirrors server/index.ts)
  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof HttpError) {
      const body: ApiError = { error: error.message, ...(error.detail && { detail: error.detail }) };
      res.status(error.status).json(body);
      return;
    }

    if (error instanceof ZodError) {
      const messages = error.issues.map((i) => i.message).join(", ");
      const body: ApiError = { error: messages };
      res.status(400).json(body);
      return;
    }

    console.error("[test] unhandled error:", error);
    const body: ApiError = { error: "Internal server error" };
    res.status(500).json(body);
  });

  return app;
}
