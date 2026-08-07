import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { useSites, useOverview, useAssets, useAlerts, useAsset, useAmbient, useAnalytics, queryKeys, ApiRequestError } from "../api";

// Create a wrapper for React Query
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe("useSites()", () => {
  it("fetches sites successfully", async () => {
    const mockSites = [
      { id: 1, name: "Site A", lat: 40.0, lng: -3.0, timezone: "Europe/Madrid" },
      { id: 2, name: "Site B", lat: 41.0, lng: -2.0, timezone: "Europe/Madrid" },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSites,
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useSites(undefined), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockSites);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/sites",
      expect.objectContaining({
        headers: { accept: "application/json" },
      })
    );
  });

  it("handles fetch error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "Internal server error" }),
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useSites(undefined), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });
});

describe("useOverview()", () => {
  it("fetches overview successfully", async () => {
    const mockOverview = {
      kpis: {
        assetsTotal: 10,
        assetsOk: 8,
        assetsWarning: 1,
        assetsCritical: 1,
        openAlerts: 2,
        ackAlerts: 1,
        resolvedAlerts: 5,
        healthScore: 80,
        readingsLast24h: 1000,
        averages: [],
      },
      assets: [],
      recentAlerts: [],
      ambient: [],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockOverview,
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useOverview(undefined, undefined), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockOverview);
  });

  it("passes siteId and orgId as query params", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ kpis: {}, assets: [], recentAlerts: [], ambient: [] }),
    });

    const wrapper = createWrapper();
    renderHook(() => useOverview(1, "org-123"), { wrapper });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/overview?siteId=1&orgId=org-123",
        expect.anything()
      );
    });
  });
});

describe("useAssets()", () => {
  it("fetches assets successfully", async () => {
    const mockAssets = [
      {
        id: 1,
        siteId: 1,
        name: "Pump A1",
        type: "pump",
        status: "ok",
        posX: 0,
        posY: 0,
        posZ: 0,
        installedAt: "2024-01-01",
        siteName: "Site A",
        siteTimezone: "Europe/Madrid",
        openAlerts: 0,
        worstSeverity: null,
        latest: [],
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockAssets,
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useAssets(undefined, undefined), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockAssets);
  });
});

describe("useAlerts()", () => {
  it("fetches alerts successfully", async () => {
    const mockAlerts = [
      {
        id: 1,
        assetId: 1,
        severity: "warning",
        message: "High temperature",
        state: "open",
        openedAt: "2024-01-01T10:00:00Z",
        assetName: "Pump A1",
        assetType: "pump",
        siteId: 1,
        siteName: "Site A",
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockAlerts,
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useAlerts(undefined, undefined), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockAlerts);
  });
});

describe("useAsset()", () => {
  it("fetches asset detail successfully", async () => {
    const mockAsset = {
      asset: { id: 1, siteId: 1, name: "Pump", type: "pump", status: "ok" },
      site: { id: 1, name: "Site A", lat: 40, lng: -3, timezone: "Europe/Madrid" },
      siblings: [],
      alerts: [],
      series: [],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockAsset,
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useAsset(1, "7d"), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockAsset);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/assets/1?range=7d",
      expect.anything()
    );
  });

  it("is disabled for invalid id", () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAsset(0, "7d"), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("useAmbient()", () => {
  it("fetches ambient data successfully", async () => {
    const mockAmbient = {
      siteId: 1,
      siteName: "Site A",
      timezone: "Europe/Madrid",
      current: { temperature: 22, humidity: 60, windSpeed: 10, precipitation: 0, weatherCode: 0, description: "Clear", isDay: true, time: "" },
      forecast: [],
      fetchedAt: "",
      stale: false,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockAmbient,
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useAmbient(1), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockAmbient);
  });

  it("is disabled when siteId is undefined", () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAmbient(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("useAnalytics()", () => {
  it("fetches analytics successfully", async () => {
    const mockAnalytics = {
      metric: "temperature",
      unit: "°C",
      range: "7d",
      bucket: "hour",
      series: [],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockAnalytics,
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useAnalytics([1, 2], "temperature", "7d"), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockAnalytics);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/analytics/series?assetIds=1,2&metric=temperature&range=7d",
      expect.anything()
    );
  });

  it("is disabled when assetIds is empty", () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAnalytics([], "temperature", "7d"), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("queryKeys", () => {
  it("generates correct keys for sites", () => {
    expect(queryKeys.sites(undefined)).toEqual(["sites", "all"]);
    expect(queryKeys.sites("org-1")).toEqual(["sites", "org-1"]);
  });

  it("generates correct keys for overview", () => {
    expect(queryKeys.overview(undefined, undefined)).toEqual(["overview", "all", "all"]);
    expect(queryKeys.overview(1, "org-1")).toEqual(["overview", 1, "org-1"]);
  });

  it("generates correct keys for assets", () => {
    expect(queryKeys.assets(undefined, undefined)).toEqual(["assets", "all", "all"]);
  });

  it("generates correct keys for asset detail", () => {
    expect(queryKeys.asset(1, "7d")).toEqual(["asset", 1, "7d"]);
  });

  it("generates correct keys for alerts", () => {
    expect(queryKeys.alerts(undefined, undefined)).toEqual(["alerts", "all", "all"]);
  });

  it("generates correct keys for ambient", () => {
    expect(queryKeys.ambient(1)).toEqual(["ambient", 1]);
  });

  it("generates correct keys for analytics", () => {
    expect(queryKeys.analytics([1, 2], "temperature", "7d")).toEqual(["analytics", "1,2", "temperature", "7d"]);
  });
});

describe("ApiRequestError", () => {
  it("stores status, message and detail", () => {
    const error = new ApiRequestError(404, "Not found", "id is required");
    expect(error.status).toBe(404);
    expect(error.message).toBe("Not found");
    expect(error.detail).toBe("id is required");
    expect(error.name).toBe("ApiRequestError");
  });

  it("stores status and message without detail", () => {
    const error = new ApiRequestError(500, "Server error");
    expect(error.status).toBe(500);
    expect(error.detail).toBeUndefined();
  });
});
