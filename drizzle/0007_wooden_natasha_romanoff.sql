CREATE TABLE `email_deliveries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`alertId` int,
	`recipientId` int NOT NULL,
	`notificationType` enum('alert','test') NOT NULL,
	`subject` varchar(255) NOT NULL,
	`status` enum('pending','sent','failed','skipped') NOT NULL DEFAULT 'pending',
	`resendEmailId` varchar(100),
	`idempotencyKey` varchar(255) NOT NULL,
	`errorSummary` text,
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_deliveries_id` PRIMARY KEY(`id`),
	CONSTRAINT `email_deliveries_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `notification_recipients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`name` varchar(160),
	`active` boolean NOT NULL DEFAULT true,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notification_recipients_id` PRIMARY KEY(`id`),
	CONSTRAINT `notification_recipients_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `email_deliveries` ADD CONSTRAINT `email_deliveries_alertId_alerts_id_fk` FOREIGN KEY (`alertId`) REFERENCES `alerts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `email_deliveries` ADD CONSTRAINT `email_deliveries_recipientId_notification_recipients_id_fk` FOREIGN KEY (`recipientId`) REFERENCES `notification_recipients`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notification_recipients` ADD CONSTRAINT `notification_recipients_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `email_deliveries_recipient_idx` ON `email_deliveries` (`recipientId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `email_deliveries_alert_idx` ON `email_deliveries` (`alertId`);