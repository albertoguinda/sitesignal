import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { METRICS, RANGES, type Metric, type RangeKey } from "@shared/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageHeader } from "@/components/page-header";
import { SiteSelector } from "@/components/site-selector";
import { TimeSeriesChart } from "@/components/time-series-chart";
import { EmptyState, ErrorState } from "@/components/states";
import { StatusDot } from "@/components/status-badge";
import { chartColor } from "@/theme/tokens";
import { useAnalytics, useAssets, useSites } from "@/lib/api";
import { metricLabel, splitAssetName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCurrentOrganization } from "@/lib/organization-context";

/** The API caps a comparison at six series; the picker enforces the same limit. */
const MAX_SERIES = 6;

const RANGE_LABEL: Record<RangeKey, string> = {
  "24h": "24 h",
  "7d": "7 d",
  "30d": "30 d",
  "60d": "60 d",
};

export default function AnalyticsPage() {
  const [siteId, setSiteId] = useState<number | undefined>(undefined);
  const [metric, setMetric] = useState<Metric>("temperature");
  const [range, setRange] = useState<RangeKey>("7d");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const { currentOrgId } = useCurrentOrganization();

  const sites = useSites(currentOrgId);
  const assets = useAssets(siteId, currentOrgId);

  /** Only assets that actually report the chosen metric can be compared on it. */
  const candidates = useMemo(
    () => (assets.data ?? []).filter((asset) => asset.latest?.some((r) => r.metric === metric)),
    [assets.data, metric],
  );

  // Keep the selection valid whenever the scope or metric narrows the candidates.
  useEffect(() => {
    setSelectedIds((current) => {
      const allowed = new Set(candidates.map((asset) => asset.id));
      const kept = current.filter((id) => allowed.has(id));
      if (kept.length > 0) return kept.length === current.length ? current : kept;
      return candidates.slice(0, 3).map((asset) => asset.id);
    });
  }, [candidates]);

  const analytics = useAnalytics(selectedIds, metric, range);

  const toggleAsset = (id: number) => {
    setSelectedIds((current) => {
      if (current.includes(id)) {
        return current.length === 1 ? current : current.filter((entry) => entry !== id);
      }
      if (current.length >= MAX_SERIES) return current;
      return [...current, id];
    });
  };

  return (
    <>
      <PageHeader
        eyebrow="Telemetry"
        title="Analytics"
        description="Compare the same metric across up to six assets over any window from a day to two months."
        actions={<SiteSelector sites={sites.data ?? []} value={siteId} onChange={setSiteId} />}
      />

      <section className="grid gap-3 xl:grid-cols-4">
        <Card className="xl:col-span-1">
          <CardHeader>
            <div>
              <CardTitle>Compare</CardTitle>
              <CardDescription>
                {selectedIds.length} of {MAX_SERIES} series · {candidates.length} assets report{" "}
                {metricLabel(metric).toLowerCase()}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div>
              <label
                className="label-caps mb-1.5 block"
                htmlFor="analytics-metric"
              >
                Metric
              </label>
              <Select value={metric} onValueChange={(next) => setMetric(next as Metric)}>
                <SelectTrigger id="analytics-metric">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METRICS.map((entry) => (
                    <SelectItem key={entry} value={entry}>
                      {metricLabel(entry)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="label-caps mb-1.5">Range</p>
              <ToggleGroup
                type="single"
                value={range}
                onValueChange={(next) => next && setRange(next as RangeKey)}
                aria-label="Time range"
                className="w-full justify-between"
              >
                {RANGES.map((key) => (
                  <ToggleGroupItem key={key} value={key} className="flex-1">
                    {RANGE_LABEL[key]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <div className="min-h-0">
              <p className="label-caps mb-1.5">Assets</p>
              {assets.isPending ? (
                <div className="flex flex-col gap-1.5">
                  {Array.from({ length: 6 }, (_, index) => (
                    <Skeleton key={index} className="h-8 w-full" />
                  ))}
                </div>
              ) : candidates.length === 0 ? (
                <EmptyState
                  title="No assets report this metric"
                  description="Pick another metric or widen the site scope."
                />
              ) : (
                <ScrollArea className="max-h-96 rounded-md border border-line">
                  <ul className="divide-y divide-line-faint">
                    {candidates.map((asset) => {
                      const index = selectedIds.indexOf(asset.id);
                      const active = index !== -1;
                      const atLimit = !active && selectedIds.length >= MAX_SERIES;
                      const { code, label } = splitAssetName(asset.name);
                      return (
                        <li key={asset.id}>
                          <button
                            type="button"
                            onClick={() => toggleAsset(asset.id)}
                            disabled={atLimit}
                            aria-pressed={active}
                            className={cn(
                              "flex w-full items-center gap-2 px-2.5 py-2 text-left transition-colors motion-fast",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                              active ? "bg-brand-wash" : "hover:bg-elevated",
                              atLimit && "cursor-not-allowed opacity-45",
                            )}
                          >
                            <span
                              className="grid size-4 shrink-0 place-items-center rounded-xs border"
                              style={{
                                borderColor: active ? chartColor(index) : "var(--sig-line-strong)",
                                background: active ? chartColor(index) : "transparent",
                              }}
                            >
                              {active ? (
                                <Check
                                  className="size-3"
                                  style={{ color: "var(--sig-graphite-1000)" }}
                                  aria-hidden
                                />
                              ) : null}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="tabular block text-2xs text-ink-muted">{code}</span>
                              <span className="block truncate text-xs text-ink">{label}</span>
                            </span>
                            <StatusDot status={asset.status} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </ScrollArea>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-3">
          <CardHeader>
            <div>
              <CardTitle>{metricLabel(metric)} over {RANGE_LABEL[range]}</CardTitle>
              <CardDescription>
                {analytics.data
                  ? `${analytics.data.series.length} series · ${analytics.data.bucket}ly buckets · times in UTC`
                  : "Select at least one asset"}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {analytics.isError ? (
              <ErrorState description={(analytics.error as Error).message} />
            ) : analytics.isPending || !analytics.data ? (
              <Skeleton className="h-80 w-full rounded-md" />
            ) : (
              <TimeSeriesChart
                series={analytics.data.series}
                metric={analytics.data.metric}
                unit={analytics.data.unit}
                bucket={analytics.data.bucket}
                height={340}
              />
            )}
          </CardContent>
        </Card>
      </section>

      {analytics.data && analytics.data.series.length > 0 ? (
        <Card className="mt-3">
          <CardHeader>
            <div>
              <CardTitle>Series summary</CardTitle>
              <CardDescription>
                Minimum, mean and maximum of each compared series across the window.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Asset</TableHead>
                  <TableHead className="text-right">Min</TableHead>
                  <TableHead className="text-right">Mean</TableHead>
                  <TableHead className="text-right">Max</TableHead>
                  <TableHead className="text-right">Spread</TableHead>
                  <TableHead className="text-right">Samples</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.data.series.map((series, index) => {
                  const { code, label } = splitAssetName(series.assetName);
                  return (
                    <TableRow key={series.assetId}>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <span
                            className="size-2.5 shrink-0 rounded-xs"
                            style={{ background: chartColor(index) }}
                            aria-hidden
                          />
                          <span>
                            <span className="tabular block text-2xs text-ink-muted">{code}</span>
                            <span className="block text-sm text-ink">{label}</span>
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="text-right" data-numeric>
                        {series.min} {series.unit}
                      </TableCell>
                      <TableCell className="text-right text-ink" data-numeric>
                        {series.avg} {series.unit}
                      </TableCell>
                      <TableCell className="text-right" data-numeric>
                        {series.max} {series.unit}
                      </TableCell>
                      <TableCell className="text-right" data-numeric>
                        {Math.round((series.max - series.min) * 100) / 100} {series.unit}
                      </TableCell>
                      <TableCell className="text-right" data-numeric>
                        {series.points.length}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
