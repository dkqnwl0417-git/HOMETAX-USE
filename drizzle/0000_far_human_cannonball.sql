CREATE TABLE `hometaxNotices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`date` text NOT NULL,
	`taxType` text DEFAULT '기타' NOT NULL,
	`docType` text NOT NULL,
	`viewCount` integer DEFAULT 0 NOT NULL,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hometaxNotices_url_unique` ON `hometaxNotices` (`url`);--> statement-breakpoint
CREATE INDEX `idx_hometax_date` ON `hometaxNotices` (`date`);--> statement-breakpoint
CREATE INDEX `idx_hometax_taxType` ON `hometaxNotices` (`taxType`);--> statement-breakpoint
CREATE TABLE `manualFiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`fileUrl` text NOT NULL,
	`fileType` text NOT NULL,
	`uploader` text NOT NULL,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`noticeId` integer NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`isRead` integer DEFAULT 0 NOT NULL,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`openId` text NOT NULL,
	`name` text,
	`email` text,
	`loginMethod` text,
	`role` text DEFAULT 'user' NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`lastSignedIn` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_openId_unique` ON `users` (`openId`);