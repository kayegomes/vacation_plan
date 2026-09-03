CREATE TABLE `import_batches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`originalFilename` varchar(255) NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`storageUrl` varchar(768) NOT NULL,
	`sourceSheetName` varchar(180),
	`status` enum('reviewed','published','failed') NOT NULL DEFAULT 'reviewed',
	`totalRows` int NOT NULL DEFAULT 0,
	`acceptedRows` int NOT NULL DEFAULT 0,
	`warningRows` int NOT NULL DEFAULT 0,
	`errorRows` int NOT NULL DEFAULT 0,
	`summary` json,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`publishedAt` timestamp,
	CONSTRAINT `import_batches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `import_issues` (
	`id` int AUTO_INCREMENT NOT NULL,
	`importBatchId` int NOT NULL,
	`rowNumber` int,
	`entityType` varchar(80) NOT NULL,
	`severity` enum('warning','error') NOT NULL,
	`field` varchar(100),
	`message` text NOT NULL,
	`rawData` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `import_issues_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `import_batches` ADD CONSTRAINT `import_batches_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `import_issues` ADD CONSTRAINT `import_issues_importBatchId_import_batches_id_fk` FOREIGN KEY (`importBatchId`) REFERENCES `import_batches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `import_batches_status_idx` ON `import_batches` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `import_issues_batch_idx` ON `import_issues` (`importBatchId`);--> statement-breakpoint
CREATE INDEX `import_issues_severity_idx` ON `import_issues` (`severity`);