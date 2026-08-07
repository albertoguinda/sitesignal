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
  uniqueIndex,
  uuid,
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
  organizationId: uuid("organization_id")
    .references(() => organizations.id, { onDelete: "cascade" }),
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

// ============================================================================
// AUTHENTICATION TABLES
// ============================================================================

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    name: text("name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_email_idx").on(table.email)],
);

export const magicLinks = pgTable(
  "magic_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    email: text("email").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("magic_links_token_idx").on(table.token),
    index("magic_links_user_id_idx").on(table.userId),
    index("magic_links_email_idx").on(table.email),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("sessions_token_idx").on(table.token),
    index("sessions_user_id_idx").on(table.userId),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  magicLinks: many(magicLinks),
  sessions: many(sessions),
}));

export const magicLinksRelations = relations(magicLinks, ({ one }) => ({
  user: one(users, { fields: [magicLinks.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

// ============================================================================
// MULTI-TENANCY TABLES
// ============================================================================

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    logoUrl: text("logo_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("organizations_slug_idx").on(table.slug),
  ],
);

export const organizationMembers = pgTable(
  "organization_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"), // admin, member, viewer
    invitedAt: timestamp("invited_at", { withTimezone: true }).defaultNow(),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("organization_members_org_user_idx").on(
      table.organizationId,
      table.userId,
    ),
    index("organization_members_user_id_idx").on(table.userId),
  ],
);

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(organizationMembers),
  sites: many(sites),
}));

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationMembers.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [organizationMembers.userId],
    references: [users.id],
  }),
}));

export const schema = {
  sites,
  assets,
  readings,
  alerts,
  users,
  magicLinks,
  sessions,
  organizations,
  organizationMembers,
};
