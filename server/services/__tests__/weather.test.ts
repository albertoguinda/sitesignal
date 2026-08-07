import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock env before any module load
vi.mock("../../env", () => ({
  env: {
    WEATHER_BASE_URL: "https://api.open-meteo.com/v1/forecast",
    weatherCacheMs: 900000,
  },
}));

const mockOpenMeteoResponse = {
  current: {
    time: "2025-01-15T12:00",
    temperature_2m: 22.5,
    relative_humidity_2m: 65,
    wind_speed_10m: 12.3,
    precipitation: 0,
    weather_code: 1,
    is_day: 1,
  },
  hourly: {
    time: ["2025-01-15T13:00", "2025-01-15T14:00", "2025-01-15T15:00"],
    temperature_2m: [23.0, 22.8, 22.5],
    relative_humidity_2m: [64, 66, 67],
    precipitation_probability: [10, 20, 30],
  },
};

describe("weather.ts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00Z"));
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("describeWeatherCode", () => {
    it("returns correct descriptions for known codes", async () => {
      const { describeWeatherCode } = await import("../weather");
      expect(describeWeatherCode(0)).toBe("Clear sky");
      expect(describeWeatherCode(1)).toBe("Mainly clear");
      expect(describeWeatherCode(2)).toBe("Partly cloudy");
      expect(describeWeatherCode(3)).toBe("Overcast");
      expect(describeWeatherCode(45)).toBe("Fog");
      expect(describeWeatherCode(61)).toBe("Slight rain");
      expect(describeWeatherCode(65)).toBe("Heavy rain");
      expect(describeWeatherCode(95)).toBe("Thunderstorm");
    });

    it("returns 'Unknown conditions' for unknown code", async () => {
      const { describeWeatherCode } = await import("../weather");
      expect(describeWeatherCode(999)).toBe("Unknown conditions");
    });
  });

  describe("getAmbient", () => {
    const site1 = { id: 1, name: "Site 1", lat: 40.7128, lng: -74.006, timezone: "America/New_York" };
    const site2 = { id: 2, name: "Site 2", lat: 34.0522, lng: -118.2437, timezone: "America/Los_Angeles" };

    it("returns ambient summary on successful fetch", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockOpenMeteoResponse),
      });

      const { getAmbient } = await import("../weather");
      const result = await getAmbient(site1);

      expect(result).not.toBeNull();
      expect(result?.siteId).toBe(1);
      expect(result?.siteName).toBe("Site 1");
      expect(result?.current.temperature).toBe(22.5);
      expect(result?.current.humidity).toBe(65);
      expect(result?.current.windSpeed).toBe(12.3);
      expect(result?.current.description).toBe("Mainly clear");
      expect(result?.current.isDay).toBe(true);
      expect(result?.stale).toBe(false);
    });

    it("returns cached result on second call within cache window", async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockOpenMeteoResponse),
      });
      globalThis.fetch = fetchSpy;

      const { getAmbient } = await import("../weather");
      await getAmbient(site1);
      await getAmbient(site1);

      // Cache hit: fetch called only once
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("returns null on fetch failure with no cache", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const { getAmbient } = await import("../weather");
      const result = await getAmbient(site1);
      expect(result).toBeNull();
    });

    it("returns stale cached result on fetch failure with cache", async () => {
      // First call succeeds and caches
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockOpenMeteoResponse),
      });

      const { getAmbient } = await import("../weather");
      await getAmbient(site1);

      // Advance time past the cache window
      vi.setSystemTime(new Date("2025-01-15T15:00:00Z"));

      // Second call fails — should return stale cache
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
      const result = await getAmbient(site1);

      expect(result).not.toBeNull();
      expect(result?.stale).toBe(true);
    });

    it("handles missing current data gracefully", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const { getAmbient } = await import("../weather");
      const result = await getAmbient(site2); // Use different coords

      expect(result).not.toBeNull();
      expect(result?.current.temperature).toBe(0);
      expect(result?.current.description).toBe("Clear sky");
    });

    it("handles missing hourly data gracefully", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ current: mockOpenMeteoResponse.current }),
      });

      const { getAmbient } = await import("../weather");
      const site3 = { id: 3, name: "Site 3", lat: 51.5, lng: -0.1, timezone: "Europe/London" };
      const result = await getAmbient(site3);

      expect(result).not.toBeNull();
      expect(result?.forecast).toEqual([]);
    });
  });

  describe("getAmbientForSites", () => {
    const site1 = { id: 1, name: "Site 1", lat: 40.7128, lng: -74.006, timezone: "America/New_York" };
    const site2 = { id: 2, name: "Site 2", lat: 34.0522, lng: -118.2437, timezone: "America/Los_Angeles" };

    it("returns results for multiple sites", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockOpenMeteoResponse),
      });

      const { getAmbientForSites } = await import("../weather");
      const results = await getAmbientForSites([site1, site2]);
      expect(results).toHaveLength(2);
    });

    it("filters out failed sites", async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(mockOpenMeteoResponse) });
        }
        return Promise.reject(new Error("fail"));
      });

      const { getAmbientForSites } = await import("../weather");
      const results = await getAmbientForSites([site1, site2]);
      expect(results).toHaveLength(1);
    });

    it("returns empty array when all sites fail", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("fail"));

      const { getAmbientForSites } = await import("../weather");
      const results = await getAmbientForSites([site1]);
      expect(results).toHaveLength(0);
    });
  });
});
