import { Link } from "react-router-dom";
import { ArrowUpRight, Radio } from "lucide-react";
import type { AssetRow } from "@shared/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { MetricReadout } from "@/components/metric-readout";
import { EmptyState } from "@/components/states";
import { assetTypeLabel, formatDate, formatRelative, splitAssetName } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The panel a hotspot opens: everything the selected machine is currently
 * reporting, plus the way through to its own page.
 */
export function SensorReadout({
  asset,
  isCurrent,
  className,
}: {
  asset: AssetRow | null;
  isCurrent: boolean;
  className?: string;
}) {
  if (!asset) {
    return (
      <EmptyState
        icon={<Radio className="size-4" aria-hidden />}
        title="No asset selected"
        description="Click a pulsing hotspot in the floor plan to raise its sensor readout."
        className={className}
      />
    );
  }

  const { code, label } = splitAssetName(asset.name);
  const lastSample = asset.latest[0]?.recordedAt;

  return (
    <div className={cn("flex flex-col gap-3.5 px-4 py-3.5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="tabular text-2xs text-ink-muted">{code}</p>
          <p className="truncate text-md font-semibold text-ink">{label}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <StatusBadge status={asset.status} />
            <Badge tone="neutral">{assetTypeLabel(asset.type)}</Badge>
            {asset.openAlerts > 0 ? (
              <Badge tone={asset.worstSeverity === "critical" ? "critical" : "warning"}>
                {asset.openAlerts} open
              </Badge>
            ) : null}
          </div>
        </div>
        {isCurrent ? (
          <Badge tone="brand">viewing</Badge>
        ) : (
          <Button asChild variant="ghost" size="sm">
            <Link to={`/assets/${asset.id}`}>
              Open
              <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          </Button>
        )}
      </div>

      {asset.latest.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {asset.latest.map((reading) => (
            <MetricReadout key={reading.metric} reading={reading} variant="block" />
          ))}
        </div>
      ) : (
        <p className="text-xs text-ink-muted">This asset has no telemetry yet.</p>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-line-faint pt-3 text-xs">
        <dt className="text-ink-muted">Site</dt>
        <dd className="text-right text-ink-soft">{asset.siteName}</dd>
        <dt className="text-ink-muted">Position</dt>
        <dd className="tabular text-right text-ink-soft">
          {asset.posX}, {asset.posY}, {asset.posZ}
        </dd>
        <dt className="text-ink-muted">Installed</dt>
        <dd className="text-right text-ink-soft">{formatDate(asset.installedAt)}</dd>
        <dt className="text-ink-muted">Last sample</dt>
        <dd className="text-right text-ink-soft">
          {lastSample ? formatRelative(lastSample) : "—"}
        </dd>
      </dl>
    </div>
  );
}
