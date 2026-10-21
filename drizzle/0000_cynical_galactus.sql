CREATE TABLE `deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`subscription` text NOT NULL,
	`notification` text NOT NULL,
	`status` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`error` text,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`task` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`size` integer NOT NULL,
	`uploader` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`task` text NOT NULL,
	`actor` text NOT NULL,
	`message` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`department` text DEFAULT 'General' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_email_unique` ON `members` (`email`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`recipient` text NOT NULL,
	`task` text,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`created` text NOT NULL,
	`read` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notice_recipient` ON `notifications` (`recipient`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`recipient` text NOT NULL,
	`data` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`assignee` text NOT NULL,
	`creator` text NOT NULL,
	`due` text NOT NULL,
	`priority` text NOT NULL,
	`status` text NOT NULL,
	`frequency` text NOT NULL,
	`required` integer NOT NULL,
	`approval` integer NOT NULL,
	`parent` text,
	`created` text NOT NULL,
	`submitted` text,
	`completed` text,
	`note` text DEFAULT '' NOT NULL,
	`next_created` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `task_assignee` ON `tasks` (`assignee`);--> statement-breakpoint
CREATE INDEX `task_due` ON `tasks` (`due`);