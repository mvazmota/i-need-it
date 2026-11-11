CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`image_url` text,
	`site` text DEFAULT '' NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`current_price_cents` integer,
	`target_price_cents` integer,
	`lowest_price_cents` integer,
	`notified_low_cents` integer,
	`category` text,
	`notes` text,
	`status` text DEFAULT 'watching' NOT NULL,
	`check_interval_hours` integer DEFAULT 6 NOT NULL,
	`price_selector` text,
	`title_selector` text,
	`image_selector` text,
	`last_checked_at` integer,
	`last_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `items_status_idx` ON `items` (`status`);--> statement-breakpoint
CREATE INDEX `items_last_checked_idx` ON `items` (`last_checked_at`);--> statement-breakpoint
CREATE TABLE `price_points` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` text NOT NULL,
	`price_cents` integer NOT NULL,
	`currency` text NOT NULL,
	`availability` text,
	`source` text DEFAULT 'auto' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `price_points_item_created_idx` ON `price_points` (`item_id`,`created_at`);