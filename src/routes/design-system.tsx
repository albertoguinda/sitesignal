import { useMemo, type ReactNode } from "react";
import { Bell, Boxes, Download, Gauge, Plus } from "lucide-react";
import type { AlertWithAsset, AssetRow, MetricSeries } from "@shared/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { AlertStateBadge, SeverityBadge, StatusBadge, StatusDot } from "@/components/status-badge";
import { KpiCard } from "@/components/kpi-card";
import { MetricReadout } from "@/components/metric-readout";
import { AlertFeed } from "@/components/alert-feed";
import { SensorReadout } from "@/components/sensor-readout";
import { TimeSeriesChart } from "@/components/time-series-chart";
import { EmptyState, ErrorState } from "@/components/states";
import {
  COLOR_TOKEN_GROUPS,
  ELEVATION_SCALE,
  MOTION_SCALE,
  RADIUS_SCALE,
  SPACE_SCALE,
  TYPE_SCALE,
  readToken,
} from "@/theme/tokens";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Documentation primitives                                                   */
/* -------------------------------------------------------------------------- */

function Section({
  id,
  title,
  blurb,
  children,
}: {
  id: string;
  title: string;
  blurb: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="mb-3">
        <h2 className="text-xl tracking-tight">{title}</h2>
        <p className="mt-1 max-w-3xl text-sm text-ink-muted">{blurb}</p>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function Specimen({
  name,
  usage,
  children,
  className,
}: {
  name: string;
  usage?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line-faint px-4 py-2.5">
        <p className="tabular text-sm font-semibold text-ink">{name}</p>
        {usage ? <p className="text-xs text-ink-muted">{usage}</p> : null}
      </div>
      <div className={cn("p-4", className)}>{children}</div>
    </div>
  );
}

/** Swatch value is read from the live stylesheet, never restated in TS. */
function ColorSwatch({ token, description }: { token: string; description: string }) {
  const value = readToken(token);
  return (
    <li className="flex items-center gap-3 rounded-md border border-line bg-elevated p-2">
      <span
        className="size-9 shrink-0 rounded-md border border-line-strong"
        style={{ background: `var(${token})` }}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <code className="tabular block truncate text-2xs text-ink">{token}</code>
        <span className="block truncate text-2xs text-ink-muted">{description}</span>
        <span className="tabular block truncate text-2xs text-ink-faint">{value}</span>
      </span>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Sample data — the documentation renders the real components, not mock-ups   */
/* -------------------------------------------------------------------------- */

const SAMPLE_ASSET: AssetRow = {
  id: 0,
  siteId: 0,
  name: "NG-P02 · Feed Pump B",
  type: "pump",
  status: "warning",
  posX: -4.5,
  posY: 0,
  posZ: 3,
  installedAt: "2019-04-18T08:00:00.000Z",
  siteName: "Northgate Processing",
  siteTimezone: "Europe/Amsterdam",
  openAlerts: 1,
  worstSeverity: "warning",
  latest: [
    {
      metric: "temperature",
      value: 71.4,
      unit: "°C",
      recordedAt: "2026-08-07T06:00:00Z",
      delta24h: 2.6,
    },
    {
      metric: "vibration",
      value: 3.02,
      unit: "mm/s",
      recordedAt: "2026-08-07T06:00:00Z",
      delta24h: 0.18,
    },
  ],
};

const SAMPLE_ALERTS: AlertWithAsset[] = [
  {
    id: 1,
    assetId: 6,
    severity: "critical",
    message: "Drive-end vibration above 6.0 mm/s across three consecutive windows",
    state: "open",
    openedAt: new Date(Date.now() - 4_200_000).toISOString(),
    assetName: "NG-V01 · Belt Conveyor",
    assetType: "conveyor",
    siteId: 1,
    siteName: "Northgate Processing",
  },
  {
    id: 2,
    assetId: 2,
    severity: "warning",
    message: "Bearing temperature trending +8 °C week over week",
    state: "ack",
    openedAt: new Date(Date.now() - 176_400_000).toISOString(),
    assetName: "NG-P02 · Feed Pump B",
    assetType: "pump",
    siteId: 1,
    siteName: "Northgate Processing",
  },
  {
    id: 3,
    assetId: 4,
    severity: "info",
    message: "Feedwater conductivity spike cleared after blowdown",
    state: "resolved",
    openedAt: new Date(Date.now() - 604_800_000).toISOString(),
    assetName: "NG-B01 · Steam Boiler",
    assetType: "boiler",
    siteId: 1,
    siteName: "Northgate Processing",
  },
];

function buildSampleSeries(): MetricSeries[] {
  const start = Date.UTC(2026, 7, 1);
  const points = Array.from({ length: 48 }, (_, index) => ({
    t: new Date(start + index * 3_600_000).toISOString(),
    v: Math.round((62 + Math.sin(index / 3.6) * 4 + Math.cos(index / 9) * 1.6) * 100) / 100,
  }));
  const values = points.map((point) => point.v);
  return [
    {
      assetId: 1,
      assetName: "NG-P01 · Feed Pump A",
      metric: "temperature",
      unit: "°C",
      points,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100,
    },
  ];
}

const NAV_SECTIONS = [
  { id: "colour", label: "Colour" },
  { id: "type", label: "Typography" },
  { id: "space", label: "Spacing" },
  { id: "shape", label: "Shape & elevation" },
  { id: "motion", label: "Motion" },
  { id: "controls", label: "Controls" },
  { id: "status", label: "Status" },
  { id: "surfaces", label: "Surfaces & data" },
  { id: "domain", label: "Domain components" },
  { id: "feedback", label: "Feedback" },
];

/* -------------------------------------------------------------------------- */

export default function DesignSystemPage() {
  const sampleSeries = useMemo(buildSampleSeries, []);

  return (
    <>
      <PageHeader
        eyebrow="Foundations"
        title="Design system"
        description="Living documentation. Every swatch, scale and specimen below is rendered by the same token file and the same components the product ships with — if this page looks right, the product does."
      />

      <div className="grid gap-6 lg:grid-cols-[12rem_minmax(0,1fr)]">
        <nav aria-label="Design system sections" className="hidden lg:block">
          <ul className="sticky top-20 flex flex-col gap-0.5">
            {NAV_SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="block rounded-md px-2.5 py-1.5 text-xs font-semibold text-ink-muted transition-colors motion-fast hover:bg-elevated hover:text-ink"
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-col gap-10">
          {/* --- Colour ---------------------------------------------------- */}
          <Section
            id="colour"
            title="Colour"
            blurb="Three layers: primitives hold the raw ramp, semantic tokens give them meaning, and components only ever reference the semantic layer. Values shown are read live from the stylesheet."
          >
            {COLOR_TOKEN_GROUPS.map((group) => (
              <Specimen
                key={group.title}
                name={group.title}
                usage={`${group.layer} layer · ${group.blurb}`}
              >
                <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {group.tokens.map((token) => (
                    <ColorSwatch
                      key={token.name}
                      token={token.name}
                      description={token.description}
                    />
                  ))}
                </ul>
              </Specimen>
            ))}
          </Section>

          {/* --- Typography ------------------------------------------------ */}
          <Section
            id="type"
            title="Typography"
            blurb="A 14 px body sets the density for an operations console. Numeric columns always switch to the mono face with tabular figures so digits line up down a column."
          >
            <Specimen name="Scale">
              <ul className="flex flex-col divide-y divide-line-faint">
                {TYPE_SCALE.map((step) => (
                  <li key={step.name} className="flex items-baseline gap-4 py-2.5">
                    <code className="tabular w-14 shrink-0 text-2xs text-ink-muted">
                      {step.name}
                    </code>
                    <span
                      className="min-w-0 flex-1 truncate text-ink"
                      style={{ fontSize: `var(${step.token})` }}
                    >
                      Bearing temperature nominal
                    </span>
                    <span className="tabular hidden shrink-0 text-2xs text-ink-faint sm:block">
                      {readToken(step.token)}
                    </span>
                    <span className="hidden w-52 shrink-0 text-2xs text-ink-muted lg:block">
                      {step.usage}
                    </span>
                  </li>
                ))}
              </ul>
            </Specimen>

            <div className="grid gap-3 md:grid-cols-2">
              <Specimen name="Sans" usage="--sig-font-sans · interface">
                <p className="text-md text-ink">Northgate Processing · Feed Pump B</p>
                <p className="mt-1 text-sm text-ink-soft">
                  Bearing temperature trending +8 °C week over week.
                </p>
              </Specimen>
              <Specimen name="Mono" usage="--sig-font-mono · every figure">
                <p className="tabular text-md text-ink">71.4 °C · 3.02 mm/s · 58 %</p>
                <p className="tabular mt-1 text-sm text-ink-soft">NG-P02 · 2026-08-07T06:00Z</p>
              </Specimen>
            </div>
          </Section>

          {/* --- Spacing --------------------------------------------------- */}
          <Section
            id="space"
            title="Spacing"
            blurb="A 4 pt grid. Panels use 4 inside, sections use 3 between, page rhythm uses 6."
          >
            <Specimen name="Scale">
              <ul className="flex flex-col gap-2">
                {SPACE_SCALE.map((step) => (
                  <li key={step.name} className="flex items-center gap-3">
                    <code className="tabular w-8 shrink-0 text-2xs text-ink-muted">
                      {step.name}
                    </code>
                    <span
                      className="h-3 rounded-xs bg-brand/60"
                      style={{ width: `var(${step.token})` }}
                      aria-hidden
                    />
                    <span className="tabular text-2xs text-ink-faint">{readToken(step.token)}</span>
                  </li>
                ))}
              </ul>
            </Specimen>
          </Section>

          {/* --- Shape & elevation ---------------------------------------- */}
          <Section
            id="shape"
            title="Shape & elevation"
            blurb="Radii stay tight — this is instrumentation, not consumer software. Elevation is carried by shadow plus a one-pixel inner highlight."
          >
            <div className="grid gap-3 md:grid-cols-2">
              <Specimen name="Radius">
                <ul className="flex flex-wrap gap-3">
                  {RADIUS_SCALE.map((step) => (
                    <li key={step.name} className="flex flex-col items-center gap-1.5">
                      <span
                        className="size-14 border border-line-strong bg-elevated"
                        style={{ borderRadius: `var(${step.token})` }}
                        aria-hidden
                      />
                      <code className="text-2xs text-ink-muted">{step.name}</code>
                    </li>
                  ))}
                </ul>
              </Specimen>

              <Specimen name="Elevation">
                <ul className="flex flex-wrap gap-4">
                  {ELEVATION_SCALE.map((step) => (
                    <li key={step.name} className="flex flex-col items-center gap-1.5">
                      <span
                        className="size-14 rounded-md border border-line bg-raised"
                        style={{ boxShadow: `var(${step.token})` }}
                        aria-hidden
                      />
                      <code className="text-2xs text-ink-muted">{step.name}</code>
                      <span className="max-w-24 text-center text-2xs text-ink-faint">
                        {step.usage}
                      </span>
                    </li>
                  ))}
                </ul>
              </Specimen>
            </div>
          </Section>

          {/* --- Motion ---------------------------------------------------- */}
          <Section
            id="motion"
            title="Motion"
            blurb="Four durations and two easings. Every one collapses to 0 ms under prefers-reduced-motion, including the 3D scene's auto-orbit and hotspot pulse."
          >
            <Specimen name="Durations">
              <ul className="flex flex-col divide-y divide-line-faint">
                {MOTION_SCALE.map((step) => (
                  <li key={step.name} className="flex items-center gap-4 py-2.5">
                    <code className="tabular w-16 shrink-0 text-2xs text-ink-muted">
                      {step.name}
                    </code>
                    <span className="tabular w-14 shrink-0 text-2xs text-ink-faint">
                      {readToken(step.token)}
                    </span>
                    <span className="text-xs text-ink-soft">{step.usage}</span>
                  </li>
                ))}
              </ul>
            </Specimen>
          </Section>

          {/* --- Controls -------------------------------------------------- */}
          <Section
            id="controls"
            title="Controls"
            blurb="Radix primitives styled entirely through tokens. Every control keeps a visible focus ring and a 2.25 rem minimum hit area."
          >
            <Specimen name="Button" usage="variant × size">
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="primary">
                    <Plus aria-hidden />
                    Primary
                  </Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="danger">Danger</Button>
                  <Button variant="link">Link</Button>
                  <Button variant="secondary" disabled>
                    Disabled
                  </Button>
                </div>
                <Separator />
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm">Small</Button>
                  <Button size="md">Medium</Button>
                  <Button size="lg">Large</Button>
                  <Button size="icon" aria-label="Download">
                    <Download aria-hidden />
                  </Button>
                </div>
              </div>
            </Specimen>

            <div className="grid gap-3 md:grid-cols-2">
              <Specimen name="Select" usage="Radix Select">
                <Select defaultValue="northgate">
                  <SelectTrigger aria-label="Sample select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="northgate">Northgate Processing</SelectItem>
                    <SelectItem value="ridgeline">Ridgeline Substation</SelectItem>
                    <SelectItem value="kanto">Kanto Cold Store</SelectItem>
                  </SelectContent>
                </Select>
              </Specimen>

              <Specimen name="Input">
                <Input placeholder="Filter assets…" aria-label="Sample input" />
              </Specimen>

              <Specimen name="Toggle group" usage="range selection">
                <ToggleGroup type="single" defaultValue="7d" aria-label="Sample range">
                  <ToggleGroupItem value="24h">24 h</ToggleGroupItem>
                  <ToggleGroupItem value="7d">7 d</ToggleGroupItem>
                  <ToggleGroupItem value="30d">30 d</ToggleGroupItem>
                  <ToggleGroupItem value="60d">60 d</ToggleGroupItem>
                </ToggleGroup>
              </Specimen>

              <Specimen name="Tooltip">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline">
                      <Gauge aria-hidden />
                      Hover me
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Vibration measured at the drive-end bearing.</TooltipContent>
                </Tooltip>
              </Specimen>
            </div>

            <Specimen name="Tabs">
              <Tabs defaultValue="temperature">
                <TabsList>
                  <TabsTrigger value="temperature">Temperature</TabsTrigger>
                  <TabsTrigger value="vibration">Vibration</TabsTrigger>
                  <TabsTrigger value="humidity">Humidity</TabsTrigger>
                </TabsList>
                <TabsContent value="temperature" className="mt-3 text-sm text-ink-soft">
                  Panel content for temperature.
                </TabsContent>
                <TabsContent value="vibration" className="mt-3 text-sm text-ink-soft">
                  Panel content for vibration.
                </TabsContent>
                <TabsContent value="humidity" className="mt-3 text-sm text-ink-soft">
                  Panel content for humidity.
                </TabsContent>
              </Tabs>
            </Specimen>
          </Section>

          {/* --- Status ---------------------------------------------------- */}
          <Section
            id="status"
            title="Status"
            blurb="One hue per state, used identically in badges, table rows, chart strokes and 3D materials. Status is never carried by colour alone — a label or dot always accompanies it."
          >
            <div className="grid gap-3 md:grid-cols-2">
              <Specimen name="Asset status">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status="ok" />
                  <StatusBadge status="warning" />
                  <StatusBadge status="critical" />
                  <span className="ml-2 flex items-center gap-1.5 text-xs text-ink-muted">
                    <StatusDot status="ok" /> dot only
                  </span>
                </div>
              </Specimen>

              <Specimen name="Alert severity & state">
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityBadge severity="info" />
                  <SeverityBadge severity="warning" />
                  <SeverityBadge severity="critical" />
                  <Separator orientation="vertical" className="h-5" />
                  <AlertStateBadge state="open" />
                  <AlertStateBadge state="ack" />
                  <AlertStateBadge state="resolved" />
                </div>
              </Specimen>
            </div>

            <Specimen name="Badge" usage="tone">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="neutral">neutral</Badge>
                <Badge tone="brand">brand</Badge>
                <Badge tone="ok">ok</Badge>
                <Badge tone="warning">warning</Badge>
                <Badge tone="critical">critical</Badge>
                <Badge tone="info">info</Badge>
              </div>
            </Specimen>
          </Section>

          {/* --- Surfaces & data ------------------------------------------- */}
          <Section
            id="surfaces"
            title="Surfaces & data display"
            blurb="Panels are the only container. Tables are dense by default, numeric cells are right-aligned and tabular."
          >
            <Specimen name="Card">
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>Card title</CardTitle>
                    <CardDescription>Supporting description under the title.</CardDescription>
                  </div>
                  <Badge tone="neutral">
                    <Boxes className="size-3" aria-hidden />6 assets
                  </Badge>
                </CardHeader>
                <CardContent className="text-sm text-ink-soft">
                  Body content sits on the raised surface with 4-unit padding.
                </CardContent>
                <CardFooter>Footer metadata</CardFooter>
              </Card>
            </Specimen>

            <Specimen name="Table" className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Asset</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Temperature</TableHead>
                    <TableHead className="text-right">Vibration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>NG-P01 · Feed Pump A</TableCell>
                    <TableCell>
                      <StatusBadge status="ok" />
                    </TableCell>
                    <TableCell className="text-right" data-numeric>
                      62.4 °C
                    </TableCell>
                    <TableCell className="text-right" data-numeric>
                      2.41 mm/s
                    </TableCell>
                  </TableRow>
                  <TableRow data-selected="true">
                    <TableCell>NG-P02 · Feed Pump B</TableCell>
                    <TableCell>
                      <StatusBadge status="warning" />
                    </TableCell>
                    <TableCell className="text-right" data-numeric>
                      71.4 °C
                    </TableCell>
                    <TableCell className="text-right" data-numeric>
                      3.02 mm/s
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Specimen>

            <Specimen name="Scroll area" usage="constrained lists">
              <ScrollArea className="h-28 rounded-md border border-line p-2">
                <ul className="flex flex-col gap-1 text-xs text-ink-soft">
                  {Array.from({ length: 12 }, (_, index) => (
                    <li key={index} className="tabular">
                      NG-{String(index + 1).padStart(2, "0")} · sample row
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </Specimen>

            <Specimen name="Time series chart" usage="Recharts, tokenised">
              <TimeSeriesChart
                series={sampleSeries}
                metric="temperature"
                unit="°C"
                bucket="hour"
                colorBy="metric"
                showLegend={false}
                height={220}
              />
            </Specimen>
          </Section>

          {/* --- Domain components ----------------------------------------- */}
          <Section
            id="domain"
            title="Domain components"
            blurb="Composites built from the primitives above. These are the pieces the three product screens are assembled from."
          >
            <Specimen name="KPI card">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <KpiCard
                  label="Fleet health"
                  value="66.7"
                  unit="%"
                  tone="critical"
                  icon={<Gauge className="size-4" aria-hidden />}
                  segments={[
                    { label: "nominal", value: 12, tone: "ok" },
                    { label: "warning", value: 4, tone: "warning" },
                    { label: "critical", value: 2, tone: "critical" },
                  ]}
                />
                <KpiCard
                  label="Open alerts"
                  value="5"
                  tone="critical"
                  icon={<Bell className="size-4" aria-hidden />}
                  hint="3 acknowledged · 4 resolved"
                />
                <KpiCard label="Samples · 24 h" value="936" tone="brand" hint="18 assets reporting" />
              </div>
            </Specimen>

            <Specimen name="Metric readout" usage="inline and block">
              <div className="flex flex-col gap-3">
                <p className="flex flex-wrap items-center gap-4">
                  {SAMPLE_ASSET.latest.map((reading) => (
                    <MetricReadout key={reading.metric} reading={reading} />
                  ))}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {SAMPLE_ASSET.latest.map((reading) => (
                    <MetricReadout key={reading.metric} reading={reading} variant="block" />
                  ))}
                </div>
              </div>
            </Specimen>

            <div className="grid gap-3 xl:grid-cols-2">
              <Specimen name="Alert feed" className="p-0">
                <AlertFeed alerts={SAMPLE_ALERTS} />
              </Specimen>
              <Specimen name="Sensor readout" className="p-0">
                <SensorReadout asset={SAMPLE_ASSET} isCurrent={false} />
              </Specimen>
            </div>
          </Section>

          {/* --- Feedback --------------------------------------------------- */}
          <Section
            id="feedback"
            title="Feedback & loading"
            blurb="Nothing in the product renders a blank region: every async surface has a skeleton, and every failure has an explanation."
          >
            <div className="grid gap-3 md:grid-cols-3">
              <Specimen name="Skeleton">
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-4/5" />
                  <Skeleton className="h-8 w-3/5" />
                </div>
              </Specimen>
              <Specimen name="Empty state" className="p-0">
                <EmptyState
                  title="No alerts in scope"
                  description="Every asset here is reporting within its configured limits."
                />
              </Specimen>
              <Specimen name="Error state" className="p-0">
                <ErrorState
                  title="Ambient conditions unavailable"
                  description="Open-Meteo did not respond. Cached values are shown where available."
                />
              </Specimen>
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}
