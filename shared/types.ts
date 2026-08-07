/**
 * Contract shared by the Express API and the React client.
 * Server handlers return these shapes; the client consumes them verbatim.
 */

export const ASSET_STATUSES = ["ok", "warning", "critical"] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const ALERT_SEVERITIES = ["info", "warning", "critical"] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

export const ALERT_STATES = ["open", "ack", "resolved"] as const;
export type AlertState = (typeof ALERT_STATES)[number];

export const METRICS = ["temperature", "vibration", "humidity"] as const;
export type Metric = (typeof METRICS)[number];

export const METRIC_UNITS: Record<Metric, string> = {
  temperature: "°C",
  vibration: "mm/s",
  humidity: "%",
};

export const ASSET_TYPES = [
  "pump",
  "compressor",
  "chiller",
  "turbine",
  "transformer",
  "conveyor",
  "boiler",
  "hvac",
  "tank",
] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const RANGES = ["24h", "7d", "30d", "60d"] as const;
export type RangeKey = (typeof RANGES)[number];

export interface Site {
  id: number;
  name: string;
  lat: number;
  lng: number;
  timezone: string;
}

export interface Asset {
  id: number;
  siteId: number;
  name: string;
  type: AssetType;
  status: AssetStatus;
  posX: number;
  posY: number;
  posZ: number;
  installedAt: string;
}

export interface Reading {
  id: number;
  assetId: number;
  metric: Metric;
  value: number;
  unit: string;
  recordedAt: string;
}

export interface Alert {
  id: number;
  assetId: number;
  severity: AlertSeverity;
  message: string;
  state: AlertState;
  openedAt: string;
}

/** Latest value per metric, precomputed server-side for table + hotspot readouts. */
export interface LatestReading {
  metric: Metric;
  value: number;
  unit: string;
  recordedAt: string;
  /** Change against the value 24 h earlier; null when there is no comparison point. */
  delta24h: number | null;
}

export interface AssetRow extends Asset {
  siteName: string;
  siteTimezone: string;
  latest: LatestReading[];
  openAlerts: number;
  worstSeverity: AlertSeverity | null;
}

export interface AlertWithAsset extends Alert {
  assetName: string;
  assetType: AssetType;
  siteId: number;
  siteName: string;
}

export interface OverviewKpis {
  assetsTotal: number;
  assetsOk: number;
  assetsWarning: number;
  assetsCritical: number;
  openAlerts: number;
  ackAlerts: number;
  resolvedAlerts: number;
  /** Share of assets reporting `ok`, 0–100, rounded to one decimal. */
  healthScore: number;
  readingsLast24h: number;
  /** Mean of the newest value of each metric across the selected scope. */
  averages: { metric: Metric; value: number; unit: string }[];
}

export interface OverviewResponse {
  kpis: OverviewKpis;
  assets: AssetRow[];
  recentAlerts: AlertWithAsset[];
  /** One entry per site in scope, so the overview can show ambient conditions. */
  ambient: AmbientSummary[];
}

export interface AssetDetailResponse {
  asset: AssetRow;
  site: Site;
  /** Every asset on the same site — the 3D scene renders the full floor. */
  siblings: AssetRow[];
  alerts: Alert[];
  series: MetricSeries[];
}

export interface SeriesPoint {
  /** ISO-8601 timestamp of the bucket start. */
  t: string;
  v: number;
}

export interface MetricSeries {
  assetId: number;
  assetName: string;
  metric: Metric;
  unit: string;
  points: SeriesPoint[];
  min: number;
  max: number;
  avg: number;
}

export interface AnalyticsResponse {
  metric: Metric;
  unit: string;
  range: RangeKey;
  bucket: "hour" | "day";
  series: MetricSeries[];
}

export interface WeatherCurrent {
  temperature: number;
  humidity: number;
  windSpeed: number;
  precipitation: number;
  weatherCode: number;
  description: string;
  isDay: boolean;
  time: string;
}

export interface WeatherForecastPoint {
  t: string;
  temperature: number;
  humidity: number;
  precipitationProbability: number;
}

export interface AmbientSummary {
  siteId: number;
  siteName: string;
  timezone: string;
  current: WeatherCurrent;
  forecast: WeatherForecastPoint[];
  /** ISO timestamp of the upstream fetch this payload was served from. */
  fetchedAt: string;
  stale: boolean;
}

export interface ApiError {
  error: string;
  detail?: string;
}
