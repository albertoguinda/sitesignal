import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type {
  AmbientSummary,
  AnalyticsResponse,
  AssetDetailResponse,
  AssetRow,
  AlertWithAsset,
  Metric,
  OverviewResponse,
  RangeKey,
  Site,
} from "@shared/types";

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly detail?: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api${path}`, {
    signal: signal ?? null,
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    let message = `Request failed with ${response.status}`;
    let detail: string | undefined;
    try {
      const body = (await response.json()) as { error?: string; detail?: string };
      if (body.error) message = body.error;
      detail = body.detail;
    } catch {
      // Non-JSON error body — keep the status-derived message.
    }
    throw new ApiRequestError(response.status, message, detail);
  }

  return (await response.json()) as T;
}

/** `undefined` means "all sites"; the API treats a missing param the same way. */
function siteParam(siteId: number | undefined): string {
  return siteId === undefined ? "" : `?siteId=${siteId}`;
}

export const queryKeys = {
  sites: ["sites"] as const,
  overview: (siteId: number | undefined) => ["overview", siteId ?? "all"] as const,
  assets: (siteId: number | undefined) => ["assets", siteId ?? "all"] as const,
  asset: (id: number, range: RangeKey) => ["asset", id, range] as const,
  alerts: (siteId: number | undefined) => ["alerts", siteId ?? "all"] as const,
  ambient: (siteId: number) => ["ambient", siteId] as const,
  analytics: (assetIds: number[], metric: Metric, range: RangeKey) =>
    ["analytics", assetIds.join(","), metric, range] as const,
};

/** Ambient data is cached server-side for 15 min; mirror that on the client. */
const AMBIENT_STALE_MS = 15 * 60 * 1000;
const TELEMETRY_STALE_MS = 60 * 1000;

export function useSites(): UseQueryResult<Site[]> {
  return useQuery({
    queryKey: queryKeys.sites,
    queryFn: ({ signal }) => request<Site[]>("/sites", signal),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useOverview(siteId: number | undefined): UseQueryResult<OverviewResponse> {
  return useQuery({
    queryKey: queryKeys.overview(siteId),
    queryFn: ({ signal }) => request<OverviewResponse>(`/overview${siteParam(siteId)}`, signal),
    staleTime: TELEMETRY_STALE_MS,
    refetchInterval: TELEMETRY_STALE_MS,
  });
}

export function useAssets(siteId: number | undefined): UseQueryResult<AssetRow[]> {
  return useQuery({
    queryKey: queryKeys.assets(siteId),
    queryFn: ({ signal }) => request<AssetRow[]>(`/assets${siteParam(siteId)}`, signal),
    staleTime: TELEMETRY_STALE_MS,
  });
}

export function useAsset(id: number, range: RangeKey): UseQueryResult<AssetDetailResponse> {
  return useQuery({
    queryKey: queryKeys.asset(id, range),
    queryFn: ({ signal }) =>
      request<AssetDetailResponse>(`/assets/${id}?range=${range}`, signal),
    staleTime: TELEMETRY_STALE_MS,
    enabled: Number.isInteger(id) && id > 0,
  });
}

export function useAlerts(siteId: number | undefined): UseQueryResult<AlertWithAsset[]> {
  return useQuery({
    queryKey: queryKeys.alerts(siteId),
    queryFn: ({ signal }) => request<AlertWithAsset[]>(`/alerts${siteParam(siteId)}`, signal),
    staleTime: TELEMETRY_STALE_MS,
  });
}

export function useAmbient(siteId: number | undefined): UseQueryResult<AmbientSummary> {
  return useQuery({
    queryKey: queryKeys.ambient(siteId ?? 0),
    queryFn: ({ signal }) => request<AmbientSummary>(`/sites/${siteId}/ambient`, signal),
    staleTime: AMBIENT_STALE_MS,
    enabled: siteId !== undefined,
    retry: 1,
  });
}

export function useAnalytics(
  assetIds: number[],
  metric: Metric,
  range: RangeKey,
): UseQueryResult<AnalyticsResponse> {
  return useQuery({
    queryKey: queryKeys.analytics(assetIds, metric, range),
    queryFn: ({ signal }) =>
      request<AnalyticsResponse>(
        `/analytics/series?assetIds=${assetIds.join(",")}&metric=${metric}&range=${range}`,
        signal,
      ),
    staleTime: TELEMETRY_STALE_MS,
    enabled: assetIds.length > 0,
    placeholderData: (previous) => previous,
  });
}
