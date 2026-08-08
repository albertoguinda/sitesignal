import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type { Metric, MetricSeries } from "@shared/types";
import { chartColor, metricColor, readToken } from "@/theme/tokens";
import { formatMetric, splitAssetName } from "@/lib/format";
import { EmptyState } from "@/components/states";

type Bucket = "hour" | "day";

interface MergedPoint {
  t: string;
  [assetId: string]: string | number | null;
}

/**
 * Recharts wants one row per x-value, so the per-asset series are pivoted into
 * a single table keyed by bucket timestamp. Missing buckets are generated and
 * filled with `null` so the x-axis is continuous — gaps in the data render as
 * breaks in the line rather than missing x-values.
 */
function mergeSeries(series: MetricSeries[], bucket: Bucket): MergedPoint[] {
  if (series.length === 0) return [];

  const byTime = new Map<string, MergedPoint>();
  const assetKeys: string[] = [];

  for (const entry of series) {
    const key = String(entry.assetId);
    if (!assetKeys.includes(key)) assetKeys.push(key);
    for (const point of entry.points) {
      let row = byTime.get(point.t);
      if (!row) {
        row = { t: point.t };
        byTime.set(point.t, row);
      }
      row[key] = point.v;
    }
  }

  // Collect every timestamp that appears in any series.
  const existingTimes = [...byTime.keys()].sort();
  if (existingTimes.length === 0) return [];

  // Generate the complete time range so the x-axis has no holes.
  const stepMs = bucket === "hour" ? 3_600_000 : 86_400_000;
  const first = existingTimes[0]!;
  const last = existingTimes[existingTimes.length - 1]!;
  const startMs = new Date(first).getTime();
  const endMs = new Date(last).getTime();

  const fullRange: MergedPoint[] = [];
  for (let t = startMs; t <= endMs; t += stepMs) {
    const iso = new Date(t).toISOString().slice(0, 19) + "Z";
    const existing = byTime.get(iso);
    if (existing) {
      fullRange.push(existing);
    } else {
      // Bucket with no data for any asset — fill every key with null.
      const row: MergedPoint = { t: iso };
      for (const key of assetKeys) row[key] = null;
      fullRange.push(row);
    }
  }

  return fullRange;
}

function tickFormatter(value: string, bucket: Bucket): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    ...(bucket === "hour"
      ? { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }
      : { day: "2-digit", month: "short" }),
  }).format(date);
}

/**
 * Recharts injects `active`/`payload`/`label` into whatever element is passed to
 * `Tooltip content`, so those props are optional here and only the extras we
 * pass explicitly are required.
 */
type ChartTooltipProps = Partial<TooltipContentProps<number, string>> & {
  metric: Metric;
  unit: string;
  bucket: Bucket;
};

function ChartTooltip({ active, payload, label, metric, unit, bucket }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="min-w-48 rounded-lg border border-line bg-overlay/95 p-3 shadow-xl backdrop-blur-sm">
      <p className="label-caps mb-2 border-b border-line-faint pb-1.5">
        {tickFormatter(String(label), bucket)} UTC
      </p>
      <ul className="flex flex-col gap-1.5">
        {payload.map((entry) => (
          <li key={String(entry.dataKey)} className="flex items-center justify-between gap-5">
            <span className="flex min-w-0 items-center gap-2 text-xs text-ink-soft">
              <span
                className="size-2 shrink-0 rounded-full ring-2 ring-transparent"
                style={{ background: entry.color, boxShadow: `0 0 0 3px ${entry.color}22` }}
                aria-hidden
              />
              <span className="truncate">{entry.name}</span>
            </span>
            <span className="tabular text-xs font-semibold text-ink">
              {typeof entry.value === "number" ? formatMetric(entry.value, metric) : "—"}
              <span className="ml-1 font-normal text-ink-muted">{unit}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TimeSeriesChart({
  series,
  metric,
  unit,
  bucket,
  height = 300,
  /** Single-series charts use the metric hue; comparisons use the series palette. */
  colorBy = "series",
  showLegend = true,
}: {
  series: MetricSeries[];
  metric: Metric;
  unit: string;
  bucket: Bucket;
  /** Fixed px height, or "100%" to fill a flex parent. */
  height?: number | "100%";
  colorBy?: "series" | "metric";
  showLegend?: boolean;
}) {
  const data = useMemo(() => mergeSeries(series, bucket), [series, bucket]);

  // Y domain padded from the actual data span: flat series (all values equal)
  // still get a readable axis, and tight spans don't collapse into one tick.
  const yDomain = useMemo(() => {
    if (data.length === 0) return null;
    let lo = Number.POSITIVE_INFINITY;
    let hi = Number.NEGATIVE_INFINITY;
    for (const row of data) {
      for (const value of Object.values(row)) {
        if (typeof value !== "number") continue;
        if (value < lo) lo = value;
        if (value > hi) hi = value;
      }
    }
    if (!Number.isFinite(lo)) return null;
    const pad = Math.max((hi - lo) * 0.1, 1);
    return { lo: lo - pad, hi: hi + pad, span: hi - lo };
  }, [data]);

  const palette = useMemo(
    () =>
      series.map((entry, index) =>
        colorBy === "metric" ? metricColor(entry.metric) : chartColor(index),
      ),
    [series, colorBy],
  );

  const gridColor = readToken("--sig-chart-grid");
  const axisColor = readToken("--sig-chart-axis");

  if (series.length === 0 || data.length === 0) {
    return (
      <EmptyState
        title="No samples in this window"
        description="Widen the range or pick a different metric."
      />
    );
  }

  return (
    <figure
      className={height === "100%" ? "m-0 flex h-full flex-col" : "m-0"}
      aria-label={`${metric} trend for the selected assets`}
    >
      {/* The unit lives above the axis rather than as a rotated axis label:
          rotated glyphs at 11 px are unreadable on a dark ground. */}
      <figcaption className="label-caps mb-1 pl-1">{unit}</figcaption>
      <div className={height === "100%" ? "min-h-0 flex-1" : undefined}>
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -4 }}>
            <defs>
              {series.map((entry, index) => (
                <linearGradient
                  key={entry.assetId}
                  id={`series-fill-${entry.assetId}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={palette[index]} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={palette[index]} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid stroke={gridColor} strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="t"
              tickFormatter={(value: string) => tickFormatter(value, bucket)}
              stroke={axisColor}
              tick={{ fill: axisColor, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: gridColor }}
              minTickGap={48}
            />
            <YAxis
              stroke={axisColor}
              tick={{ fill: axisColor, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={52}
              tickFormatter={(value: number) =>
                Math.abs(value) >= 1000
                  ? `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`
                  : value.toFixed(yDomain && yDomain.span < 10 ? 1 : 0)
              }
              domain={yDomain ? [yDomain.lo, yDomain.hi] : ["auto", "auto"]}
            />
            <Tooltip
              cursor={{ stroke: axisColor, strokeDasharray: "3 3", strokeOpacity: 0.6 }}
              content={<ChartTooltip metric={metric} unit={unit} bucket={bucket} />}
            />
            {showLegend && series.length > 1 ? (
              <Legend
                verticalAlign="top"
                align="left"
                height={32}
                iconType="plainline"
                iconSize={16}
                wrapperStyle={{ paddingBottom: 8, fontSize: 12 }}
                formatter={(value: string) => (
                  <span className="text-xs text-ink-muted">{value}</span>
                )}
              />
            ) : null}
            {series.map((entry) => (
              <Area
                key={`fill-${entry.assetId}`}
                type="monotone"
                dataKey={String(entry.assetId)}
                stroke="none"
                fill={`url(#series-fill-${entry.assetId})`}
                dot={false}
                isAnimationActive={false}
              />
            ))}
            {series.map((entry, index) => (
              <Line
                key={entry.assetId}
                type="monotone"
                dataKey={String(entry.assetId)}
                name={splitAssetName(entry.assetName).label || entry.assetName}
                stroke={palette[index]}
                strokeWidth={1.75}
                dot={false}
                activeDot={{ r: 3.5, strokeWidth: 2, stroke: "var(--sig-surface-overlay)" }}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
