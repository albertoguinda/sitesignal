import { useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { METRICS, type AssetRow, type Metric } from "@shared/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/states";
import { METRIC_TOKEN } from "@/theme/tokens";
import { assetTypeLabel, formatMetric, metricLabel, splitAssetName } from "@/lib/format";
import { cn } from "@/lib/utils";

type SortKey = "name" | "site" | "type" | "status" | "alerts" | Metric;
type SortDirection = "asc" | "desc";

const STATUS_ORDER: Record<AssetRow["status"], number> = { critical: 0, warning: 1, ok: 2 };

function readingFor(asset: AssetRow, metric: Metric): number | null {
  return asset.latest.find((entry) => entry.metric === metric)?.value ?? null;
}

/** Assets missing a metric always sort last, whichever direction is active. */
function compare(a: AssetRow, b: AssetRow, key: SortKey): number {
  switch (key) {
    case "name":
      return a.name.localeCompare(b.name);
    case "site":
      return a.siteName.localeCompare(b.siteName) || a.name.localeCompare(b.name);
    case "type":
      return a.type.localeCompare(b.type) || a.name.localeCompare(b.name);
    case "status":
      return STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name);
    case "alerts":
      return b.openAlerts - a.openAlerts || a.name.localeCompare(b.name);
    default: {
      const left = readingFor(a, key);
      const right = readingFor(b, key);
      if (left === null && right === null) return a.name.localeCompare(b.name);
      if (left === null) return 1;
      if (right === null) return -1;
      return left - right;
    }
  }
}

function SortButton({
  label,
  active,
  direction,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
  align?: "left" | "right";
}) {
  const Icon = !active ? ChevronsUpDown : direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group inline-flex w-full items-center gap-1 rounded-sm py-1 transition-colors motion-fast",
        "hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
        active ? "text-ink" : "text-ink-muted",
        align === "right" && "justify-end",
      )}
      aria-label={`Sort by ${label}`}
    >
      <span>{label}</span>
      <Icon
        className={cn("size-3 shrink-0 transition-opacity", active ? "opacity-100" : "opacity-40")}
        aria-hidden
      />
    </button>
  );
}

export function AssetTable({
  assets,
  showSite = true,
  selectedId,
}: {
  assets: AssetRow[];
  showSite?: boolean;
  selectedId?: number;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [direction, setDirection] = useState<SortDirection>("asc");

  const sorted = useMemo(() => {
    const copy = [...assets];
    copy.sort((a, b) => (direction === "asc" ? compare(a, b, sortKey) : -compare(a, b, sortKey)));
    return copy;
  }, [assets, sortKey, direction]);

  const toggle = (key: SortKey) => {
    if (key === sortKey) {
      setDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setDirection("asc");
  };

  if (assets.length === 0) {
    return <EmptyState title="No assets in scope" description="Pick another site to continue." />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="min-w-44">
            <SortButton
              label="Asset"
              active={sortKey === "name"}
              direction={direction}
              onClick={() => toggle("name")}
            />
          </TableHead>
          {showSite ? (
            <TableHead className="hidden min-w-28 lg:table-cell">
              <SortButton
                label="Site"
                active={sortKey === "site"}
                direction={direction}
                onClick={() => toggle("site")}
              />
            </TableHead>
          ) : null}
          <TableHead className="hidden min-w-24 md:table-cell">
            <SortButton
              label="Type"
              active={sortKey === "type"}
              direction={direction}
              onClick={() => toggle("type")}
            />
          </TableHead>
          <TableHead className="min-w-24">
            <SortButton
              label="Status"
              active={sortKey === "status"}
              direction={direction}
              onClick={() => toggle("status")}
            />
          </TableHead>
          {METRICS.map((metric) => (
            <TableHead key={metric} className="min-w-20 text-right">
              <SortButton
                label={metricLabel(metric)}
                active={sortKey === metric}
                direction={direction}
                onClick={() => toggle(metric)}
                align="right"
              />
            </TableHead>
          ))}
          <TableHead className="min-w-16 text-right">
            <SortButton
              label="Alerts"
              active={sortKey === "alerts"}
              direction={direction}
              onClick={() => toggle("alerts")}
              align="right"
            />
          </TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {sorted.map((asset) => {
          const { code, label } = splitAssetName(asset.name);
          return (
            <TableRow key={asset.id} data-selected={asset.id === selectedId}>
              <TableCell className="py-1.5">
                <Link
                  to={`/assets/${asset.id}`}
                  className="group flex flex-col gap-0.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  <span className="tabular text-2xs text-ink-muted">{code}</span>
                  <span className="text-sm font-medium text-ink group-hover:text-brand">
                    {label}
                  </span>
                </Link>
              </TableCell>

              {showSite ? (
                <TableCell className="hidden text-xs text-ink-muted lg:table-cell">
                  {asset.siteName}
                </TableCell>
              ) : null}

              <TableCell className="hidden md:table-cell">
                <Badge tone="neutral">{assetTypeLabel(asset.type)}</Badge>
              </TableCell>

              <TableCell>
                <StatusBadge status={asset.status} />
              </TableCell>

              {METRICS.map((metric) => {
                const value = readingFor(asset, metric);
                return (
                  <TableCell key={metric} className="text-right" data-numeric>
                    {value === null ? (
                      <span className="text-ink-faint">—</span>
                    ) : (
                      <span className="inline-flex items-baseline justify-end gap-1">
                        <span
                          className="size-1.5 translate-y-[-1px] rounded-full"
                          style={{ background: `var(${METRIC_TOKEN[metric]})` }}
                          aria-hidden
                        />
                        <span className="text-ink">{formatMetric(value, metric)}</span>
                      </span>
                    )}
                  </TableCell>
                );
              })}

              <TableCell className="text-right" data-numeric>
                {asset.openAlerts > 0 ? (
                  <Badge tone={asset.worstSeverity === "critical" ? "critical" : "warning"}>
                    {asset.openAlerts} open
                  </Badge>
                ) : (
                  <span className="text-ink-faint">—</span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
