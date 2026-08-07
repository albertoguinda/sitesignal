import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import type { LatestReading } from "@shared/types";
import { METRIC_TOKEN } from "@/theme/tokens";
import { formatDelta, formatMetric, metricDigits, metricLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Direction ink is neutral by design: "up" is not inherently bad on every metric. */
function DeltaIcon({ delta }: { delta: number | null }) {
  if (delta === null) return null;
  if (delta > 0) return <ArrowUpRight className="size-3" aria-hidden />;
  if (delta < 0) return <ArrowDownRight className="size-3" aria-hidden />;
  return <ArrowRight className="size-3" aria-hidden />;
}

export function MetricReadout({
  reading,
  variant = "inline",
  className,
}: {
  reading: LatestReading;
  variant?: "inline" | "block";
  className?: string;
}) {
  const hue = `var(${METRIC_TOKEN[reading.metric]})`;

  if (variant === "inline") {
    return (
      <span className={cn("inline-flex items-baseline gap-1", className)}>
        <span className="size-1.5 translate-y-[-1px] rounded-full" style={{ background: hue }} aria-hidden />
        <span className="tabular text-sm text-ink">{formatMetric(reading.value, reading.metric)}</span>
        <span className="text-2xs text-ink-muted">{reading.unit}</span>
      </span>
    );
  }

  return (
    <div className={cn("rounded-md border border-line bg-elevated px-3 py-2.5", className)}>
      <div className="flex items-center gap-1.5">
        <span className="size-2 rounded-full" style={{ background: hue }} aria-hidden />
        <span className="label-caps">{metricLabel(reading.metric)}</span>
      </div>
      <p className="mt-1.5 flex items-baseline gap-1">
        <span className="tabular text-xl font-semibold text-ink">
          {formatMetric(reading.value, reading.metric)}
        </span>
        <span className="text-xs text-ink-muted">{reading.unit}</span>
      </p>
      <p className="mt-1 flex items-center gap-1 text-2xs text-ink-muted">
        <DeltaIcon delta={reading.delta24h} />
        <span className="tabular">{formatDelta(reading.delta24h, metricDigits(reading.metric))}</span>
        <span>vs 24 h ago</span>
      </p>
    </div>
  );
}
