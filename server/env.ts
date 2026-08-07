import { z } from "zod";
import { resolve } from "node:path";

/**
 * Fail fast on malformed configuration rather than at the first query.
 * Everything has a working default so `npm run dev` needs no .env at all.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  /**
   * The single public port. Replit injects PORT and maps it to the external
   * URL, so production serves the API *and* the built client from here.
   */
  PORT: z.coerce.number().int().positive().default(5000),
  /**
   * Development only. Vite owns PORT so the browser talks to one origin; the
   * Express process moves aside to this internal port and Vite proxies /api.
   */
  API_PORT: z.coerce.number().int().positive().default(5174),
  /** 0.0.0.0 is required for a container port to be reachable from outside. */
  HOST: z.string().min(1).default("0.0.0.0"),
  DATABASE_URL: z.string().min(1).optional(),
  PGLITE_DIR: z.string().min(1).default("./data/sitesignal"),
  SEED_READINGS: z.coerce.number().int().positive().max(5_000_000).default(18_000),
  WEATHER_CACHE_MINUTES: z.coerce.number().int().positive().max(1440).default(15),
  WEATHER_BASE_URL: z.url().default("https://api.open-meteo.com/v1/forecast"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

const raw = parsed.data;

/**
 * `--dev` is passed by `npm run dev:api` only. It is an argv flag rather than
 * an env var so the dev scripts stay identical on Windows and Linux without
 * pulling in cross-env.
 */
const isDevServer = process.argv.includes("--dev");

export const env = {
  ...raw,
  isProduction: raw.NODE_ENV === "production",
  isDevServer,
  /** Where Express actually binds: aside in dev, the public port in production. */
  listenPort: isDevServer ? raw.API_PORT : raw.PORT,
  pgliteDir: resolve(process.cwd(), raw.PGLITE_DIR),
  /** True when running on the bundled embedded Postgres. */
  usingEmbeddedDb: !raw.DATABASE_URL,
  weatherCacheMs: raw.WEATHER_CACHE_MINUTES * 60_000,
} as const;

export type Env = typeof env;
