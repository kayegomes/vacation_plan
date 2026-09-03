import { boolean, date, index, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Identificador de identidade existente, preservado durante a migração para contas internas. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  loginMethod: varchar("loginMethod", { length: 64 }),
  internalAuthEnabled: boolean("internalAuthEnabled").notNull().default(false),
  accountActive: boolean("accountActive").notNull().default(true),
  passwordHash: varchar("passwordHash", { length: 255 }),
  passwordUpdatedAt: timestamp("passwordUpdatedAt"),
  role: mysqlEnum("role", ["user", "planner", "approver", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const internalAuthTokens = mysqlTable("internal_auth_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  purpose: mysqlEnum("purpose", ["invite", "password_reset"]).notNull(),
  tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  consumedAt: timestamp("consumedAt"),
  createdByUserId: int("createdByUserId").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  index("internal_auth_tokens_user_idx").on(table.userId, table.purpose),
  index("internal_auth_tokens_expiry_idx").on(table.expiresAt),
]);

export const jobRoles = mysqlTable("job_roles", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull().unique(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const operationalGroups = mysqlTable("operational_groups", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull().unique(),
  description: text("description"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const bases = mysqlTable("bases", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull().unique(),
  code: varchar("code", { length: 24 }).unique(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const employees = mysqlTable("employees", {
  id: int("id").autoincrement().primaryKey(),
  employeeCode: varchar("employeeCode", { length: 64 }).unique(),
  fullName: varchar("fullName", { length: 180 }).notNull(),
  displayName: varchar("displayName", { length: 100 }),
  email: varchar("email", { length: 320 }),
  admissionDate: date("admissionDate"),
  jobRoleId: int("jobRoleId").references(() => jobRoles.id),
  operationalGroupId: int("operationalGroupId").references(() => operationalGroups.id),
  baseId: int("baseId").references(() => bases.id),
  active: boolean("active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  index("employees_active_idx").on(table.active),
  index("employees_full_name_idx").on(table.fullName),
]);

export const vacationCycles = mysqlTable("vacation_cycles", {
  id: int("id").autoincrement().primaryKey(),
  employeeId: int("employeeId").notNull().references(() => employees.id),
  reference: varchar("reference", { length: 32 }).notNull(),
  accrualStartDate: date("accrualStartDate"),
  accrualEndDate: date("accrualEndDate"),
  expirationDate: date("expirationDate").notNull(),
  entitledDays: int("entitledDays").notNull().default(30),
  soldDays: int("soldDays").notNull().default(0),
  adjustmentDays: int("adjustmentDays").notNull().default(0),
  exceptionJustification: text("exceptionJustification"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  index("vacation_cycles_employee_idx").on(table.employeeId),
  index("vacation_cycles_expiration_idx").on(table.expirationDate),
]);

export const vacationPeriods = mysqlTable("vacation_periods", {
  id: int("id").autoincrement().primaryKey(),
  employeeId: int("employeeId").notNull().references(() => employees.id),
  vacationCycleId: int("vacationCycleId").notNull().references(() => vacationCycles.id),
  startDate: date("startDate").notNull(),
  endDate: date("endDate").notNull(),
  calendarDays: int("calendarDays").notNull(),
  status: mysqlEnum("status", ["draft", "requested", "approved", "rejected", "cancelled", "completed"]).notNull().default("draft"),
  exceptionJustification: text("exceptionJustification"),
  requestedByUserId: int("requestedByUserId").references(() => users.id),
  approvedByUserId: int("approvedByUserId").references(() => users.id),
  decisionAt: timestamp("decisionAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  index("vacation_periods_employee_idx").on(table.employeeId),
  index("vacation_periods_cycle_idx").on(table.vacationCycleId),
  index("vacation_periods_dates_idx").on(table.startDate, table.endDate),
  index("vacation_periods_status_idx").on(table.status),
]);

export const approvalHistory = mysqlTable("approval_history", {
  id: int("id").autoincrement().primaryKey(),
  vacationPeriodId: int("vacationPeriodId").notNull().references(() => vacationPeriods.id),
  previousStatus: mysqlEnum("previousStatus", ["draft", "requested", "approved", "rejected", "cancelled", "completed"]),
  nextStatus: mysqlEnum("nextStatus", ["draft", "requested", "approved", "rejected", "cancelled", "completed"]).notNull(),
  comment: text("comment"),
  changedByUserId: int("changedByUserId").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("approval_history_period_idx").on(table.vacationPeriodId)]);

export const operationalRestrictions = mysqlTable("operational_restrictions", {
  id: int("id").autoincrement().primaryKey(),
  operationalGroupId: int("operationalGroupId").references(() => operationalGroups.id),
  jobRoleId: int("jobRoleId").references(() => jobRoles.id),
  baseId: int("baseId").references(() => bases.id),
  startDate: date("startDate").notNull(),
  endDate: date("endDate").notNull(),
  reason: varchar("reason", { length: 240 }).notNull(),
  blocksApproval: boolean("blocksApproval").notNull().default(false),
  maxConcurrentAbsences: int("maxConcurrentAbsences"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const alerts = mysqlTable("alerts", {
  id: int("id").autoincrement().primaryKey(),
  category: mysqlEnum("category", ["expiration_soon", "expiration_overdue", "pending_request", "negative_balance", "conflict", "data_quality", "job_failure"]).notNull(),
  severity: mysqlEnum("severity", ["info", "warning", "high", "critical"]).notNull().default("warning"),
  status: mysqlEnum("status", ["open", "acknowledged", "resolved", "dismissed"]).notNull().default("open"),
  employeeId: int("employeeId").references(() => employees.id),
  vacationCycleId: int("vacationCycleId").references(() => vacationCycles.id),
  vacationPeriodId: int("vacationPeriodId").references(() => vacationPeriods.id),
  title: varchar("title", { length: 240 }).notNull(),
  description: text("description"),
  detectedAt: timestamp("detectedAt").defaultNow().notNull(),
  acknowledgedAt: timestamp("acknowledgedAt"),
  resolvedAt: timestamp("resolvedAt"),
  handledByUserId: int("handledByUserId").references(() => users.id),
  handlingNote: text("handlingNote"),
  dedupeKey: varchar("dedupeKey", { length: 255 }).notNull().unique(),
}, table => [
  index("alerts_status_idx").on(table.status),
  index("alerts_category_idx").on(table.category),
]);

export const notificationRecipients = mysqlTable("notification_recipients", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  name: varchar("name", { length: 160 }),
  active: boolean("active").notNull().default(true),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const emailDeliveries = mysqlTable("email_deliveries", {
  id: int("id").autoincrement().primaryKey(),
  alertId: int("alertId").references(() => alerts.id),
  recipientId: int("recipientId").notNull().references(() => notificationRecipients.id),
  notificationType: mysqlEnum("notificationType", ["alert", "test", "weekly_summary"]).notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["pending", "sent", "failed", "skipped"]).notNull().default("pending"),
  resendEmailId: varchar("resendEmailId", { length: 100 }),
  idempotencyKey: varchar("idempotencyKey", { length: 255 }).notNull().unique(),
  errorSummary: text("errorSummary"),
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  index("email_deliveries_recipient_idx").on(table.recipientId, table.createdAt),
  index("email_deliveries_alert_idx").on(table.alertId),
]);

export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  entityType: varchar("entityType", { length: 80 }).notNull(),
  entityId: int("entityId").notNull(),
  action: varchar("action", { length: 80 }).notNull(),
  beforeData: json("beforeData"),
  afterData: json("afterData"),
  actorUserId: int("actorUserId").references(() => users.id),
  occurredAt: timestamp("occurredAt").defaultNow().notNull(),
}, table => [index("audit_logs_entity_idx").on(table.entityType, table.entityId)]);

export const jobExecutionLogs = mysqlTable("job_execution_logs", {
  id: int("id").autoincrement().primaryKey(),
  jobName: varchar("jobName", { length: 120 }).notNull(),
  status: mysqlEnum("status", ["running", "success", "partial", "failed"]).notNull(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  recordsProcessed: int("recordsProcessed").notNull().default(0),
  alertsCreated: int("alertsCreated").notNull().default(0),
  alertsUpdated: int("alertsUpdated").notNull().default(0),
  notificationsSent: int("notificationsSent").notNull().default(0),
  errorSummary: text("errorSummary"),
  durationMs: int("durationMs"),
}, table => [index("job_execution_logs_name_idx").on(table.jobName, table.startedAt)]);

export const jobSchedules = mysqlTable("job_schedules", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull().unique(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }).unique(),
  cronExpression: varchar("cronExpression", { length: 64 }).notNull(),
  active: boolean("active").notNull().default(true),
  createdByUserId: int("createdByUserId").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("job_schedules_task_uid_idx").on(table.scheduleCronTaskUid)]);

export const importBatches = mysqlTable("import_batches", {
  id: int("id").autoincrement().primaryKey(),
  originalFilename: varchar("originalFilename", { length: 255 }).notNull(),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  storageUrl: varchar("storageUrl", { length: 768 }).notNull(),
  sourceSheetName: varchar("sourceSheetName", { length: 180 }),
  status: mysqlEnum("status", ["reviewed", "published", "failed"]).notNull().default("reviewed"),
  totalRows: int("totalRows").notNull().default(0),
  acceptedRows: int("acceptedRows").notNull().default(0),
  warningRows: int("warningRows").notNull().default(0),
  errorRows: int("errorRows").notNull().default(0),
  summary: json("summary"),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  publishedAt: timestamp("publishedAt"),
}, table => [index("import_batches_status_idx").on(table.status, table.createdAt)]);

export const importIssues = mysqlTable("import_issues", {
  id: int("id").autoincrement().primaryKey(),
  importBatchId: int("importBatchId").notNull().references(() => importBatches.id),
  rowNumber: int("rowNumber"),
  entityType: varchar("entityType", { length: 80 }).notNull(),
  severity: mysqlEnum("severity", ["warning", "error"]).notNull(),
  field: varchar("field", { length: 100 }),
  message: text("message").notNull(),
  rawData: json("rawData"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  index("import_issues_batch_idx").on(table.importBatchId),
  index("import_issues_severity_idx").on(table.severity),
]);

export const pendingPeriodReconciliations = mysqlTable("pending_period_reconciliations", {
  id: int("id").autoincrement().primaryKey(),
  importBatchId: int("importBatchId").notNull().references(() => importBatches.id),
  employeeId: int("employeeId").references(() => employees.id),
  sourceRowNumber: int("sourceRowNumber").notNull(),
  sourceCycleReference: varchar("sourceCycleReference", { length: 120 }),
  sourceStartDate: date("sourceStartDate").notNull(),
  sourceEndDate: date("sourceEndDate").notNull(),
  calendarDays: int("calendarDays").notNull(),
  sourceStatus: mysqlEnum("sourceStatus", ["draft", "requested", "approved", "rejected", "cancelled", "completed"]).notNull(),
  rawData: json("rawData"),
  status: mysqlEnum("status", ["pending", "resolved", "dismissed"]).notNull().default("pending"),
  resolvedVacationPeriodId: int("resolvedVacationPeriodId").references(() => vacationPeriods.id),
  resolutionNote: text("resolutionNote"),
  resolvedByUserId: int("resolvedByUserId").references(() => users.id),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  index("pending_period_reconciliations_batch_idx").on(table.importBatchId, table.status),
  index("pending_period_reconciliations_employee_idx").on(table.employeeId),
]);

export type Employee = typeof employees.$inferSelect;
export type VacationCycle = typeof vacationCycles.$inferSelect;
export type VacationPeriod = typeof vacationPeriods.$inferSelect;
