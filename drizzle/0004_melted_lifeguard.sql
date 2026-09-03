CREATE TABLE `job_schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`scheduleCronTaskUid` varchar(65),
	`cronExpression` varchar(64) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `job_schedules_id` PRIMARY KEY(`id`),
	CONSTRAINT `job_schedules_name_unique` UNIQUE(`name`),
	CONSTRAINT `job_schedules_scheduleCronTaskUid_unique` UNIQUE(`scheduleCronTaskUid`)
);
--> statement-breakpoint
ALTER TABLE `alerts` ADD `dedupeKey` varchar(255);--> statement-breakpoint
UPDATE `alerts` SET `dedupeKey` = CONCAT('legacy-', `id`) WHERE `dedupeKey` IS NULL;--> statement-breakpoint
ALTER TABLE `alerts` MODIFY `dedupeKey` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `alerts` ADD CONSTRAINT `alerts_dedupeKey_unique` UNIQUE(`dedupeKey`);--> statement-breakpoint
ALTER TABLE `job_schedules` ADD CONSTRAINT `job_schedules_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `job_schedules_task_uid_idx` ON `job_schedules` (`scheduleCronTaskUid`);
