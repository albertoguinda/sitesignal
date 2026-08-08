import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { AmbientSummary } from "@shared/types";
import { formatNumber, formatWallClock } from "@/lib/format";

/**
 * Compact temperature forecast bar chart for one site.
 * Each bar = 1 hour, height encodes temperature within the 12 h window.
 */
function ForecastBars({ ambient }: { ambient: AmbientSummary }) {
  const points = ambient.forecast.slice(0, 12);
  if (points.length === 0) return null;

  const temperatures = points.map((p) => p.temperature);
  const min = Math.min(...temperatures);
  const max = Math.max(...temperatures);
  const span = max - min || 1;

  return (
    <ul className="flex items-end gap-[3px]" role="img" aria-label={`Temperature forecast for ${ambient.siteName}`}>
      {points.map((point, i) => {
        const pct = ((point.temperature - min) / span) * 100;
        const height = 8 + pct * 0.52; // 8px min, 60px max
        return (
          <li key={point.t} className="flex flex-1 flex-col items-center gap-1">
            <span
              className="w-full rounded-t-sm bg-brand/50 transition-[height] motion-slow hover:bg-brand/80"
              style={{ height: `${height}px` }}
              title={`${formatNumber(point.temperature, 1)} °C at ${formatWallClock(point.t)}`}
            />
            {i % 3 === 0 ? (
              <span className="tabular text-[0.5625rem] text-ink-faint">
                {formatWallClock(point.t)}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** Trend arrow based on first vs last temperature in the forecast. */
function TrendIcon({ ambient }: { ambient: AmbientSummary }) {
  const pts = ambient.forecast.slice(0, 6);
  if (pts.length < 2) return <Minus className="size-3 text-ink-muted" aria-hidden />;
  const first = pts[0]!.temperature;
  const last = pts[pts.length - 1]!.temperature;
  const diff = last - first;
  if (Math.abs(diff) < 0.5) return <Minus className="size-3 text-ink-muted" aria-hidden />;
  return diff > 0 ? (
    <TrendingUp className="size-3 text-critical" aria-label="Rising" />
  ) : (
    <TrendingDown className="size-3 text-ok" aria-label="Falling" />
  );
}

/**
 * One forecast card per site — compact bar chart with peak, low, and trend.
 * Sits between ambient panels and the asset table.
 */
export function ForecastCards({ sites }: { sites: AmbientSummary[] }) {
  if (sites.length === 0) return null;

  return (
    <section aria-label="Site forecasts" className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {sites.map((ambient) => {
        const pts = ambient.forecast.slice(0, 12);
        const temps = pts.map((p) => p.temperature);
        const peak = temps.length > 0 ? Math.max(...temps) : null;
        const low = temps.length > 0 ? Math.min(...temps) : null;
        const rain = ambient.forecast.reduce(
          (max, p) => Math.max(max, p.precipitationProbability),
          0,
        );

        return (
          <article key={ambient.siteId} className="panel relative overflow-hidden px-4 py-3.5">
            <span className="absolute inset-x-0 top-0 h-px bg-brand/30" aria-hidden />

            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="label-caps">Forecast · {ambient.siteName}</p>
                <p className="mt-1 flex items-baseline gap-1.5">
                  <span className="tabular text-xl font-semibold text-ink">
                    {formatNumber(ambient.current.temperature, 1)}
                  </span>
                  <span className="text-xs text-ink-muted">°C now</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <TrendIcon ambient={ambient} />
                {rain > 20 && (
                  <span className="rounded-full bg-info-wash px-2 py-0.5 text-2xs font-medium text-info">
                    {rain}% rain
                  </span>
                )}
              </div>
            </div>

            {/* Bar chart */}
            <div className="mt-3">
              <ForecastBars ambient={ambient} />
            </div>

            {/* Stats row */}
            <div className="mt-2.5 flex items-center gap-4 text-2xs text-ink-muted">
              {peak !== null && (
                <span>
                  Peak <span className="tabular font-medium text-ink">{formatNumber(peak, 1)}°</span>
                </span>
              )}
              {low !== null && (
                <span>
                  Low <span className="tabular font-medium text-ink">{formatNumber(low, 1)}°</span>
                </span>
              )}
              <span className="ml-auto text-2xs text-ink-faint">
                {ambient.timezone}
              </span>
            </div>
          </article>
        );
      })}
    </section>
  );
}
