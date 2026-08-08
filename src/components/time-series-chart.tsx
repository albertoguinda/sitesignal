import { useMemo } from "react";
import {
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
import { formatMetric, metricDigits, splitAssetName } from "@/lib/format";
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
    <div className="min-w-44 rounded-md border border-line bg-overlay p-2.5 shadow-lg">
      <p className="label-caps mb-1.5">{tickFormatter(String(label), bucket)} UTC</p>
      <ul className="flex flex-col gap-1">
        {payload.map((entry) => (
          <li key={String(entry.dataKey)} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-xs text-ink-soft">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: entry.color }}
                aria-hidden
              />
              {entry.name}
            </span>
            <span className="tabular text-xs text-ink">
              {typeof entry.value === "number" ? formatMetric(entry.value, metric) : "—"}
              <span className="ml-0.5 text-ink-muted">{unit}</span>
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
  height?: number;
  colorBy?: "series" | "metric";
  showLegend?: boolean;
}) {
  const data = useMemo(() => mergeSeries(series, bucket), [series, bucket]);

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
    <figure className="m-0">
      {/* The unit lives above the axis rather than as a rotated axis label:
          rotated glyphs at 11 px are unreadable on a dark ground. */}
      <figcaption className="label-caps mb-1 pl-1">{unit}</figcaption>
      <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
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
          tickFormatter={(value: number) => value.toFixed(metricDigits(metric) === 2 ? 1 : 0)}
          domain={["auto", "auto"]}
        />
        <Tooltip
          cursor={{ stroke: axisColor, strokeDasharray: "3 3" }}
          content={<ChartTooltip metric={metric} unit={unit} bucket={bucket} />}
        />
        {showLegend && series.length > 1 ? (
          <Legend
            verticalAlign="top"
            align="left"
            height={28}
            iconType="plainline"
            iconSize={14}
            formatter={(value: string) => (
              <span className="text-xs text-ink-muted">{value}</span>
            )}
          />
        ) : null}
        {series.map((entry, index) => (
          <Line
            key={entry.assetId}
            type="monotone"
            dataKey={String(entry.assetId)}
            name={splitAssetName(entry.assetName).label || entry.assetName}
            stroke={palette[index]}
            strokeWidth={1.75}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
      </ResponsiveContainer>
    </figure>
  );
}
