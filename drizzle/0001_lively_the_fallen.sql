CREATE TABLE `alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`category` enum('expiration_soon','expiration_overdue','pending_request','negative_balance','conflict','data_quality','job_failure') NOT NULL,
	`severity` enum('info','warning','high','critical') NOT NULL DEFAULT 'warning',
	`status` enum('open','acknowledged','resolved','dismissed') NOT NULL DEFAULT 'open',
	`employeeId` int,
	`vacationCycleId` int,
	`vacationPeriodId` int,
	`title` varchar(240) NOT NULL,
	`description` text,
	`detectedAt` timestamp NOT NULL DEFAULT (now()),
	`acknowledgedAt` timestamp,
	`resolvedAt` timestamp,
	`handledByUserId` int,
	`handlingNote` text,
	CONSTRAINT `alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `approval_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vacationPeriodId` int NOT NULL,
	`previousStatus` enum('draft','requested','approved','rejected','cancelled','completed'),
	`nextStatus` enum('draft','requested','approved','rejected','cancelled','completed') NOT NULL,
	`comment` text,
	`changedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `approval_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityType` varchar(80) NOT NULL,
	`entityId` int NOT NULL,
	`action` varchar(80) NOT NULL,
	`beforeData` json,
	`afterData` json,
	`actorUserId` int,
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`code` varchar(24),
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bases_id` PRIMARY KEY(`id`),
	CONSTRAINT `bases_name_unique` UNIQUE(`name`),
	CONSTRAINT `bases_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `employees` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeCode` varchar(64),
	`fullName` varchar(180) NOT NULL,
	`displayName` varchar(100),
	`email` varchar(320),
	`admissionDate` date,
	`jobRoleId` int,
	`operationalGroupId` int,
	`baseId` int,
	`active` boolean NOT NULL DEFAULT true,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `employees_id` PRIMARY KEY(`id`),
	CONSTRAINT `employees_employeeCode_unique` UNIQUE(`employeeCode`)
);
--> statement-breakpoint
CREATE TABLE `job_execution_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobName` varchar(120) NOT NULL,
	`status` enum('running','success','partial','failed') NOT NULL,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`recordsProcessed` int NOT NULL DEFAULT 0,
	`alertsCreated` int NOT NULL DEFAULT 0,
	`alertsUpdated` int NOT NULL DEFAULT 0,
	`notificationsSent` int NOT NULL DEFAULT 0,
	`errorSummary` text,
	CONSTRAINT `job_execution_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `job_roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `job_roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `job_roles_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `operational_groups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operational_groups_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_groups_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `operational_restrictions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`operationalGroupId` int,
	`jobRoleId` int,
	`baseId` int,
	`startDate` date NOT NULL,
	`endDate` date NOT NULL,
	`reason` varchar(240) NOT NULL,
	`blocksApproval` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operational_restrictions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vacation_cycles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeId` int NOT NULL,
	`reference` varchar(32) NOT NULL,
	`accrualStartDate` date,
	`accrualEndDate` date,
	`expirationDate` date NOT NULL,
	`entitledDays` int NOT NULL DEFAULT 30,
	`soldDays` int NOT NULL DEFAULT 0,
	`adjustmentDays` int NOT NULL DEFAULT 0,
	`exceptionJustification` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vacation_cycles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vacation_periods` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeId` int NOT NULL,
	`vacationCycleId` int NOT NULL,
	`startDate` date NOT NULL,
	`endDate` date NOT NULL,
	`calendarDays` int NOT NULL,
	`status` enum('draft','requested','approved','rejected','cancelled','completed') NOT NULL DEFAULT 'draft',
	`exceptionJustification` text,
	`requestedByUserId` int,
	`approvedByUserId` int,
	`decisionAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vacation_periods_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','planner','approver','admin') NOT NULL DEFAULT 'user';--> statement-breakpoint
CREATE INDEX `alerts_status_idx` ON `alerts` (`status`);--> statement-breakpoint
CREATE INDEX `alerts_category_idx` ON `alerts` (`category`);--> statement-breakpoint
CREATE INDEX `approval_history_period_idx` ON `approval_history` (`vacationPeriodId`);--> statement-breakpoint
CREATE INDEX `audit_logs_entity_idx` ON `audit_logs` (`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `employees_active_idx` ON `employees` (`active`);--> statement-breakpoint
CREATE INDEX `employees_full_name_idx` ON `employees` (`fullName`);--> statement-breakpoint
CREATE INDEX `job_execution_logs_name_idx` ON `job_execution_logs` (`jobName`,`startedAt`);--> statement-breakpoint
CREATE INDEX `vacation_cycles_employee_idx` ON `vacation_cycles` (`employeeId`);--> statement-breakpoint
CREATE INDEX `vacation_cycles_expiration_idx` ON `vacation_cycles` (`expirationDate`);--> statement-breakpoint
CREATE INDEX `vacation_periods_employee_idx` ON `vacation_periods` (`employeeId`);--> statement-breakpoint
CREATE INDEX `vacation_periods_cycle_idx` ON `vacation_periods` (`vacationCycleId`);--> statement-breakpoint
CREATE INDEX `vacation_periods_dates_idx` ON `vacation_periods` (`startDate`,`endDate`);--> statement-breakpoint
CREATE INDEX `vacation_periods_status_idx` ON `vacation_periods` (`status`);