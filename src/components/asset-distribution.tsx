import { useMemo } from "react";
import { Cog } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AssetRow } from "@shared/types";

/** Human-readable labels for asset types. */
const TYPE_LABELS: Record<string, string> = {
  boiler: "Boilers",
  compressor: "Compressors",
  conveyor: "Conveyors",
  chiller: "Chillers",
  hvac: "HVAC",
  pump: "Pumps",
  tank: "Tanks",
  transformer: "Transformers",
  turbine: "Turbines",
};

const TYPE_COLORS: Record<string, string> = {
  boiler: "bg-amber-400",
  compressor: "bg-violet-400",
  conveyor: "bg-pink-400",
  chiller: "bg-sky-400",
  hvac: "bg-cyan-400",
  pump: "bg-green-400",
  tank: "bg-blue-400",
  transformer: "bg-orange-400",
  turbine: "bg-red-400",
};

interface TypeGroup {
  type: string;
  label: string;
  total: number;
  ok: number;
  warning: number;
  critical: number;
}

/**
 * Visual breakdown of asset fleet by type with per-type health dots.
 * Sits between the KPI row and ambient panels.
 */
export function AssetDistribution({ assets }: { assets: AssetRow[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, TypeGroup>();
    for (const asset of assets) {
      let g = map.get(asset.type);
      if (!g) {
        g = {
          type: asset.type,
          label: TYPE_LABELS[asset.type] ?? asset.type,
          total: 0,
          ok: 0,
          warning: 0,
          critical: 0,
        };
        map.set(asset.type, g);
      }
      g.total++;
      if (asset.status === "ok") g.ok++;
      else if (asset.status === "warning") g.warning++;
      else g.critical++;
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [assets]);

  const total = assets.length;
  if (total === 0) return null;

  return (
    <article className="panel relative flex h-full flex-col overflow-hidden px-4 py-3.5">
      <span className="absolute inset-x-0 top-0 h-px bg-brand/40" aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <p className="label-caps">Fleet by type</p>
        <Cog className="size-4 text-ink-faint" aria-hidden />
      </div>

      {/* Stacked bar + legend anchored to the bottom of the card */}
      <div className="mt-auto">
        <div
          className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-sunken"
          role="img"
          aria-label={groups.map((g) => `${g.total} ${g.label}`).join(", ")}
        >
          {groups.map((g) => (
            <span
              key={g.type}
              className={cn("block shrink-0", TYPE_COLORS[g.type] ?? "bg-line-strong")}
              style={{ width: `${(g.total / total) * 100}%` }}
              title={`${g.label}: ${g.total}`}
            />
          ))}
        </div>

        {/* Legend */}
        <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
          {groups.map((g) => (
            <li key={g.type} className="flex items-center gap-2 text-xs">
              <span
                className={cn("size-2.5 shrink-0 rounded-sm", TYPE_COLORS[g.type] ?? "bg-line-strong")}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-ink-soft">{g.label}</span>
              <span className="tabular font-medium text-ink">{g.total}</span>
              {/* Health dots */}
              <span className="flex shrink-0 items-center gap-0.5" aria-label={`${g.ok} ok, ${g.warning} warning, ${g.critical} critical`}>
                {g.ok > 0 && <span className="size-1.5 rounded-full bg-ok" />}
                {g.warning > 0 && <span className="size-1.5 rounded-full bg-warning" />}
                {g.critical > 0 && <span className="size-1.5 rounded-full bg-critical" />}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
