import { defineConfig } from "drizzle-kit";

/**
 * Migrations are dialect-level SQL: the same generated files apply to the
 * embedded PGlite instance and to a real Postgres server. `drizzle-kit generate`
 * never needs a live connection, so this config works before any DB exists.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./server/db/schema.ts",
  out: "./drizzle",
  strict: true,
  verbose: true,
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://localhost:5432/sitesignal",
  },
});
