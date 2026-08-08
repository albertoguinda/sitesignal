import { useSearchParams } from "react-router";
import { Activity, BellRing, HeartPulse, Waves, ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { SiteSelector } from "@/components/site-selector";
import { KpiCard } from "@/components/kpi-card";
import { AssetDistribution } from "@/components/asset-distribution";
import { ForecastCards } from "@/components/forecast-cards";
import { MetricSparkCards } from "@/components/metric-spark-cards";
import { AssetTable } from "@/components/asset-table";
import { AlertFeed } from "@/components/alert-feed";
import { AmbientPanel } from "@/components/ambient-panel";
import { ErrorState, SkeletonRows } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useOverview, useSites } from "@/lib/api";
import { formatCompact, formatNumber } from "@/lib/format";
import { useCurrentOrganization } from "@/lib/organization-context";

/** `?site=3` keeps the selected scope in the URL so a view can be shared. */
function useSiteScope(): [number | undefined, (siteId: number | undefined) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get("site");
  const parsed = raw === null ? Number.NaN : Number.parseInt(raw, 10);
  const siteId = Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;

  const setSiteId = (next: number | undefined) => {
    const updated = new URLSearchParams(params);
    if (next === undefined) updated.delete("site");
    else updated.set("site", String(next));
    setParams(updated, { replace: true });
  };

  return [siteId, setSiteId];
}

export default function OverviewPage() {
  const [siteId, setSiteId] = useSiteScope();
  const { currentOrgId } = useCurrentOrganization();
  const sites = useSites(currentOrgId);
  const overview = useOverview(siteId, currentOrgId);

  const kpis = overview.data?.kpis;
  const temperature = kpis?.averages?.find((entry) => entry.metric === "temperature");
  const otherAverages =
    kpis?.averages
      ?.filter((entry) => entry.metric !== "temperature")
      ?.map((entry) => `${entry.metric} ${formatNumber(entry.value, 1)} ${entry.unit}`)
      ?.join(" · ") ?? "";

  const scopeLabel =
    siteId === undefined
      ? "All sites"
      : (sites.data?.find((site) => site.id === siteId)?.name ?? "Site");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fleet"
        title="Overview"
        description="Live condition of every monitored asset, with the ambient conditions each site is operating in."
        actions={
          <SiteSelector sites={sites.data ?? []} value={siteId} onChange={setSiteId} />
        }
      />

      {overview.isError ? (
        <Card>
          <ErrorState
            title="Could not load the fleet"
            description={(overview.error as Error).message}
          />
        </Card>
      ) : null}

      {/* ═══════════════════════════════════════════════════════════════
          ROW 1 — KPI Cards (4 across)
         ═══════════════════════════════════════════════════════════════ */}
      <section aria-label="Key indicators" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {overview.isPending || !kpis
          ? Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-36 rounded-lg" />
            ))
          : [
              <KpiCard
                key="health"
                label="Fleet health"
                value={formatNumber(kpis.healthScore, 1)}
                unit="%"
                tone={
                  kpis.assetsCritical > 0 ? "critical" : kpis.assetsWarning > 0 ? "warning" : "ok"
                }
                icon={<HeartPulse className="size-4" aria-hidden />}
                segments={[
                  { label: "nominal", value: kpis.assetsOk, tone: "ok" },
                  { label: "warning", value: kpis.assetsWarning, tone: "warning" },
                  { label: "critical", value: kpis.assetsCritical, tone: "critical" },
                ]}
              />,
              <KpiCard
                key="alerts"
                label="Open alerts"
                value={String(kpis.openAlerts)}
                tone={kpis.openAlerts > 0 ? "critical" : "ok"}
                icon={<BellRing className="size-4" aria-hidden />}
                hint={`${kpis.ackAlerts} acknowledged · ${kpis.resolvedAlerts} resolved`}
              />,
              <KpiCard
                key="samples"
                label="Samples · 24 h"
                value={formatCompact(kpis.readingsLast24h)}
                tone="brand"
                icon={<Activity className="size-4" aria-hidden />}
                hint={`${kpis.assetsTotal} assets reporting on ${scopeLabel.toLowerCase()}`}
              />,
              <KpiCard
                key="temperature"
                label="Mean temperature"
                value={temperature ? formatNumber(temperature.value, 1) : "—"}
                unit={temperature?.unit}
                tone="neutral"
                icon={<Waves className="size-4" aria-hidden />}
                hint={otherAverages || "Latest sample across the fleet"}
              />,
            ]}
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          ROW 2 — Spark Metric Cards (3 across)
         ═══════════════════════════════════════════════════════════════ */}
      {overview.data && overview.data.assets.length > 0 ? (
        <MetricSparkCards assets={overview.data.assets} />
      ) : null}

      {/* ═══════════════════════════════════════════════════════════════
          BENTO BLOCK — Assets table and Recent alerts share a row so
          their bottom edges line up. The row's height is set by the
          tallest card (assets table with all 18 rows), and Recent
          alerts stretches to match. Fleet distribution sits on its own
          row below the bento, full width.
         ═══════════════════════════════════════════════════════════════ */}
      <div className="grid items-stretch gap-4 xl:grid-cols-[1fr_340px]">
        {/* Assets table — left column, shows every row, no inner scroll */}
        <Card className="flex min-w-0 flex-col overflow-hidden xl:row-start-1 xl:col-start-1">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle>Assets</CardTitle>
                <CardDescription>
                  Latest value per metric, with the count of alerts still open.
                </CardDescription>
              </div>
              {overview.data && overview.data.assets.length > 0 && (
                <span className="ml-auto shrink-0 rounded-full bg-sunken px-2.5 py-1 text-2xs tabular text-ink-muted">
                  {overview.data.assets.length} assets
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 p-0">
            {overview.isPending ? (
              <SkeletonRows rows={8} />
            ) : (
              <AssetTable assets={overview.data?.assets ?? []} showSite={siteId === undefined} />
            )}
          </CardContent>
        </Card>

        {/* Recent alerts — right column, stretches to match the table's height */}
        <Card className="flex flex-col overflow-hidden xl:row-start-1 xl:col-start-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent alerts</CardTitle>
              <ArrowRight className="size-4 text-ink-muted ml-auto" aria-hidden />
            </div>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-y-auto p-0">
            {overview.isPending ? (
              <SkeletonRows rows={6} />
            ) : (
              <AlertFeed alerts={overview.data?.recentAlerts ?? []} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          ROW 4 — Fleet distribution (full width, sits below the bento)
         ═══════════════════════════════════════════════════════════════ */}
      {overview.data && overview.data.assets.length > 0 ? (
        <section aria-label="Fleet distribution" className="xl:min-h-[260px]">
          <AssetDistribution assets={overview.data.assets} />
        </section>
      ) : null}

      {/* ═══════════════════════════════════════════════════════════════
          ROW 5 — Site forecasts (one card per site, full width)
         ═══════════════════════════════════════════════════════════════ */}
      {overview.data && overview.data.ambient.length > 0 ? (
        <ForecastCards sites={overview.data.ambient} />
      ) : null}

      {/* ═══════════════════════════════════════════════════════════════
          ROW 6 — Ambient conditions per site (full width)
         ═══════════════════════════════════════════════════════════════ */}
      {overview.data && overview.data.ambient.length > 0 ? (
        <section
          aria-label="Ambient conditions"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          {overview.data.ambient.map((ambient) => (
            <div key={ambient.siteId} className="panel px-4 py-3.5">
              <AmbientPanel ambient={ambient} compact />
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
