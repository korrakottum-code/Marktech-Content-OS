import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const clients = sqliteTable(
  "clients",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    clientCode: text("client_code").notNull(),
    name: text("name").notNull(),
    serviceScope: text("service_scope").notNull().default("ads_only"),
    contractStatus: text("contract_status").notNull().default("active"),
    mondayClientItemId: text("monday_client_item_id"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("clients_client_code_idx").on(table.clientCode)],
);

export const contentItems = sqliteTable(
  "content_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    contentId: text("content_id").notNull(),
    clientId: integer("client_id").references(() => clients.id),
    title: text("title").notNull(),
    status: text("status").notNull().default("draft"),
    sourceType: text("source_type").notNull().default("webapp"),
    format: text("format"),
    serviceGroup: text("service_group"),
    program: text("program"),
    concern: text("concern"),
    packageName: text("package_name"),
    pillar: text("pillar"),
    funnelStage: text("funnel_stage"),
    hook: text("hook"),
    rationale: text("rationale"),
    duplicateFingerprint: text("duplicate_fingerprint"),
    mondayItemId: text("monday_item_id"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("content_items_content_id_idx").on(table.contentId),
    index("content_items_client_idx").on(table.clientId),
    index("content_items_status_idx").on(table.status),
  ],
);

export const mondayBoardMappings = sqliteTable(
  "monday_board_mappings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    boardId: text("board_id").notNull(),
    boardName: text("board_name").notNull(),
    defaultGroupId: text("default_group_id"),
    clientColumnId: text("client_column_id"),
    formatColumnId: text("format_column_id"),
    dateColumnId: text("date_column_id"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("monday_board_mappings_board_id_idx").on(table.boardId)],
);

export const mappingIssues = sqliteTable(
  "mapping_issues",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    entityType: text("entity_type").notNull(),
    rawValue: text("raw_value").notNull(),
    sourceItemId: text("source_item_id"),
    suggestedValue: text("suggested_value"),
    status: text("status").notNull().default("open"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    resolvedAt: text("resolved_at"),
  },
  (table) => [index("mapping_issues_status_idx").on(table.status)],
);

export const metaAdAccounts = sqliteTable(
  "meta_ad_accounts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    clientId: integer("client_id").references(() => clients.id),
    metaAccountId: text("meta_account_id").notNull(),
    accountName: text("account_name").notNull(),
    deliveryStatus: text("delivery_status").notNull().default("unknown"),
    lastSyncedAt: text("last_synced_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("meta_ad_accounts_account_id_idx").on(table.metaAccountId)],
);

export const performanceSnapshots = sqliteTable(
  "performance_snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    metaAdAccountId: integer("meta_ad_account_id").references(() => metaAdAccounts.id),
    contentItemId: integer("content_item_id").references(() => contentItems.id),
    metaAdId: text("meta_ad_id"),
    snapshotDate: text("snapshot_date").notNull(),
    // Stored in satang; this application's initial reporting currency is THB.
    spend: integer("spend").notNull().default(0),
    inboxCount: integer("inbox_count").notNull().default(0),
    leadCount: integer("lead_count").notNull().default(0),
    sourcePayload: text("source_payload"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("performance_snapshots_ad_date_idx").on(table.metaAdId, table.snapshotDate),
    index("performance_snapshots_content_date_idx").on(table.contentItemId, table.snapshotDate),
  ],
);

export const leadRecords = sqliteTable(
  "lead_records",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    clientId: integer("client_id").references(() => clients.id),
    metaAdId: text("meta_ad_id"),
    externalLeadId: text("external_lead_id"),
    source: text("source").notNull(),
    pipelineStatus: text("pipeline_status").notNull().default("new"),
    appointmentAt: text("appointment_at"),
    closedRevenue: integer("closed_revenue").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("lead_records_client_status_idx").on(table.clientId, table.pipelineStatus),
    uniqueIndex("lead_records_external_lead_idx").on(table.externalLeadId),
  ],
);
