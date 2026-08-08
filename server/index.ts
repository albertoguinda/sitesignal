import { existsSync } from "node:fs";
import { env } from "./env";
import { closeDatabase } from "./db/client";
import { prepareDatabase, createApp } from "./app";

const DIST_DIR = import.meta.dirname
  ? new URL("../dist", import.meta.url).pathname
  : "dist";

async function bootstrap(): Promise<void> {
  await prepareDatabase();

  const app = createApp();

  const server = app.listen(env.listenPort, env.HOST, () => {
    const driver = env.usingEmbeddedDb ? `pglite (${env.PGLITE_DIR})` : "postgres";
    const role = env.isDevServer ? "api only, Vite serves the client" : "api + client";
    console.log(
      `[api] listening on http://${env.HOST}:${env.listenPort} · ${role} · db: ${driver}`,
    );
    if (!existsSync(DIST_DIR) && !env.isDevServer) {
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
