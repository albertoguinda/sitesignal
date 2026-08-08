import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type KpiTone = "brand" | "ok" | "warning" | "critical" | "neutral";

const ACCENT: Record<KpiTone, string> = {
  brand: "bg-brand",
  ok: "bg-ok",
  warning: "bg-warning",
  critical: "bg-critical",
  neutral: "bg-line-strong",
};

const VALUE_INK: Record<KpiTone, string> = {
  brand: "text-ink",
  ok: "text-ok",
  warning: "text-warning",
  critical: "text-critical",
  neutral: "text-ink",
};

export interface KpiSegment {
  label: string;
  value: number;
  tone: Exclude<KpiTone, "neutral">;
}

/**
 * A single headline figure with an optional composition bar underneath.
 * The bar is what turns "18 assets" into "12 nominal / 4 warning / 2 critical"
 * without spending another card on it.
 */
export function KpiCard({
  label,
  value,
  unit,
  hint,
  tone = "neutral",
  icon,
  segments,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: ReactNode;
  tone?: KpiTone;
  icon?: ReactNode;
  segments?: KpiSegment[];
}) {
  const total = segments?.reduce((sum, segment) => sum + segment.value, 0) ?? 0;

  return (
    <article className="panel relative overflow-hidden px-4 py-3.5">
      <span
        className={cn("absolute inset-x-0 top-0 h-px", ACCENT[tone])}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-3">
        <p className="label-caps">{label}</p>
        {icon ? <span className="text-ink-faint">{icon}</span> : null}
      </div>

      <p className="mt-2 flex items-baseline gap-1.5">
        <span className={cn("tabular text-3xl font-semibold leading-none", VALUE_INK[tone])}>
          {value}
        </span>
        {unit ? <span className="text-sm text-ink-muted">{unit}</span> : null}
      </p>

      {segments && total > 0 ? (
        <div className="mt-3">
          <div
            className="flex h-2 w-full overflow-hidden rounded-full bg-sunken"
            role="img"
            aria-label={segments.map((s) => `${s.value} ${s.label}`).join(", ")}
          >
            {segments
              .filter((segment) => segment.value > 0)
              .map((segment) => (
                <span
                  key={segment.label}
                  className={cn("block shrink-0", ACCENT[segment.tone])}
                  style={{ width: `${(segment.value / total) * 100}%` }}
                />
              ))}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {segments.map((segment) => (
              <li key={segment.label} className="flex items-center gap-1.5 text-2xs text-ink-muted">
                <span className={cn("size-1.5 rounded-full", ACCENT[segment.tone])} aria-hidden />
                <span className="tabular text-ink-soft">{segment.value}</span>
                {segment.label}
              </li>
            ))}
          </ul>
        </div>
      ) : hint ? (
        <p className="mt-2.5 text-xs text-ink-muted">{hint}</p>
      ) : null}
    </article>
  );
}
