CREATE TABLE `pending_period_reconciliations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`importBatchId` int NOT NULL,
	`employeeId` int,
	`sourceRowNumber` int NOT NULL,
	`sourceCycleReference` varchar(120),
	`sourceStartDate` date NOT NULL,
	`sourceEndDate` date NOT NULL,
	`calendarDays` int NOT NULL,
	`sourceStatus` enum('draft','requested','approved','rejected','cancelled','completed') NOT NULL,
	`rawData` json,
	`status` enum('pending','resolved','dismissed') NOT NULL DEFAULT 'pending',
	`resolvedVacationPeriodId` int,
	`resolutionNote` text,
	`resolvedByUserId` int,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pending_period_reconciliations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `pending_period_reconciliations` ADD CONSTRAINT `ppr_batch_fk` FOREIGN KEY (`importBatchId`) REFERENCES `import_batches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pending_period_reconciliations` ADD CONSTRAINT `ppr_employee_fk` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pending_period_reconciliations` ADD CONSTRAINT `ppr_period_fk` FOREIGN KEY (`resolvedVacationPeriodId`) REFERENCES `vacation_periods`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pending_period_reconciliations` ADD CONSTRAINT `ppr_resolver_fk` FOREIGN KEY (`resolvedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `pending_period_reconciliations_batch_idx` ON `pending_period_reconciliations` (`importBatchId`,`status`);--> statement-breakpoint
CREATE INDEX `pending_period_reconciliations_employee_idx` ON `pending_period_reconciliations` (`employeeId`);
