CREATE TABLE `hometaxNotices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(512) NOT NULL,
	`url` varchar(1024) NOT NULL,
	`date` varchar(20) NOT NULL,
	`taxType` enum('부가가치세','종합소득세','원천세','기타') NOT NULL DEFAULT '기타',
	`docType` enum('파일설명서','전산매체 제출요령') NOT NULL,
	`viewCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `hometaxNotices_id` PRIMARY KEY(`id`),
	CONSTRAINT `hometaxNotices_url_unique` UNIQUE(`url`)
);
--> statement-breakpoint
CREATE TABLE `manualFiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(512) NOT NULL,
	`fileUrl` varchar(1024) NOT NULL,
	`fileType` varchar(32) NOT NULL,
	`uploader` varchar(128) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `manualFiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`noticeId` int NOT NULL,
	`title` varchar(512) NOT NULL,
	`url` varchar(1024) NOT NULL,
	`isRead` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_hometax_date` ON `hometaxNotices` (`date`);--> statement-breakpoint
CREATE INDEX `idx_hometax_taxType` ON `hometaxNotices` (`taxType`);