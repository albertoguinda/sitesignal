import { existsSync } from "node:fs";
import { resolve } from "node:path";
import express, { type ErrorRequestHandler, type RequestHandler } from "express";
import compression from "compression";
import { env } from "./env";
import { apiRouter } from "./routes";
import { HttpError } from "./http/validation";
import { closeDatabase } from "./db/client";
import { runMigrations } from "./db/migrate";
import { seedDatabase } from "./db/seed";
import type { ApiError } from "../shared/types";

const DIST_DIR = resolve(process.cwd(), "dist");

const securityHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
};

const notFound: RequestHandler = (_req, res) => {
  const body: ApiError = { error: "Not found" };
  res.status(404).json(body);
};

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    const body: ApiError = { error: error.message, ...(error.detail && { detail: error.detail }) };
    res.status(error.status).json(body);
    return;
  }

  console.error("[api] unhandled error:", error);
  const body: ApiError = { error: "Internal server error" };
  res.status(500).json(body);
};

async function bootstrap(): Promise<void> {
  // Schema first, then data: a fresh clone must land on a populated dashboard,
  // never on an empty one.
  await runMigrations();
  const seed = await seedDatabase();
  if (!seed.skipped) {
    console.log(
      `[db] seeded ${seed.sites} sites · ${seed.assets} assets · ` +
        `${seed.readings.toLocaleString("en-US")} readings · ${seed.alerts} alerts`,
    );
  }

  const app = express();
  app.disable("x-powered-by");
  app.use(compression());
  app.use(securityHeaders);
  app.use(express.json({ limit: "64kb" }));

  app.use("/api", apiRouter);
  app.use("/api", notFound);

  // In production the same process serves the built SPA; in development Vite
  // owns the client and proxies /api here.
  if (existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR, { maxAge: "1h", index: false }));
    app.get(/.*/, (_req, res) => {
      res.sendFile(resolve(DIST_DIR, "index.html"));
    });
  }

  app.use(errorHandler);

  const server = app.listen(env.PORT, () => {
    const driver = env.usingEmbeddedDb ? `pglite (${env.PGLITE_DIR})` : "postgres";
    console.log(`[api] listening on http://localhost:${env.PORT} · db: ${driver}`);
    if (!existsSync(DIST_DIR)) {
      console.log("[api] no dist/ build found — run the Vite dev server for the UI");
    }
  });

  const shutdown = (signal: string) => {
    console.log(`\n[api] ${signal} received, shutting down`);
    server.close(() => {
      void closeDatabase().finally(() => process.exit(0));
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

bootstrap().catch((error: unknown) => {
  console.error("[api] failed to start:", error);
  process.exit(1);
});
