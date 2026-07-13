CREATE TABLE `rss_feeds` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`feed_url` text NOT NULL,
	`title` text NOT NULL,
	`site_url` text,
	`last_fetched_at` integer,
	`last_error` text,
	`etag` text,
	`last_modified` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rss_feeds_user_feed_unique` ON `rss_feeds` (`user_id`,`feed_url`);--> statement-breakpoint
CREATE INDEX `rss_feeds_user_created_idx` ON `rss_feeds` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `rss_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`feed_id` text NOT NULL,
	`external_id` text NOT NULL,
	`url` text,
	`title` text NOT NULL,
	`author` text,
	`content` text,
	`excerpt` text,
	`published_at` integer,
	`read_at` integer,
	`saved_article_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`feed_id`) REFERENCES `rss_feeds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`saved_article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rss_entries_feed_external_unique` ON `rss_entries` (`feed_id`,`external_id`);--> statement-breakpoint
CREATE INDEX `rss_entries_feed_published_idx` ON `rss_entries` (`feed_id`,`published_at`);--> statement-breakpoint
CREATE INDEX `rss_entries_feed_read_idx` ON `rss_entries` (`feed_id`,`read_at`);
