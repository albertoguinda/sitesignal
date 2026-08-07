import {
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  real,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
// Relative rather than aliased: drizzle-kit bundles this file with its own
// resolver, which does not read the tsconfig path map.
import { ALERT_SEVERITIES, ALERT_STATES, ASSET_STATUSES } from "../../shared/types";

export const assetStatusEnum = pgEnum("asset_status", ASSET_STATUSES);
export const alertSeverityEnum = pgEnum("alert_severity", ALERT_SEVERITIES);
export const alertStateEnum = pgEnum("alert_state", ALERT_STATES);

export const sites = pgTable("sites", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  timezone: text("timezone").notNull(),
});

export const assets = pgTable(
  "assets",
  {
    id: serial("id").primaryKey(),
    siteId: integer("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull(),
    status: assetStatusEnum("status").notNull().default("ok"),
    posX: real("pos_x").notNull().default(0),
    posY: real("pos_y").notNull().default(0),
    posZ: real("pos_z").notNull().default(0),
    installedAt: timestamp("installed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("assets_site_id_idx").on(table.siteId)],
);

export const readings = pgTable(
  "readings",
  {
    id: serial("id").primaryKey(),
    assetId: integer("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    metric: text("metric").notNull(),
    value: real("value").notNull(),
    unit: text("unit").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Every time-series query filters asset + metric and orders by time; this
    // composite index is what keeps the 60-day window responsive.
    index("readings_asset_metric_time_idx").on(table.assetId, table.metric, table.recordedAt),
    index("readings_time_idx").on(table.recordedAt),
  ],
);

export const alerts = pgTable(
  "alerts",
  {
    id: serial("id").primaryKey(),
    assetId: integer("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    severity: alertSeverityEnum("severity").notNull(),
    message: text("message").notNull(),
    state: alertStateEnum("state").notNull().default("open"),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("alerts_asset_id_idx").on(table.assetId),
    index("alerts_state_idx").on(table.state),
  ],
);

export const sitesRelations = relations(sites, ({ many }) => ({
  assets: many(assets),
}));

export const assetsRelations = relations(assets, ({ one, many }) => ({
  site: one(sites, { fields: [assets.siteId], references: [sites.id] }),
  readings: many(readings),
  alerts: many(alerts),
}));

export const readingsRelations = relations(readings, ({ one }) => ({
  asset: one(assets, { fields: [readings.assetId], references: [assets.id] }),
}));

export const alertsRelations = relations(alerts, ({ one }) => ({
  asset: one(assets, { fields: [alerts.assetId], references: [assets.id] }),
}));

export const schema = { sites, assets, readings, alerts };
