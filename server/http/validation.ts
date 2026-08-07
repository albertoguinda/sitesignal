import { z } from "zod";
import { METRICS, RANGES, ALERT_STATES } from "../../shared/types";

/** `?siteId=all` (or omitted) means "every site"; anything else must be an id. */
export const siteScopeSchema = z
  .union([z.literal("all"), z.coerce.number().int().positive()])
  .default("all")
  .transform((value) => (value === "all" ? undefined : value));

export const idParamSchema = z.coerce.number().int().positive();

export const metricSchema = z.enum(METRICS);
export const rangeSchema = z.enum(RANGES);
export const alertStateSchema = z.enum(ALERT_STATES);

/** `?assetIds=3,7,12` — deduplicated, capped so one request cannot fan out. */
export const assetIdsSchema = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((part) => Number.parseInt(part.trim(), 10))
      .filter((id) => Number.isInteger(id) && id > 0),
  )
  .pipe(z.array(z.number().int().positive()).min(1).max(6))
  .transform((ids) => [...new Set(ids)]);

export const overviewQuerySchema = z.object({
  siteId: siteScopeSchema,
});

export const assetsQuerySchema = z.object({
  siteId: siteScopeSchema,
});

export const assetSeriesQuerySchema = z.object({
  metric: metricSchema.optional(),
  range: rangeSchema.default("7d"),
});

export const analyticsQuerySchema = z.object({
  assetIds: assetIdsSchema,
  metric: metricSchema.default("temperature"),
  range: rangeSchema.default("7d"),
});

export const alertsQuerySchema = z.object({
  siteId: siteScopeSchema,
  assetId: z.coerce.number().int().positive().optional(),
  state: alertStateSchema.optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly detail?: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** Turns a Zod failure into a 400 carrying the offending field paths. */
export function parseOrThrow<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const detail = result.error.issues
    .map((issue) => `${issue.path.join(".") || "query"}: ${issue.message}`)
    .join("; ");
  throw new HttpError(400, "Invalid request parameters", detail);
}
