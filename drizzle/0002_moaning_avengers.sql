CREATE TABLE `plan_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`client_name` text NOT NULL,
	`plan_month` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`payload` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `plan_drafts_updated_idx` ON `plan_drafts` (`updated_at`);--> statement-breakpoint
CREATE INDEX `plan_drafts_client_month_idx` ON `plan_drafts` (`client_name`,`plan_month`);