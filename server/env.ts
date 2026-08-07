import { z } from "zod";
import { resolve } from "node:path";

/**
 * Fail fast on malformed configuration rather than at the first query.
 * Everything has a working default so `npm run dev` needs no .env at all.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5174),
  DATABASE_URL: z.string().min(1).optional(),
  PGLITE_DIR: z.string().min(1).default("./data/sitesignal"),
  WEATHER_CACHE_MINUTES: z.coerce.number().int().positive().max(1440).default(15),
  WEATHER_BASE_URL: z.url().default("https://api.open-meteo.com/v1/forecast"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

const raw = parsed.data;

export const env = {
  ...raw,
  isProduction: raw.NODE_ENV === "production",
  pgliteDir: resolve(process.cwd(), raw.PGLITE_DIR),
  /** True when running on the bundled embedded Postgres. */
  usingEmbeddedDb: !raw.DATABASE_URL,
  weatherCacheMs: raw.WEATHER_CACHE_MINUTES * 60_000,
} as const;

export type Env = typeof env;
