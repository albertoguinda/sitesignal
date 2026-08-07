import type { AssetType, Metric } from "@shared/types";

const LOCALE = "en-GB";

const numberFormatters = new Map<number, Intl.NumberFormat>();

function numberFormatter(digits: number): Intl.NumberFormat {
  let formatter = numberFormatters.get(digits);
  if (!formatter) {
    formatter = new Intl.NumberFormat(LOCALE, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    numberFormatters.set(digits, formatter);
  }
  return formatter;
}

/** Vibration needs two decimals to be readable; everything else needs one. */
export function metricDigits(metric: Metric): number {
  return metric === "vibration" ? 2 : 1;
}

export function formatNumber(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "—";
  return numberFormatter(digits).format(value);
}

export function formatMetric(value: number, metric: Metric): string {
  return formatNumber(value, metricDigits(metric));
}

export function formatDelta(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "±";
  return `${sign}${numberFormatter(digits).format(Math.abs(value))}`;
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat(LOCALE, { notation: "compact", maximumFractionDigits: 1 }).format(
    value,
  );
}

export function formatDateTime(iso: string, timeZone?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(LOCALE, {
    dateStyle: "medium",
    timeStyle: "short",
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}

export function formatTime(iso: string, timeZone?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}

/**
 * Open-Meteo returns wall-clock strings already expressed in the site's own
 * timezone ("2026-08-07T08:00") with no offset. Re-parsing those as Date would
 * reinterpret them as browser-local, so read the HH:MM straight off the string.
 */
export function formatWallClock(local: string): string {
  const time = local.split("T")[1];
  return time ? time.slice(0, 5) : "—";
}

export function formatDate(iso: string, timeZone?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(LOCALE, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["second", 1000],
  ["minute", 60_000],
  ["hour", 3_600_000],
  ["day", 86_400_000],
];

/** "12 min ago" — used wherever recency matters more than the wall-clock time. */
export function formatRelative(iso: string, now = Date.now()): string {
  const timestamp = new Date(iso).getTime();
  if (Number.isNaN(timestamp)) return "—";

  const diff = timestamp - now;
  const absolute = Math.abs(diff);
  const formatter = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });

  if (absolute >= 604_800_000) {
    return formatter.format(Math.round(diff / 604_800_000), "week");
  }

  let chosen: [Intl.RelativeTimeFormatUnit, number] = ["second", 1000];
  for (const entry of RELATIVE_UNITS) {
    if (absolute >= entry[1]) chosen = entry;
  }
  return formatter.format(Math.round(diff / chosen[1]), chosen[0]);
}

const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  pump: "Pump",
  compressor: "Compressor",
  chiller: "Chiller",
  turbine: "Turbine",
  transformer: "Transformer",
  conveyor: "Conveyor",
  boiler: "Boiler",
  hvac: "HVAC",
  tank: "Tank",
};

export function assetTypeLabel(type: AssetType): string {
  return ASSET_TYPE_LABELS[type] ?? type;
}

export function metricLabel(metric: Metric): string {
  return metric.charAt(0).toUpperCase() + metric.slice(1);
}

/** Splits "NG-V01 · Belt Conveyor" into its tag and human name. */
export function splitAssetName(name: string): { code: string; label: string } {
  const [code, label] = name.split(" · ");
  return { code: code ?? name, label: label ?? "" };
}
