import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  readToken,
  invalidateTokenCache,
  statusColor,
  metricColor,
  chartColor,
  STATUS_TOKEN,
  SEVERITY_TOKEN,
  METRIC_TOKEN,
  CHART_TOKENS,
  COLOR_TOKEN_GROUPS,
  TYPE_SCALE,
  SPACE_SCALE,
  RADIUS_SCALE,
  ELEVATION_SCALE,
  MOTION_SCALE,
} from "../tokens";

describe("tokens.ts", () => {
  beforeEach(() => {
    invalidateTokenCache();
    vi.restoreAllMocks();
  });

  describe("readToken", () => {
    it("reads CSS variable from document", () => {
      vi.spyOn(window, "getComputedStyle").mockReturnValue({
        getPropertyValue: () => "  #000  ",
      } as unknown as CSSStyleDeclaration);
      expect(readToken("--sig-graphite-950")).toBe("#000");
    });

    it("caches values after first read", () => {
      const spy = vi.spyOn(window, "getComputedStyle").mockReturnValue({
        getPropertyValue: () => "#123",
      } as unknown as CSSStyleDeclaration);
      readToken("--sig-brand");
      readToken("--sig-brand");
      // getComputedStyle is called once per unique token
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("returns empty string if property not set", () => {
      vi.spyOn(window, "getComputedStyle").mockReturnValue({
        getPropertyValue: () => "",
      } as unknown as CSSStyleDeclaration);
      expect(readToken("--nonexistent-token")).toBe("");
    });
  });

  describe("invalidateTokenCache", () => {
    it("clears cache so next read hits DOM again", () => {
      const spy = vi.spyOn(window, "getComputedStyle").mockReturnValue({
        getPropertyValue: () => "#123",
      } as unknown as CSSStyleDeclaration);
      readToken("--sig-brand");
      invalidateTokenCache();
      readToken("--sig-brand");
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });

  describe("statusColor", () => {
    it("reads the correct token for ok", () => {
      vi.spyOn(window, "getComputedStyle").mockReturnValue({
        getPropertyValue: () => "#0f0",
      } as unknown as CSSStyleDeclaration);
      expect(statusColor("ok")).toBe("#0f0");
    });

    it("reads the correct token for warning", () => {
      vi.spyOn(window, "getComputedStyle").mockReturnValue({
        getPropertyValue: () => "#ff0",
      } as unknown as CSSStyleDeclaration);
      expect(statusColor("warning")).toBe("#ff0");
    });

    it("reads the correct token for critical", () => {
      vi.spyOn(window, "getComputedStyle").mockReturnValue({
        getPropertyValue: () => "#f00",
      } as unknown as CSSStyleDeclaration);
      expect(statusColor("critical")).toBe("#f00");
    });
  });

  describe("metricColor", () => {
    it("reads the correct token for temperature", () => {
      vi.spyOn(window, "getComputedStyle").mockReturnValue({
        getPropertyValue: () => "#f00",
      } as unknown as CSSStyleDeclaration);
      expect(metricColor("temperature")).toBe("#f00");
    });

    it("reads the correct token for vibration", () => {
      vi.spyOn(window, "getComputedStyle").mockReturnValue({
        getPropertyValue: () => "#0f0",
      } as unknown as CSSStyleDeclaration);
      expect(metricColor("vibration")).toBe("#0f0");
    });

    it("reads the correct token for humidity", () => {
      vi.spyOn(window, "getComputedStyle").mockReturnValue({
        getPropertyValue: () => "#00f",
      } as unknown as CSSStyleDeclaration);
      expect(metricColor("humidity")).toBe("#00f");
    });
  });

  describe("chartColor", () => {
    it("returns first chart color for index 0", () => {
      vi.spyOn(window, "getComputedStyle").mockReturnValue({
        getPropertyValue: () => "#111",
      } as unknown as CSSStyleDeclaration);
      expect(chartColor(0)).toBe("#111");
    });

    it("wraps around with modulo", () => {
      vi.spyOn(window, "getComputedStyle").mockReturnValue({
        getPropertyValue: () => "#222",
      } as unknown as CSSStyleDeclaration);
      expect(chartColor(6)).toBe("#222"); // 6 % 6 = 0
    });
  });

  describe("constants", () => {
    it("STATUS_TOKEN has all asset statuses", () => {
      expect(Object.keys(STATUS_TOKEN)).toEqual(["ok", "warning", "critical"]);
    });

    it("SEVERITY_TOKEN has all alert severities", () => {
      expect(Object.keys(SEVERITY_TOKEN)).toEqual(["info", "warning", "critical"]);
    });

    it("METRIC_TOKEN has all metrics", () => {
      expect(Object.keys(METRIC_TOKEN)).toEqual(["temperature", "vibration", "humidity"]);
    });

    it("CHART_TOKENS has 6 entries", () => {
      expect(CHART_TOKENS).toHaveLength(6);
    });

    it("COLOR_TOKEN_GROUPS has 6 groups", () => {
      expect(COLOR_TOKEN_GROUPS).toHaveLength(6);
      COLOR_TOKEN_GROUPS.forEach((group) => {
        expect(group).toHaveProperty("title");
        expect(group).toHaveProperty("blurb");
        expect(group).toHaveProperty("layer");
        expect(group).toHaveProperty("tokens");
        expect(Array.isArray(group.tokens)).toBe(true);
        expect(group.tokens.length).toBeGreaterThan(0);
      });
    });

    it("TYPE_SCALE has 10 entries", () => {
      expect(TYPE_SCALE).toHaveLength(10);
    });

    it("SPACE_SCALE has 11 entries", () => {
      expect(SPACE_SCALE).toHaveLength(11);
    });

    it("RADIUS_SCALE has 6 entries", () => {
      expect(RADIUS_SCALE).toHaveLength(6);
    });

    it("ELEVATION_SCALE has 3 entries", () => {
      expect(ELEVATION_SCALE).toHaveLength(3);
    });

    it("MOTION_SCALE has 4 entries", () => {
      expect(MOTION_SCALE).toHaveLength(4);
    });
  });
});
