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

export const queryKeys = {
  sites: (orgId: string | undefined) => ["sites", orgId ?? "all"] as const,
  overview: (siteId: number | undefined, orgId: string | undefined) =>
    ["overview", siteId ?? "all", orgId ?? "all"] as const,
  assets: (siteId: number | undefined, orgId: string | undefined) =>
    ["assets", siteId ?? "all", orgId ?? "all"] as const,
  asset: (id: number, range: RangeKey) => ["asset", id, range] as const,
  alerts: (siteId: number | undefined, orgId: string | undefined) =>
    ["alerts", siteId ?? "all", orgId ?? "all"] as const,
  ambient: (siteId: number) => ["ambient", siteId] as const,
  analytics: (assetIds: number[], metric: Metric, range: RangeKey) =>
    ["analytics", assetIds.join(","), metric, range] as const,
};

/** Ambient data is cached server-side for 15 min; mirror that on the client. */
const AMBIENT_STALE_MS = 15 * 60 * 1000;
const TELEMETRY_STALE_MS = 60 * 1000;

export function useSites(orgId: string | undefined): UseQueryResult<Site[]> {
  return useQuery({
    queryKey: queryKeys.sites(orgId),
    queryFn: ({ signal }) =>
      request<Site[]>(`/sites${orgId ? `?orgId=${orgId}` : ""}`, signal),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useOverview(
  siteId: number | undefined,
  orgId: string | undefined,
): UseQueryResult<OverviewResponse> {
  const params = new URLSearchParams();
  if (siteId !== undefined) params.set("siteId", String(siteId));
  if (orgId !== undefined) params.set("orgId", orgId);
  const qs = params.toString();

  return useQuery({
    queryKey: queryKeys.overview(siteId, orgId),
    queryFn: ({ signal }) =>
      request<OverviewResponse>(`/overview${qs ? `?${qs}` : ""}`, signal),
    staleTime: TELEMETRY_STALE_MS,
    refetchInterval: TELEMETRY_STALE_MS,
  });
}

export function useAssets(
  siteId: number | undefined,
  orgId: string | undefined,
): UseQueryResult<AssetRow[]> {
  const params = new URLSearchParams();
  if (siteId !== undefined) params.set("siteId", String(siteId));
  if (orgId !== undefined) params.set("orgId", orgId);
  const qs = params.toString();

  return useQuery({
    queryKey: queryKeys.assets(siteId, orgId),
    queryFn: ({ signal }) =>
      request<AssetRow[]>(`/assets${qs ? `?${qs}` : ""}`, signal),
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

export function useAlerts(
  siteId: number | undefined,
  orgId: string | undefined,
): UseQueryResult<AlertWithAsset[]> {
  const params = new URLSearchParams();
  if (siteId !== undefined) params.set("siteId", String(siteId));
  if (orgId !== undefined) params.set("orgId", orgId);
  const qs = params.toString();

  return useQuery({
    queryKey: queryKeys.alerts(siteId, orgId),
    queryFn: ({ signal }) =>
      request<AlertWithAsset[]>(`/alerts${qs ? `?${qs}` : ""}`, signal),
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
