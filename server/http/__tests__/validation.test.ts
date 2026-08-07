import { describe, it, expect } from "vitest";
import {
  siteScopeSchema,
  idParamSchema,
  metricSchema,
  rangeSchema,
  alertStateSchema,
  assetIdsSchema,
  overviewQuerySchema,
  alertsQuerySchema,
  analyticsQuerySchema,
  HttpError,
  parseOrThrow,
} from "../validation";

describe("validation.ts", () => {
  describe("siteScopeSchema", () => {
    it("transforms 'all' to undefined", () => {
      expect(siteScopeSchema.parse("all")).toBeUndefined();
    });

    it("coerces numeric string to number", () => {
      expect(siteScopeSchema.parse("42")).toBe(42);
    });

    it("accepts a number directly", () => {
      expect(siteScopeSchema.parse(5)).toBe(5);
    });

    it("defaults to undefined when omitted", () => {
      expect(siteScopeSchema.parse(undefined)).toBeUndefined();
    });
  });

  describe("idParamSchema", () => {
    it("coerces string to positive integer", () => {
      expect(idParamSchema.parse("42")).toBe(42);
    });

    it("rejects zero", () => {
      expect(() => idParamSchema.parse("0")).toThrow();
    });

    it("rejects negative", () => {
      expect(() => idParamSchema.parse("-1")).toThrow();
    });
  });

  describe("metricSchema", () => {
    it("accepts valid metrics", () => {
      expect(metricSchema.parse("temperature")).toBe("temperature");
      expect(metricSchema.parse("vibration")).toBe("vibration");
      expect(metricSchema.parse("humidity")).toBe("humidity");
    });

    it("rejects invalid metric", () => {
      expect(() => metricSchema.parse("pressure")).toThrow();
    });
  });

  describe("rangeSchema", () => {
    it("accepts valid ranges", () => {
      expect(rangeSchema.parse("24h")).toBe("24h");
      expect(rangeSchema.parse("7d")).toBe("7d");
      expect(rangeSchema.parse("30d")).toBe("30d");
      expect(rangeSchema.parse("60d")).toBe("60d");
    });

    it("rejects invalid range", () => {
      expect(() => rangeSchema.parse("12h")).toThrow();
    });
  });

  describe("alertStateSchema", () => {
    it("accepts valid states", () => {
      expect(alertStateSchema.parse("open")).toBe("open");
      expect(alertStateSchema.parse("ack")).toBe("ack");
      expect(alertStateSchema.parse("resolved")).toBe("resolved");
    });

    it("rejects invalid state", () => {
      expect(() => alertStateSchema.parse("closed")).toThrow();
    });
  });

  describe("assetIdsSchema", () => {
    it("parses comma-separated IDs", () => {
      expect(assetIdsSchema.parse("1,2,3")).toEqual([1, 2, 3]);
    });

    it("deduplicates IDs", () => {
      expect(assetIdsSchema.parse("1,1,2")).toEqual([1, 2]);
    });

    it("filters invalid IDs", () => {
      expect(assetIdsSchema.parse("1,abc,3")).toEqual([1, 3]);
    });

    it("rejects empty array", () => {
      expect(() => assetIdsSchema.parse("")).toThrow();
    });

    it("rejects more than 6 IDs", () => {
      expect(() => assetIdsSchema.parse("1,2,3,4,5,6,7")).toThrow();
    });

    it("rejects zero IDs", () => {
      expect(() => assetIdsSchema.parse("0")).toThrow();
    });
  });

  describe("overviewQuerySchema", () => {
    it("parses with default siteId", () => {
      expect(overviewQuerySchema.parse({})).toEqual({ siteId: undefined });
    });

    it("parses with siteId", () => {
      expect(overviewQuerySchema.parse({ siteId: "5" })).toEqual({ siteId: 5 });
    });

    it("parses with siteId=all", () => {
      expect(overviewQuerySchema.parse({ siteId: "all" })).toEqual({ siteId: undefined });
    });
  });

  describe("alertsQuerySchema", () => {
    it("parses with defaults", () => {
      const result = alertsQuerySchema.parse({});
      expect(result).toEqual({
        siteId: undefined,
        assetId: undefined,
        state: undefined,
        limit: 50,
      });
    });

    it("parses with all options", () => {
      const result = alertsQuerySchema.parse({
        siteId: "3",
        assetId: "7",
        state: "open",
        limit: "10",
      });
      expect(result).toEqual({
        siteId: 3,
        assetId: 7,
        state: "open",
        limit: 10,
      });
    });

    it("rejects limit > 200", () => {
      expect(() => alertsQuerySchema.parse({ limit: "300" })).toThrow();
    });
  });

  describe("analyticsQuerySchema", () => {
    it("parses with defaults", () => {
      const result = analyticsQuerySchema.parse({ assetIds: "1,2" });
      expect(result).toEqual({
        assetIds: [1, 2],
        metric: "temperature",
        range: "7d",
      });
    });

    it("rejects missing assetIds", () => {
      expect(() => analyticsQuerySchema.parse({})).toThrow();
    });
  });

  describe("HttpError", () => {
    it("stores status and message", () => {
      const error = new HttpError(404, "Not found");
      expect(error.status).toBe(404);
      expect(error.message).toBe("Not found");
      expect(error.name).toBe("HttpError");
    });

    it("stores optional detail", () => {
      const error = new HttpError(400, "Bad request", "field is required");
      expect(error.detail).toBe("field is required");
    });
  });

  describe("parseOrThrow", () => {
    it("returns parsed data on success", () => {
      const result = parseOrThrow(overviewQuerySchema, {});
      expect(result).toEqual({ siteId: undefined });
    });

    it("throws HttpError with 400 on failure", () => {
      expect(() =>
        parseOrThrow(metricSchema, "invalid")
      ).toThrow(HttpError);

      try {
        parseOrThrow(metricSchema, "invalid");
      } catch (e) {
        expect((e as HttpError).status).toBe(400);
        expect((e as HttpError).detail).toContain("query");
      }
    });
  });
});
