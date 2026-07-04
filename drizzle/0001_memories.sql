CREATE TABLE `memories` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`byline` text,
	`site_name` text,
	`content` text NOT NULL,
	`tags` text,
	`captured_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `memories_user_url_unique` ON `memories` (`user_id`,`url`);--> statement-breakpoint
CREATE INDEX `memories_user_created_idx` ON `memories` (`user_id`,`created_at`);