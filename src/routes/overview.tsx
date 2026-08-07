import { useSearchParams } from "react-router-dom";
import { Activity, BellRing, HeartPulse, Waves } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { SiteSelector } from "@/components/site-selector";
import { KpiCard } from "@/components/kpi-card";
import { AssetTable } from "@/components/asset-table";
import { AlertFeed } from "@/components/alert-feed";
import { AmbientPanel } from "@/components/ambient-panel";
import { ErrorState, SkeletonRows } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useOverview, useSites } from "@/lib/api";
import { formatCompact, formatNumber } from "@/lib/format";

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
  const sites = useSites();
  const overview = useOverview(siteId);

  const kpis = overview.data?.kpis;
  const temperature = kpis?.averages.find((entry) => entry.metric === "temperature");
  const otherAverages =
    kpis?.averages
      .filter((entry) => entry.metric !== "temperature")
      .map((entry) => `${entry.metric} ${formatNumber(entry.value, 1)} ${entry.unit}`)
      .join(" · ") ?? "";

  const scopeLabel =
    siteId === undefined
      ? "All sites"
      : (sites.data?.find((site) => site.id === siteId)?.name ?? "Site");

  return (
    <>
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

      <section aria-label="Key indicators" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {overview.isPending || !kpis
          ? Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-[8.5rem] rounded-lg" />
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

      {overview.data && overview.data.ambient.length > 0 ? (
        <section
          aria-label="Ambient conditions"
          className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3"
        >
          {overview.data.ambient.map((ambient) => (
            <div key={ambient.siteId} className="panel px-4 py-3.5">
              <AmbientPanel ambient={ambient} compact />
            </div>
          ))}
        </section>
      ) : null}

      {/* The asset table carries eight columns; the alert rail is given a fixed
          width so the table keeps every pixel that is left. */}
      <section className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <Card className="min-w-0">
          <CardHeader>
            <div>
              <CardTitle>Assets</CardTitle>
              <CardDescription>
                Latest value per metric, with the count of alerts still open. Sort any column.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {overview.isPending ? (
              <SkeletonRows rows={8} />
            ) : (
              <AssetTable assets={overview.data?.assets ?? []} showSite={siteId === undefined} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Recent alerts</CardTitle>
              <CardDescription>Open first, then acknowledged, then resolved.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {overview.isPending ? (
              <SkeletonRows rows={6} />
            ) : (
              <AlertFeed alerts={overview.data?.recentAlerts ?? []} />
            )}
          </CardContent>
        </Card>
      </section>
    </>
  );
}
