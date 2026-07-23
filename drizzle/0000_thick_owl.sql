CREATE TABLE `clients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_code` text NOT NULL,
	`name` text NOT NULL,
	`service_scope` text DEFAULT 'ads_only' NOT NULL,
	`contract_status` text DEFAULT 'active' NOT NULL,
	`monday_client_item_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clients_client_code_idx` ON `clients` (`client_code`);--> statement-breakpoint
CREATE TABLE `content_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`content_id` text NOT NULL,
	`client_id` integer,
	`title` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`source_type` text DEFAULT 'webapp' NOT NULL,
	`format` text,
	`service_group` text,
	`program` text,
	`concern` text,
	`package_name` text,
	`pillar` text,
	`funnel_stage` text,
	`hook` text,
	`rationale` text,
	`duplicate_fingerprint` text,
	`monday_item_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_items_content_id_idx` ON `content_items` (`content_id`);--> statement-breakpoint
CREATE INDEX `content_items_client_idx` ON `content_items` (`client_id`);--> statement-breakpoint
CREATE INDEX `content_items_status_idx` ON `content_items` (`status`);--> statement-breakpoint
CREATE TABLE `lead_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer,
	`meta_ad_id` text,
	`external_lead_id` text,
	`source` text NOT NULL,
	`pipeline_status` text DEFAULT 'new' NOT NULL,
	`appointment_at` text,
	`closed_revenue` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `lead_records_client_status_idx` ON `lead_records` (`client_id`,`pipeline_status`);--> statement-breakpoint
CREATE UNIQUE INDEX `lead_records_external_lead_idx` ON `lead_records` (`external_lead_id`);--> statement-breakpoint
CREATE TABLE `mapping_issues` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity_type` text NOT NULL,
	`raw_value` text NOT NULL,
	`source_item_id` text,
	`suggested_value` text,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`resolved_at` text
);
--> statement-breakpoint
CREATE INDEX `mapping_issues_status_idx` ON `mapping_issues` (`status`);--> statement-breakpoint
CREATE TABLE `meta_ad_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer,
	`meta_account_id` text NOT NULL,
	`account_name` text NOT NULL,
	`delivery_status` text DEFAULT 'unknown' NOT NULL,
	`last_synced_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `meta_ad_accounts_account_id_idx` ON `meta_ad_accounts` (`meta_account_id`);--> statement-breakpoint
CREATE TABLE `monday_board_mappings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`board_id` text NOT NULL,
	`board_name` text NOT NULL,
	`default_group_id` text,
	`client_column_id` text,
	`format_column_id` text,
	`date_column_id` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `monday_board_mappings_board_id_idx` ON `monday_board_mappings` (`board_id`);--> statement-breakpoint
CREATE TABLE `performance_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`meta_ad_account_id` integer,
	`content_item_id` integer,
	`meta_ad_id` text,
	`snapshot_date` text NOT NULL,
	`spend` integer DEFAULT 0 NOT NULL,
	`inbox_count` integer DEFAULT 0 NOT NULL,
	`lead_count` integer DEFAULT 0 NOT NULL,
	`source_payload` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`meta_ad_account_id`) REFERENCES `meta_ad_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`content_item_id`) REFERENCES `content_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `performance_snapshots_ad_date_idx` ON `performance_snapshots` (`meta_ad_id`,`snapshot_date`);--> statement-breakpoint
CREATE INDEX `performance_snapshots_content_date_idx` ON `performance_snapshots` (`content_item_id`,`snapshot_date`);