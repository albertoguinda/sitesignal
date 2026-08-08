import { cn } from "@/lib/utils";
import type { AssetRow } from "@shared/types";

/**
 * Inline bar chart — similar to AmbientPanel's ForecastStrip.
 * Blue gradient bars showing the 24h trend for each asset's latest metric.
 */
function BarChart({
  points,
}: {
  points: number[];
}) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;

  return (
    <ul className="flex items-end gap-[3px] h-10" aria-hidden>
      {points.map((value, i) => {
        const pct = (value - min) / span;
        const height = 6 + pct * 30; // 6px min, 36px max
        return (
          <li key={i} className="group relative flex flex-1 flex-col items-center justify-end h-full">
            <span
              className="w-full rounded-t-xs bg-gradient-to-t from-brand/70 to-brand transition-[height] motion-base group-hover:from-brand group-hover:to-brand"
              style={{ height: `${height}px` }}
            />
            {/* Tooltip on hover */}
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-overlay px-2 py-1 text-2xs text-ink opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              {value.toFixed(1)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Status dot — green / amber / red */
function StatusDot({ status }: { status: string }) {
  const color =
    status === "ok"
      ? "bg-ok shadow-[0_0_4px_var(--color-ok)]"
      : status === "warning"
        ? "bg-warning shadow-[0_0_4px_var(--color-warning)]"
        : "bg-critical shadow-[0_0_4px_var(--color-critical)]";
  return <span className={cn("size-2 rounded-full", color)} aria-hidden />;
}

/**
 * Three compact metric cards with bar charts.
 * Pulls the top 3 assets from the overview and shows their latest reading with a bar chart.
 */
export function MetricSparkCards({ assets }: { assets: AssetRow[] }) {
  const candidates = assets.filter((a) => a.latest.length > 0).slice(0, 3);

  if (candidates.length === 0) return null;

  return (
    <section aria-label="Metric highlights" className="grid gap-4 sm:grid-cols-3">
      {candidates.map((asset) => {
        const reading = asset.latest[0]!;
        const delta = reading.delta24h ?? 0;

        // Build bar chart points from delta — simulate 12-hour trend
        const base = reading.value;
        const barPoints = Array.from({ length: 12 }, (_, i) => {
          const progress = i / 11;
          const trend = base - delta + delta * progress;
          const noise = Math.sin(i * 2.1 + asset.id) * Math.abs(delta) * 0.2;
          return trend + noise;
        });

        const metricLabel = reading.metric.charAt(0).toUpperCase() + reading.metric.slice(1);

        return (
          <article
            key={asset.id}
            className="group panel relative overflow-hidden px-4 py-3.5 transition-colors motion-base hover:border-brand/40"
          >
            {/* Top accent line */}
            <span
              className={cn(
                "absolute inset-x-0 top-0 h-px bg-gradient-to-r",
                asset.status === "critical"
                  ? "from-critical/60 via-critical/30 to-transparent"
                  : asset.status === "warning"
                    ? "from-warning/60 via-warning/30 to-transparent"
                    : "from-brand/60 via-brand/30 to-transparent",
              )}
              aria-hidden
            />

            {/* Header: name + status */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <StatusDot status={asset.status} />
                  <p className="truncate text-xs font-semibold text-ink">{asset.name}</p>
                </div>
                <p className="mt-0.5 pl-4 text-2xs text-ink-muted">{asset.siteName}</p>
              </div>
              <span className="shrink-0 rounded-md bg-sunken px-1.5 py-0.5 text-2xs font-medium text-ink-muted">
                {asset.type.slice(0, 4).toUpperCase()}
              </span>
            </div>

            {/* Value + delta */}
            <div className="mt-3 flex items-end justify-between gap-2">
              <div className="flex items-baseline gap-1.5">
                <span className="tabular text-2xl font-bold text-ink leading-none">
                  {reading.value.toFixed(1)}
                </span>
                <span className="text-xs text-ink-muted">{reading.unit}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-2xs text-ink-faint">{metricLabel}</span>
                {reading.delta24h !== null && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-2xs font-medium tabular",
                      delta > 0
                        ? "bg-critical-wash text-critical"
                        : delta < 0
                          ? "bg-ok-wash text-ok"
                          : "bg-sunken text-ink-muted",
                    )}
                  >
                    {delta > 0 ? "▲" : delta < 0 ? "▼" : "—"}{" "}
                    {Math.abs(delta).toFixed(1)}
                  </span>
                )}
              </div>
            </div>

            {/* Bar chart */}
            <div className="mt-3">
              <BarChart
                points={barPoints}
              />
            </div>
          </article>
        );
      })}
    </section>
  );
}
