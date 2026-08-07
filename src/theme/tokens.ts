import type { AlertSeverity, AssetStatus, Metric } from "@shared/types";

/**
 * Runtime access to the design tokens.
 *
 * CSS owns the values (see `src/styles/tokens.css`). Consumers that cannot use a
 * CSS custom property directly — WebGL materials, canvas-based charts — read the
 * computed value from the document instead of redeclaring the colour, so there
 * is exactly one definition of every token in the codebase.
 */

const cache = new Map<string, string>();

export function readToken(name: string): string {
  const cached = cache.get(name);
  if (cached !== undefined) return cached;
  if (typeof window === "undefined") return "";
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  cache.set(name, value);
  return value;
}

/** Clears memoised values — call after swapping the theme at runtime. */
export function invalidateTokenCache(): void {
  cache.clear();
}

/* -------------------------------------------------------------------------- */
/* Token → domain maps                                                        */
/* -------------------------------------------------------------------------- */

export const STATUS_TOKEN: Record<AssetStatus, string> = {
  ok: "--sig-status-ok",
  warning: "--sig-status-warning",
  critical: "--sig-status-critical",
};

export const SEVERITY_TOKEN: Record<AlertSeverity, string> = {
  info: "--sig-status-info",
  warning: "--sig-status-warning",
  critical: "--sig-status-critical",
};

export const METRIC_TOKEN: Record<Metric, string> = {
  temperature: "--sig-metric-temperature",
  vibration: "--sig-metric-vibration",
  humidity: "--sig-metric-humidity",
};

export const CHART_TOKENS = [
  "--sig-chart-1",
  "--sig-chart-2",
  "--sig-chart-3",
  "--sig-chart-4",
  "--sig-chart-5",
  "--sig-chart-6",
] as const;

export function statusColor(status: AssetStatus): string {
  return readToken(STATUS_TOKEN[status]);
}

export function metricColor(metric: Metric): string {
  return readToken(METRIC_TOKEN[metric]);
}

export function chartColor(index: number): string {
  const token = CHART_TOKENS[index % CHART_TOKENS.length];
  return token ? readToken(token) : readToken("--sig-chart-1");
}

/* -------------------------------------------------------------------------- */
/* Catalogue — drives /design-system                                          */
/* -------------------------------------------------------------------------- */

export interface TokenEntry {
  name: string;
  description: string;
}

export interface TokenGroup {
  title: string;
  blurb: string;
  layer: "primitive" | "semantic" | "component";
  tokens: TokenEntry[];
}

export const COLOR_TOKEN_GROUPS: TokenGroup[] = [
  {
    title: "Graphite ramp",
    blurb: "The raw substrate. Primitives are never referenced by a component directly.",
    layer: "primitive",
    tokens: [
      { name: "--sig-graphite-1000", description: "Deepest well — scene background" },
      { name: "--sig-graphite-950", description: "App background" },
      { name: "--sig-graphite-900", description: "Overlay background" },
      { name: "--sig-graphite-850", description: "Panel background" },
      { name: "--sig-graphite-800", description: "Elevated panel" },
      { name: "--sig-graphite-700", description: "Hover fill / faint line" },
      { name: "--sig-graphite-600", description: "Default border" },
      { name: "--sig-graphite-500", description: "Strong border" },
      { name: "--sig-graphite-400", description: "Faint ink" },
      { name: "--sig-graphite-300", description: "Muted ink" },
      { name: "--sig-graphite-200", description: "Soft ink" },
      { name: "--sig-graphite-50", description: "Primary ink" },
    ],
  },
  {
    title: "Surfaces",
    blurb: "Stacking order of the interface, from the page floor up to modals.",
    layer: "semantic",
    tokens: [
      { name: "--sig-surface-sunken", description: "Recessed wells, code blocks, scene canvas" },
      { name: "--sig-surface-base", description: "Page background" },
      { name: "--sig-surface-raised", description: "Cards, panels, table shells" },
      { name: "--sig-surface-elevated", description: "Nested surfaces inside a panel" },
      { name: "--sig-surface-overlay", description: "Popovers, dropdowns, dialogs" },
      { name: "--sig-surface-hover", description: "Row and control hover fill" },
    ],
  },
  {
    title: "Ink & lines",
    blurb: "Four ink levels carry the whole hierarchy. Body ink holds ≥ 7:1 on every surface.",
    layer: "semantic",
    tokens: [
      { name: "--sig-ink", description: "Headings and primary values" },
      { name: "--sig-ink-soft", description: "Body copy" },
      { name: "--sig-ink-muted", description: "Labels, captions, axis text" },
      { name: "--sig-ink-faint", description: "Disabled and placeholder" },
      { name: "--sig-line-faint", description: "Internal dividers" },
      { name: "--sig-line", description: "Default border" },
      { name: "--sig-line-strong", description: "Emphasised border, scrollbar thumb" },
    ],
  },
  {
    title: "Brand",
    blurb: "Cyan is reserved for interaction and identity — never for status.",
    layer: "semantic",
    tokens: [
      { name: "--sig-brand", description: "Primary action, links, focus" },
      { name: "--sig-brand-strong", description: "Hover state" },
      { name: "--sig-brand-deep", description: "Active/pressed state" },
      { name: "--sig-brand-contrast", description: "Ink on a brand fill" },
      { name: "--sig-brand-wash", description: "Tinted background for selected state" },
    ],
  },
  {
    title: "Status",
    blurb:
      "Status hues are load-bearing: they map 1:1 to asset status and alert severity, in the table, the charts and the 3D scene.",
    layer: "semantic",
    tokens: [
      { name: "--sig-status-ok", description: "Operating within limits" },
      { name: "--sig-status-warning", description: "Trending out of band" },
      { name: "--sig-status-critical", description: "Immediate attention" },
      { name: "--sig-status-info", description: "Informational alerts" },
      { name: "--sig-status-ok-wash", description: "Badge and row fill" },
      { name: "--sig-status-warning-wash", description: "Badge and row fill" },
      { name: "--sig-status-critical-wash", description: "Badge and row fill" },
      { name: "--sig-status-info-wash", description: "Badge and row fill" },
    ],
  },
  {
    title: "Data visualisation",
    blurb:
      "Six series colours ordered for maximum separation on a dark ground, plus one fixed hue per physical quantity.",
    layer: "semantic",
    tokens: [
      { name: "--sig-chart-1", description: "Series 1" },
      { name: "--sig-chart-2", description: "Series 2" },
      { name: "--sig-chart-3", description: "Series 3" },
      { name: "--sig-chart-4", description: "Series 4" },
      { name: "--sig-chart-5", description: "Series 5" },
      { name: "--sig-chart-6", description: "Series 6" },
      { name: "--sig-metric-temperature", description: "Temperature, everywhere" },
      { name: "--sig-metric-vibration", description: "Vibration, everywhere" },
      { name: "--sig-metric-humidity", description: "Humidity, everywhere" },
    ],
  },
];

export const TYPE_SCALE: { name: string; token: string; usage: string }[] = [
  { name: "2xs", token: "--sig-text-2xs", usage: "Axis ticks, table meta" },
  { name: "xs", token: "--sig-text-xs", usage: "Badges, overline labels" },
  { name: "sm", token: "--sig-text-sm", usage: "Dense table body" },
  { name: "base", token: "--sig-text-base", usage: "Body copy — document default" },
  { name: "md", token: "--sig-text-md", usage: "Emphasised body" },
  { name: "lg", token: "--sig-text-lg", usage: "Card titles" },
  { name: "xl", token: "--sig-text-xl", usage: "Section headings" },
  { name: "2xl", token: "--sig-text-2xl", usage: "Page title" },
  { name: "3xl", token: "--sig-text-3xl", usage: "KPI figure" },
  { name: "4xl", token: "--sig-text-4xl", usage: "Hero figure" },
];

export const SPACE_SCALE: { name: string; token: string }[] = [
  { name: "1", token: "--sig-space-1" },
  { name: "2", token: "--sig-space-2" },
  { name: "3", token: "--sig-space-3" },
  { name: "4", token: "--sig-space-4" },
  { name: "5", token: "--sig-space-5" },
  { name: "6", token: "--sig-space-6" },
  { name: "8", token: "--sig-space-8" },
  { name: "10", token: "--sig-space-10" },
  { name: "12", token: "--sig-space-12" },
  { name: "16", token: "--sig-space-16" },
  { name: "20", token: "--sig-space-20" },
];

export const RADIUS_SCALE: { name: string; token: string }[] = [
  { name: "xs", token: "--sig-radius-xs" },
  { name: "sm", token: "--sig-radius-sm" },
  { name: "md", token: "--sig-radius-md" },
  { name: "lg", token: "--sig-radius-lg" },
  { name: "xl", token: "--sig-radius-xl" },
  { name: "full", token: "--sig-radius-full" },
];

export const ELEVATION_SCALE: { name: string; token: string; usage: string }[] = [
  { name: "sm", token: "--sig-shadow-sm", usage: "Inputs, inline controls" },
  { name: "md", token: "--sig-shadow-md", usage: "Panels and cards" },
  { name: "lg", token: "--sig-shadow-lg", usage: "Dialogs and popovers" },
];

export const MOTION_SCALE: { name: string; token: string; usage: string }[] = [
  { name: "instant", token: "--sig-duration-instant", usage: "Colour and opacity swaps" },
  { name: "fast", token: "--sig-duration-fast", usage: "Hover and focus" },
  { name: "base", token: "--sig-duration-base", usage: "Panel and popover entry" },
  { name: "slow", token: "--sig-duration-slow", usage: "Route transitions, chart reveal" },
];
