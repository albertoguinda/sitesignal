import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import express, { type ErrorRequestHandler, type RequestHandler } from "express";
import compression from "compression";
import cookieParser from "cookie-parser";
import { ZodError } from "zod";
import { env } from "./env";
import { apiRouter } from "./routes";
import { HttpError } from "./http/validation";
import { closeDatabase } from "./db/client";
import { runMigrations } from "./db/migrate";
import { seedDatabase } from "./db/seed";
import { hasLiveDataDir, hasSnapshot, restoreSnapshot } from "./db/snapshot";
import { refreshDataRecency } from "./db/recency";
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

  if (error instanceof ZodError) {
    const messages = error.issues.map((i) => i.message).join(", ");
    const body: ApiError = { error: messages };
    res.status(400).json(body);
    return;
  }

  console.error("[api] unhandled error:", error);
  const body: ApiError = { error: "Internal server error" };
  res.status(500).json(body);
};

function logSeed(seed: Awaited<ReturnType<typeof seedDatabase>>): void {
  if (seed.skipped) {
    console.log("[db] existing dataset detected — skipping seed");
    return;
  }
  console.log(
    `[db] seeded ${seed.sites} sites · ${seed.assets} assets · ` +
      `${seed.readings.toLocaleString("en-US")} readings · ${seed.alerts} alerts`,
  );
}

/**
 * Schema first, then data: a fresh clone must land on a populated dashboard,
 * never on an empty one.
 *
 * The repository ships a pre-seeded PGlite directory so a fork boots full
 * without paying for the seed. If that directory cannot be opened — a partial
 * checkout, a different engine build — the embedded database is rebuilt from
 * scratch instead of failing the boot. A configured external Postgres is never
 * touched: that error propagates.
 */
async function prepareDatabase(): Promise<void> {
  try {
    if (env.usingEmbeddedDb && !hasLiveDataDir() && hasSnapshot()) {
      const startedAt = Date.now();
      await restoreSnapshot();
      console.log(`[db] restored shipped snapshot in ${Date.now() - startedAt} ms`);
    }
    await runMigrations();
    logSeed(await seedDatabase());
    await slideDatasetForward();
    return;
  } catch (error) {
    if (!env.usingEmbeddedDb) throw error;
    console.warn(
      `[db] embedded database unusable (${(error as Error).message}) — rebuilding from seed`,
    );
  }

  try {
    await closeDatabase();
  } catch {
    // Already broken; the directory is about to be removed anyway.
  }
  rmSync(env.pgliteDir, { recursive: true, force: true });

  await runMigrations();
  logSeed(await seedDatabase());
  await slideDatasetForward();
}

async function slideDatasetForward(): Promise<void> {
  const shiftHours = await refreshDataRecency();
  if (shiftHours > 0) {
    console.log(`[db] shipped dataset was ${shiftHours} h stale — slid forward to now`);
  }
}

async function bootstrap(): Promise<void> {
  await prepareDatabase();

  const app = express();
  app.disable("x-powered-by");
  app.use(compression());
  app.use(securityHeaders);
  app.use(cookieParser());
  app.use(express.json({ limit: "64kb" }));
  // authenticate middleware removed — demo mode, no auth required

  app.use("/api", apiRouter);
  // Every unmatched /api path terminates here with JSON, so the SPA fallback
  // below can never swallow an API request and answer it with index.html.
  app.use("/api", notFound);

  // Production serves the built client from this same process and port; in
  // development Vite owns the public port and proxies /api back here.
  const hasBuild = existsSync(DIST_DIR);
  if (hasBuild) {
    app.use(express.static(DIST_DIR, { maxAge: "1h", index: false }));
    app.get(/.*/, (_req, res) => {
      res.sendFile(resolve(DIST_DIR, "index.html"));
    });
  }

  app.use(errorHandler);

  const server = app.listen(env.listenPort, env.HOST, () => {
    const driver = env.usingEmbeddedDb ? `pglite (${env.PGLITE_DIR})` : "postgres";
    const role = env.isDevServer ? "api only, Vite serves the client" : "api + client";
    console.log(
      `[api] listening on http://${env.HOST}:${env.listenPort} · ${role} · db: ${driver}`,
    );
    if (!hasBuild && !env.isDevServer) {
      console.warn("[api] no dist/ build found — run `npm run build` before `npm start`");
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
  // A misconfigured external database is the common case here; print the
  // actionable line first and keep the stack for everything else.
  console.error(`[api] failed to start: ${(error as Error).message}`);
  if (!(error instanceof Error) || !error.cause) console.error(error);
  process.exit(1);
});
