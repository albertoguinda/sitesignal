import { useEffect, useMemo, useState } from "react";
import { Check, BarChart3, TrendingUp, Filter } from "lucide-react";
import { METRICS, RANGES, type Metric, type RangeKey } from "@shared/types";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { SiteSelector } from "@/components/site-selector";
import { TimeSeriesChart } from "@/components/time-series-chart";
import { EmptyState, ErrorState } from "@/components/states";
import { StatusDot } from "@/components/status-badge";
import { chartColor, metricColor } from "@/theme/tokens";
import { useAnalytics, useAssets, useSites } from "@/lib/api";
import { formatNumber, metricDigits, metricLabel, splitAssetName } from "@/lib/format";
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

const RANGE_DESC: Record<RangeKey, string> = {
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "60d": "Last 60 days",
};

/** Summary stat pill for the chart header. */
function StatPill({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-sunken/60 px-2.5 py-1.5">
      <span className="text-2xs text-ink-muted">{label}</span>
      <span className="tabular text-xs font-semibold text-ink">
        {value}
        {unit ? <span className="font-normal text-ink-muted"> {unit}</span> : null}
      </span>
    </div>
  );
}

export default function AnalyticsPage() {
  const [siteId, setSiteId] = useState<number | undefined>(undefined);
  const [metric, setMetric] = useState<Metric>("temperature");
  const [range, setRange] = useState<RangeKey>("30d");
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

  // react-query keeps the previous response as placeholder while a fetch is in
  // flight; never render the old range/metric under the new label.
  const data =
    analytics.data &&
    analytics.data.range === range &&
    analytics.data.metric === metric
      ? analytics.data
      : undefined;

  // Aggregate stats across all series
  const aggregateStats = useMemo(() => {
    if (!data?.series.length) return null;
    const allMin = Math.min(...data.series.map((s) => s.min));
    const allMax = Math.max(...data.series.map((s) => s.max));
    const allMean = data.series.reduce((sum, s) => sum + s.avg, 0) / data.series.length;
    const totalSamples = data.series.reduce((sum, s) => sum + s.points.length, 0);
    return { allMin, allMax, allMean, totalSamples };
  }, [data]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Telemetry"
        title="Analytics"
        description="Compare the same metric across up to six assets over any window from a day to two months."
        actions={<SiteSelector sites={sites.data ?? []} value={siteId} onChange={setSiteId} />}
      />

      <div className="grid gap-5 xl:grid-cols-[300px_1fr]">
        {/* ── Left Panel: Controls ── */}
        <aside className="flex flex-col gap-4 xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)]">
          {/* Metric Selector */}
          <div className="panel px-4 py-3.5">
            <label className="label-caps mb-2.5 flex items-center gap-2" htmlFor="analytics-metric">
              <Filter className="size-3.5 text-ink-muted" aria-hidden />
              Metric
            </label>
            <Select value={metric} onValueChange={(next) => setMetric(next as Metric)}>
              <SelectTrigger id="analytics-metric" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METRICS.map((entry) => (
                  <SelectItem key={entry} value={entry}>
                    <span className="flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ background: metricColor(entry) }} />
                      {metricLabel(entry)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Range Selector */}
          <div className="panel px-4 py-3.5">
            <div className="mb-2.5 flex items-center gap-2">
              <BarChart3 className="size-3.5 text-ink-muted" aria-hidden />
              <span className="label-caps">Range</span>
              <span className="ml-auto text-2xs text-ink-faint">{RANGE_DESC[range]}</span>
            </div>
            <ToggleGroup
              type="single"
              value={range}
              onValueChange={(next) => next && setRange(next as RangeKey)}
              aria-label="Time range"
              className="grid grid-cols-4 gap-1"
            >
              {RANGES.map((key) => (
                <ToggleGroupItem key={key} value={key} className="text-xs">
                  {RANGE_LABEL[key]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {/* Asset Picker */}
          <div className="panel flex flex-1 flex-col overflow-hidden px-4 py-3.5">
            <div className="p-4 pb-0">
              <div className="mb-2.5 flex items-center gap-2">
                <TrendingUp className="size-3.5 text-ink-muted" aria-hidden />
                <span className="label-caps">Assets</span>
              <span className="ml-auto rounded-full bg-brand-wash px-2 py-0.5 text-2xs font-medium text-brand tabular" aria-live="polite">
                {selectedIds.length}/{MAX_SERIES}
              </span>
              </div>
              <p className="text-2xs text-ink-faint">
                Select up to {MAX_SERIES} assets to compare on the same chart.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[420px] xl:max-h-none p-2">
              {assets.isPending ? (
                <div className="flex flex-col gap-1.5 p-2">
                  {Array.from({ length: 6 }, (_, index) => (
                    <Skeleton key={index} className="h-12 w-full rounded-lg" />
                  ))}
                </div>
              ) : assets.isError ? (
                <div className="p-4">
                  <ErrorState description={(assets.error as Error).message} />
                </div>
              ) : candidates.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    title="No assets report this metric"
                    description="Pick another metric or widen the site scope."
                  />
                </div>
              ) : (
                <ul className="divide-y divide-line-faint rounded-lg border border-line-faint">
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
                          aria-label={`${label}, ${asset.status}`}
                          title={atLimit ? `Series limit of ${MAX_SERIES} reached` : undefined}
                          className={cn(
                            "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors motion-fast",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus",
                            active
                              ? "bg-brand/8"
                              : "hover:bg-sunken/40",
                            atLimit && "cursor-not-allowed opacity-40",
                          )}
                        >
                          <span
                            className="grid size-4 shrink-0 place-items-center rounded-[4px] border-2 transition-colors"
                            style={{
                              borderColor: active ? chartColor(index) : "var(--sig-line-strong)",
                              background: active ? chartColor(index) : "transparent",
                            }}
                          >
                            {active ? (
                              <Check
                                className="size-2.5"
                                style={{ color: "var(--sig-graphite-1000)" }}
                                aria-hidden
                              />
                            ) : null}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-medium text-ink">{label}</span>
                            <span className="tabular block text-2xs text-ink-muted">{code}</span>
                          </span>
                          <StatusDot status={asset.status} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </aside>

        {/* ── Right Panel: Chart + Summary ── */}
        <div className="flex h-full flex-col gap-4">
          {/* Chart Card */}
          <div className="panel flex min-h-0 flex-1 flex-col overflow-hidden">
            {/* Chart Header */}
            <div className="flex items-start justify-between gap-4 border-b border-line-faint px-5 py-4">
              <div>
                <h2 className="text-md font-semibold text-ink">
                  {metricLabel(metric)} over {RANGE_LABEL[range]}
                </h2>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {data
                    ? `${data.series.length} series · ${data.bucket === "day" ? "daily" : "hourly"} buckets · UTC`
                    : "Select at least one asset to compare"}
                </p>
              </div>
              {aggregateStats && (
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  <StatPill label="Min" value={formatNumber(aggregateStats.allMin, metricDigits(metric))} unit={data?.unit} />
                  <StatPill label="Mean" value={formatNumber(aggregateStats.allMean, metricDigits(metric))} unit={data?.unit} />
                  <StatPill label="Max" value={formatNumber(aggregateStats.allMax, metricDigits(metric))} unit={data?.unit} />
                  <StatPill label="Samples" value={String(aggregateStats.totalSamples)} />
                </div>
              )}
            </div>

            {/* Chart Area */}
            <div className="min-h-0 flex-1 px-5 py-4">
              {analytics.isError ? (
                <ErrorState description={(analytics.error as Error).message} />
              ) : analytics.isPending || !data ? (
                <div className="flex flex-col gap-3">
                  <Skeleton className="h-80 w-full rounded-lg" />
                  <div className="grid grid-cols-4 gap-2">
                    <Skeleton className="h-12 rounded-lg" />
                    <Skeleton className="h-12 rounded-lg" />
                    <Skeleton className="h-12 rounded-lg" />
                    <Skeleton className="h-12 rounded-lg" />
                  </div>
                </div>
              ) : data.series.length === 0 ? (
                <div className="flex h-80 items-center justify-center rounded-lg border border-dashed border-line-faint">
                  <EmptyState
                    title="No data in this window"
                    description="Try a different range or metric."
                  />
                </div>
              ) : (
                <TimeSeriesChart
                  series={data.series}
                  metric={data.metric}
                  unit={data.unit}
                  bucket={data.bucket}
                  height="100%"
                />
              )}
            </div>
          </div>

          {/* Series Summary Table */}
          {data && data.series.length > 0 && (
            <div className="panel overflow-hidden">
              <div className="border-b border-line-faint px-5 py-3">
                <p className="label-caps">Series Summary</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line-faint bg-sunken/30 text-left">
                      <th scope="col" className="label-caps px-5 py-2.5">Asset</th>
                      <th scope="col" className="label-caps px-5 py-2.5 text-right">
                        Min <span className="font-normal text-ink-faint">{data.unit}</span>
                      </th>
                      <th scope="col" className="label-caps px-5 py-2.5 text-right">
                        Mean <span className="font-normal text-ink-faint">{data.unit}</span>
                      </th>
                      <th scope="col" className="label-caps px-5 py-2.5 text-right">
                        Max <span className="font-normal text-ink-faint">{data.unit}</span>
                      </th>
                      <th scope="col" className="label-caps px-5 py-2.5 text-right">
                        Spread <span className="font-normal text-ink-faint">{data.unit}</span>
                      </th>
                      <th scope="col" className="label-caps px-5 py-2.5 text-right">Samples</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.series.map((series, index) => {
                      const { code, label } = splitAssetName(series.assetName);
                      return (
                        <tr key={series.assetId} className="border-b border-line-faint last:border-b-0 hover:bg-sunken/20 transition-colors">
                          <td className="px-5 py-3">
                            <span className="flex items-center gap-2.5">
                              <span
                                className="size-2.5 shrink-0 rounded-sm"
                                style={{ background: chartColor(index) }}
                                aria-hidden
                              />
                              <span>
                                <span className="block text-xs font-medium text-ink">{label}</span>
                                <span className="tabular block text-2xs text-ink-muted">{code}</span>
                              </span>
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right tabular text-xs text-ink-soft" data-numeric>
                            {formatNumber(series.min, metricDigits(metric))}
                          </td>
                          <td className="px-5 py-3 text-right tabular text-xs font-semibold text-ink" data-numeric>
                            {formatNumber(series.avg, metricDigits(metric))}
                          </td>
                          <td className="px-5 py-3 text-right tabular text-xs text-ink-soft" data-numeric>
                            {formatNumber(series.max, metricDigits(metric))}
                          </td>
                          <td className="px-5 py-3 text-right tabular text-xs text-ink-soft" data-numeric>
                            {formatNumber(series.max - series.min, metricDigits(metric))}
                          </td>
                          <td className="px-5 py-3 text-right tabular text-xs text-ink-muted" data-numeric>
                            {series.points.length}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
