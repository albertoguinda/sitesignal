import { CloudSun, Droplets, Thermometer, Wind } from "lucide-react";
import type { AmbientSummary } from "@shared/types";
import { Badge } from "@/components/ui/badge";
import { formatNumber, formatRelative, formatWallClock } from "@/lib/format";
import { cn } from "@/lib/utils";

function Stat({
  icon,
  label,
  value,
  unit,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid size-7 shrink-0 place-items-center rounded-md border border-line bg-elevated text-ink-muted">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="label-caps">{label}</p>
        <p className="tabular text-sm text-ink">
          {value}
          <span className="ml-0.5 text-2xs text-ink-muted">{unit}</span>
        </p>
      </div>
    </div>
  );
}

/**
 * Ambient conditions for one site, rendered beside the asset readings so a
 * temperature excursion can be read against the weather that may explain it.
 */
export function AmbientPanel({
  ambient,
  className,
  compact = false,
}: {
  ambient: AmbientSummary;
  className?: string;
  compact?: boolean;
}) {
  const { current, forecast, timezone } = ambient;
  const peak = forecast.reduce(
    (max, point) => (point.temperature > max ? point.temperature : max),
    Number.NEGATIVE_INFINITY,
  );
  const rainChance = forecast.reduce(
    (max, point) => (point.precipitationProbability > max ? point.precipitationProbability : max),
    0,
  );

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="label-caps">Ambient · {ambient.siteName}</p>
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className="tabular text-2xl font-semibold text-ink">
              {formatNumber(current.temperature, 1)}
            </span>
            <span className="text-sm text-ink-muted">°C</span>
          </p>
          <p className="text-xs text-ink-muted">{current.description}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="grid size-9 place-items-center rounded-md border border-line bg-elevated text-brand">
            <CloudSun className="size-4.5" aria-hidden />
          </span>
          {ambient.stale ? <Badge tone="warning">stale</Badge> : null}
        </div>
      </div>

      <div className={cn("grid gap-3", compact ? "grid-cols-2" : "grid-cols-2 xl:grid-cols-3")}>
        <Stat
          icon={<Droplets className="size-3.5" aria-hidden />}
          label="Humidity"
          value={formatNumber(current.humidity, 0)}
          unit="%"
        />
        <Stat
          icon={<Wind className="size-3.5" aria-hidden />}
          label="Wind"
          value={formatNumber(current.windSpeed, 1)}
          unit="km/h"
        />
        <Stat
          icon={<Thermometer className="size-3.5" aria-hidden />}
          label="24 h peak"
          value={Number.isFinite(peak) ? formatNumber(peak, 1) : "—"}
          unit="°C"
        />
      </div>

      {forecast.length > 0 ? (
        <div>
          <div className="flex items-center justify-between">
            <p className="label-caps">Next 12 h</p>
            <p className="text-2xs text-ink-faint">max rain {formatNumber(rainChance, 0)} %</p>
          </div>
          <ForecastStrip ambient={ambient} />
        </div>
      ) : null}

      <p className="text-2xs text-ink-faint">
        Open-Meteo · {timezone} · updated {formatRelative(ambient.fetchedAt)}
      </p>
    </div>
  );
}

/** Twelve-hour temperature ridge; height encodes temperature within the window. */
function ForecastStrip({ ambient }: { ambient: AmbientSummary }) {
  const points = ambient.forecast.slice(0, 12);
  if (points.length === 0) return null;

  const temperatures = points.map((point) => point.temperature);
  const min = Math.min(...temperatures);
  const max = Math.max(...temperatures);
  const span = max - min || 1;

  return (
    <ul className="mt-2 flex items-end gap-1">
      {points.map((point, index) => {
        const height = 18 + ((point.temperature - min) / span) * 26;
        return (
          <li key={point.t} className="flex flex-1 flex-col items-center gap-1">
            <span
              className="w-full rounded-t-xs bg-brand/45 transition-[height] motion-slow"
              style={{ height: `${height}px` }}
              title={`${formatNumber(point.temperature, 1)} °C`}
              aria-hidden
            />
            {index % 3 === 0 ? (
              <span className="tabular text-[0.5625rem] text-ink-faint">
                {formatWallClock(point.t)}
              </span>
            ) : (
              <span className="h-3" aria-hidden />
            )}
          </li>
        );
      })}
    </ul>
  );
}
