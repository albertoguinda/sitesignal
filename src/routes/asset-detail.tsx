import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, Boxes } from "lucide-react";
import { RANGES, type AssetRow, type RangeKey } from "@shared/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PageHeader } from "@/components/page-header";
import { AssetScene } from "@/components/asset-scene";
import { SensorReadout } from "@/components/sensor-readout";
import { MetricReadout } from "@/components/metric-readout";
import { AlertHistory } from "@/components/alert-feed";
import { AmbientPanel } from "@/components/ambient-panel";
import { TimeSeriesChart } from "@/components/time-series-chart";
import { ErrorState, SkeletonRows } from "@/components/states";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { useAmbient, useAsset } from "@/lib/api";
import { assetTypeLabel, formatDate, metricLabel, splitAssetName } from "@/lib/format";

const RANGE_LABEL: Record<RangeKey, string> = {
  "24h": "24 h",
  "7d": "7 d",
  "30d": "30 d",
  "60d": "60 d",
};

export default function AssetDetailPage() {
  const params = useParams<{ id: string }>();
  const assetId = Number.parseInt(params.id ?? "", 10);
  const [range, setRange] = useState<RangeKey>("7d");
  const [selectedId, setSelectedId] = useState<number>(assetId);

  const detail = useAsset(assetId, range);
  const ambient = useAmbient(detail.data?.site.id);

  // Navigating between assets must reset the floor-plan selection to the new one.
  useEffect(() => setSelectedId(assetId), [assetId]);

  const selected: AssetRow | null = useMemo(() => {
    if (!detail.data) return null;
    return detail.data.siblings?.find((asset) => asset.id === selectedId) ?? detail.data.asset;
  }, [detail.data, selectedId]);

  if (Number.isNaN(assetId)) {
    return <ErrorState title="Invalid asset id" description="The URL does not name an asset." />;
  }

  if (detail.isError) {
    return (
      <Card>
        <ErrorState title="Asset unavailable" description={(detail.error as Error).message} />
      </Card>
    );
  }

  const asset = detail.data?.asset;
  const name = asset ? splitAssetName(asset.name) : { code: "", label: "" };

  return (
    <>
      <PageHeader
        eyebrow={asset ? `${asset.siteName} · ${name.code}` : "Asset"}
        title={asset ? name.label : "Loading asset"}
        description={
          asset
            ? `${assetTypeLabel(asset.type)} · installed ${formatDate(asset.installedAt)} · position ${asset.posX}, ${asset.posY}, ${asset.posZ}`
            : undefined
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {asset ? <StatusBadge status={asset.status} /> : null}
            <ToggleGroup
              type="single"
              value={range}
              onValueChange={(next) => next && setRange(next as RangeKey)}
              aria-label="Time range"
            >
              {RANGES.map((key) => (
                <ToggleGroupItem key={key} value={key} aria-label={RANGE_LABEL[key]}>
                  {RANGE_LABEL[key]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <Button asChild variant="ghost" size="sm">
              <Link to="/">
                <ArrowLeft className="size-3.5" aria-hidden />
                Overview
              </Link>
            </Button>
          </div>
        }
      />

      <section className="grid gap-3 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Floor plan</CardTitle>
              <CardDescription>
                Every asset on this site, extruded from its stored coordinates and tinted by status.
              </CardDescription>
            </div>
            <Badge tone="neutral">
              <Boxes className="size-3" aria-hidden />
              {detail.data?.siblings.length ?? 0} assets
            </Badge>
          </CardHeader>
          <CardContent className="p-3">
            {detail.isPending || !detail.data ? (
              <Skeleton className="h-[26rem] w-full rounded-lg" />
            ) : (
              <AssetScene
                assets={detail.data.siblings}
                selectedId={selectedId}
                onSelect={(next) => setSelectedId(next.id)}
                className="h-[26rem]"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Sensor readout</CardTitle>
              <CardDescription>Values behind the selected hotspot.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {detail.isPending ? (
              <SkeletonRows rows={5} />
            ) : (
              <SensorReadout asset={selected} isCurrent={selected?.id === assetId} />
            )}
          </CardContent>
        </Card>
      </section>

      {asset && asset.latest.length > 0 ? (
        <section
          aria-label="Latest readings"
          className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          {asset.latest.map((reading) => (
            <MetricReadout key={reading.metric} reading={reading} variant="block" />
          ))}
        </section>
      ) : null}

      <section className="mt-3 grid gap-3 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Telemetry</CardTitle>
              <CardDescription>
                Bucketed averages over the selected range, one tab per metric this asset reports.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {detail.isPending || !detail.data ? (
              <Skeleton className="h-72 w-full rounded-md" />
            ) : detail.data.series.length === 0 ? (
              <ErrorState title="No telemetry" description="This asset has not reported yet." />
            ) : (
              <Tabs defaultValue={detail.data.series[0]?.metric ?? "temperature"}>
                <TabsList>
                  {detail.data.series.map((series) => (
                    <TabsTrigger key={series.metric} value={series.metric}>
                      {metricLabel(series.metric)}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {detail.data.series.map((series) => (
                  <TabsContent key={series.metric} value={series.metric} className="mt-3">
                    <dl className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-xs">
                      {(
                        [
                          ["min", series.min],
                          ["avg", series.avg],
                          ["max", series.max],
                        ] as const
                      ).map(([label, value]) => (
                        <div key={label} className="flex items-baseline gap-1.5">
                          <dt className="label-caps">{label}</dt>
                          <dd className="tabular text-sm text-ink">
                            {value}
                            <span className="ml-0.5 text-2xs text-ink-muted">{series.unit}</span>
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <TimeSeriesChart
                      series={[series]}
                      metric={series.metric}
                      unit={series.unit}
                      bucket={range === "24h" || range === "7d" ? "hour" : "day"}
                      colorBy="metric"
                      showLegend={false}
                      height={280}
                    />
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3">
          {ambient.data ? (
            <Card>
              <CardContent>
                <AmbientPanel ambient={ambient.data} compact />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Alert history</CardTitle>
                <CardDescription>Every alert raised against this asset.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {detail.isPending || !detail.data ? (
                <SkeletonRows rows={4} />
              ) : (
                <AlertHistory alerts={detail.data.alerts} siteName={detail.data.site.name} />
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}
