import { and, count, eq, gt, gte, isNull, lt, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { alerts, approvalHistory, auditLogs, bases, emailDeliveries, employees, importBatches, importIssues, InsertUser, internalAuthTokens, jobExecutionLogs, jobRoles, jobSchedules, notificationRecipients, operationalGroups, operationalRestrictions, pendingPeriodReconciliations, users, vacationCycles, vacationPeriods } from "../drizzle/schema";
import { randomUUID } from "node:crypto";
import { buildWorkbookPreview, type ImportIssueDraft, type WorkbookPreview } from "./importVacationWorkbook";
import { ENV } from './_core/env';
import { canTransitionVacationStatus, systemAlertInputSchema } from "./vacationSchemas";
import { calculateExecutionDurationMs } from "./executionTiming";
import { exceedsConcurrentAbsenceLimit } from "./vacationRules";
import { storageGetSignedUrl } from "./storage";
import { persistPendingPeriodResolution } from "./reconciliationPersistence";
import { buildPendingPeriodDismissal } from "./reconciliationRules";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getInternalUserById(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(users).where(and(eq(users.id, userId), eq(users.internalAuthEnabled, true), eq(users.accountActive, true))).limit(1))[0];
}

export async function getInternalUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(users).where(and(eq(users.email, email), eq(users.internalAuthEnabled, true), eq(users.accountActive, true))).limit(1))[0];
}

export async function createInternalAccountInvite(input: { email: string; name: string; role: "user" | "planner" | "approver" | "admin"; tokenHash: string; expiresAt: Date; actorUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  let user = (await db.select().from(users).where(eq(users.email, input.email)).limit(1))[0];
  if (!user) {
    await db.insert(users).values({ openId: `internal_${randomUUID()}`, email: input.email, name: input.name, loginMethod: "internal", role: input.role, internalAuthEnabled: true, accountActive: true });
    user = (await db.select().from(users).where(eq(users.email, input.email)).limit(1))[0];
  } else {
    await db.update(users).set({ name: input.name, role: input.role, internalAuthEnabled: true, accountActive: true, loginMethod: "internal" }).where(eq(users.id, user.id));
    user = (await db.select().from(users).where(eq(users.id, user.id)).limit(1))[0];
  }
  if (!user) throw new Error("Não foi possível preparar a conta interna.");
  await db.update(internalAuthTokens).set({ consumedAt: new Date() }).where(and(eq(internalAuthTokens.userId, user.id), eq(internalAuthTokens.purpose, "invite"), isNull(internalAuthTokens.consumedAt)));
  await db.insert(internalAuthTokens).values({ userId: user.id, purpose: "invite", tokenHash: input.tokenHash, expiresAt: input.expiresAt, createdByUserId: input.actorUserId });
  await db.insert(auditLogs).values({ entityType: "internal_account", entityId: user.id, action: "invite_created", afterData: { email: input.email, role: input.role }, actorUserId: input.actorUserId });
  return user;
}

export async function createInternalPasswordReset(input: { email: string; tokenHash: string; expiresAt: Date }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const user = (await db.select().from(users).where(and(eq(users.email, input.email), eq(users.internalAuthEnabled, true), eq(users.accountActive, true))).limit(1))[0];
  if (!user) return null;
  await db.update(internalAuthTokens).set({ consumedAt: new Date() }).where(and(eq(internalAuthTokens.userId, user.id), eq(internalAuthTokens.purpose, "password_reset"), isNull(internalAuthTokens.consumedAt)));
  await db.insert(internalAuthTokens).values({ userId: user.id, purpose: "password_reset", tokenHash: input.tokenHash, expiresAt: input.expiresAt });
  await db.insert(auditLogs).values({ entityType: "internal_account", entityId: user.id, action: "password_reset_requested", afterData: { requestedAt: new Date().toISOString() }, actorUserId: user.id });
  return user;
}

export async function activateInternalAccount(input: { tokenHash: string; passwordHash: string }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const userId = await db.transaction(async tx => {
    const token = (await tx.select().from(internalAuthTokens).where(and(eq(internalAuthTokens.tokenHash, input.tokenHash), isNull(internalAuthTokens.consumedAt), gt(internalAuthTokens.expiresAt, new Date()))).limit(1))[0];
    if (!token) throw new Error("O convite é inválido, expirou ou já foi utilizado.");
    const now = new Date();
    await tx.update(users).set({ passwordHash: input.passwordHash, passwordUpdatedAt: now, internalAuthEnabled: true, accountActive: true, lastSignedIn: now }).where(eq(users.id, token.userId));
    await tx.update(internalAuthTokens).set({ consumedAt: now }).where(and(eq(internalAuthTokens.id, token.id), isNull(internalAuthTokens.consumedAt)));
    await tx.insert(auditLogs).values({ entityType: "internal_account", entityId: token.userId, action: token.purpose === "invite" ? "invite_activated" : "password_reset_completed", afterData: { activatedAt: now.toISOString() }, actorUserId: token.userId });
    return token.userId;
  });
  return getInternalUserById(userId);
}

export async function changeInternalPassword(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const now = new Date();
  await db.transaction(async tx => {
    await tx.update(users).set({ passwordHash, passwordUpdatedAt: now }).where(and(eq(users.id, userId), eq(users.internalAuthEnabled, true), eq(users.accountActive, true)));
    await tx.update(internalAuthTokens).set({ consumedAt: now }).where(and(eq(internalAuthTokens.userId, userId), eq(internalAuthTokens.purpose, "password_reset"), isNull(internalAuthTokens.consumedAt)));
    await tx.insert(auditLogs).values({ entityType: "internal_account", entityId: userId, action: "password_changed", afterData: { changedAt: now.toISOString() }, actorUserId: userId });
  });
}

export async function listSystemUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: users.id, name: users.name, email: users.email, role: users.role, internalAuthEnabled: users.internalAuthEnabled, accountActive: users.accountActive, lastSignedIn: users.lastSignedIn, createdAt: users.createdAt }).from(users).orderBy(users.name);
}

export async function updateSystemUserRole(userId: number, role: "user" | "planner" | "approver" | "admin", actorUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const existing = (await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, userId)).limit(1))[0];
  if (!existing) throw new Error("Usuário não encontrado.");
  await db.update(users).set({ role }).where(eq(users.id, userId));
  await db.insert(auditLogs).values({ entityType: "user_access", entityId: userId, action: "role_changed", beforeData: { role: existing.role }, afterData: { role }, actorUserId });
}

export async function updateInternalAccountStatus(userId: number, active: boolean, actorUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const account = (await db.select({ id: users.id, accountActive: users.accountActive, internalAuthEnabled: users.internalAuthEnabled }).from(users).where(eq(users.id, userId)).limit(1))[0];
  if (!account || !account.internalAuthEnabled) throw new Error("Conta interna não encontrada.");
  await db.update(users).set({ accountActive: active }).where(eq(users.id, userId));
  await db.insert(auditLogs).values({ entityType: "internal_account", entityId: userId, action: active ? "account_activated" : "account_suspended", beforeData: { accountActive: account.accountActive }, afterData: { accountActive: active }, actorUserId });
}

export type OrganizationEntity = "jobRole" | "operationalGroup" | "base";

export async function listOrganizationEntries(entity: OrganizationEntity) {
  const db = await getDb();
  if (!db) return [];

  if (entity === "jobRole") return db.select().from(jobRoles).orderBy(jobRoles.name);
  if (entity === "operationalGroup") return db.select().from(operationalGroups).orderBy(operationalGroups.name);
  return db.select().from(bases).orderBy(bases.name);
}

export async function createOrganizationEntry(input: {
  entity: OrganizationEntity;
  name: string;
  code?: string;
  description?: string;
  actorUserId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");

  let id: number;
  if (input.entity === "jobRole") {
    const result = await db.insert(jobRoles).values({ name: input.name });
    id = Number(result[0].insertId);
  } else if (input.entity === "operationalGroup") {
    const result = await db.insert(operationalGroups).values({ name: input.name, description: input.description || null });
    id = Number(result[0].insertId);
  } else {
    const result = await db.insert(bases).values({ name: input.name, code: input.code || null });
    id = Number(result[0].insertId);
  }
  await db.insert(auditLogs).values({ entityType: `organization_${input.entity}`, entityId: id, action: "created", afterData: { name: input.name, code: input.code, description: input.description }, actorUserId: input.actorUserId });
  return id;
}

export async function updateOrganizationEntry(input: { id: number; entity: OrganizationEntity; name: string; code?: string; description?: string; actorUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  if (input.entity === "jobRole") {
    const existing = (await db.select().from(jobRoles).where(eq(jobRoles.id, input.id)).limit(1))[0];
    if (!existing) throw new Error("Cargo não encontrado.");
    await db.update(jobRoles).set({ name: input.name }).where(eq(jobRoles.id, input.id));
    await db.insert(auditLogs).values({ entityType: "organization_jobRole", entityId: input.id, action: "updated", beforeData: { name: existing.name }, afterData: { name: input.name }, actorUserId: input.actorUserId });
    return;
  }
  if (input.entity === "operationalGroup") {
    const existing = (await db.select().from(operationalGroups).where(eq(operationalGroups.id, input.id)).limit(1))[0];
    if (!existing) throw new Error("Grupo operacional não encontrado.");
    await db.update(operationalGroups).set({ name: input.name, description: input.description || null }).where(eq(operationalGroups.id, input.id));
    await db.insert(auditLogs).values({ entityType: "organization_operationalGroup", entityId: input.id, action: "updated", beforeData: { name: existing.name, description: existing.description }, afterData: { name: input.name, description: input.description || null }, actorUserId: input.actorUserId });
    return;
  }
  const existing = (await db.select().from(bases).where(eq(bases.id, input.id)).limit(1))[0];
  if (!existing) throw new Error("Base não encontrada.");
  await db.update(bases).set({ name: input.name, code: input.code || null }).where(eq(bases.id, input.id));
  await db.insert(auditLogs).values({ entityType: "organization_base", entityId: input.id, action: "updated", beforeData: { name: existing.name, code: existing.code }, afterData: { name: input.name, code: input.code || null }, actorUserId: input.actorUserId });
}

export async function listOperationalRestrictions() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: operationalRestrictions.id, jobRoleId: operationalRestrictions.jobRoleId, operationalGroupId: operationalRestrictions.operationalGroupId, baseId: operationalRestrictions.baseId, startDate: operationalRestrictions.startDate, endDate: operationalRestrictions.endDate, reason: operationalRestrictions.reason, blocksApproval: operationalRestrictions.blocksApproval, maxConcurrentAbsences: operationalRestrictions.maxConcurrentAbsences, jobRoleName: jobRoles.name, operationalGroupName: operationalGroups.name, baseName: bases.name }).from(operationalRestrictions).leftJoin(jobRoles, eq(operationalRestrictions.jobRoleId, jobRoles.id)).leftJoin(operationalGroups, eq(operationalRestrictions.operationalGroupId, operationalGroups.id)).leftJoin(bases, eq(operationalRestrictions.baseId, bases.id)).orderBy(operationalRestrictions.startDate);
}

export async function createOperationalRestriction(input: { operationalGroupId?: number; jobRoleId?: number; baseId?: number; startDate: string; endDate: string; reason: string; blocksApproval: boolean; maxConcurrentAbsences?: number; actorUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const result = await db.insert(operationalRestrictions).values({ operationalGroupId: input.operationalGroupId, jobRoleId: input.jobRoleId, baseId: input.baseId, startDate: new Date(`${input.startDate}T00:00:00Z`), endDate: new Date(`${input.endDate}T00:00:00Z`), reason: input.reason, blocksApproval: input.blocksApproval, maxConcurrentAbsences: input.maxConcurrentAbsences });
  const restrictionId = Number(result[0].insertId);
  await db.insert(auditLogs).values({ entityType: "operational_restriction", entityId: restrictionId, action: "created", afterData: { operationalGroupId: input.operationalGroupId, jobRoleId: input.jobRoleId, baseId: input.baseId, startDate: input.startDate, endDate: input.endDate, reason: input.reason, blocksApproval: input.blocksApproval, maxConcurrentAbsences: input.maxConcurrentAbsences }, actorUserId: input.actorUserId });
  return restrictionId;
}

export async function updateOperationalRestriction(input: { restrictionId: number; operationalGroupId?: number; jobRoleId?: number; baseId?: number; startDate: string; endDate: string; reason: string; blocksApproval: boolean; maxConcurrentAbsences?: number; actorUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const existing = (await db.select().from(operationalRestrictions).where(eq(operationalRestrictions.id, input.restrictionId)).limit(1))[0];
  if (!existing) throw new Error("Restrição operacional não encontrada.");
  const afterData = { operationalGroupId: input.operationalGroupId || null, jobRoleId: input.jobRoleId || null, baseId: input.baseId || null, startDate: input.startDate, endDate: input.endDate, reason: input.reason, blocksApproval: input.blocksApproval, maxConcurrentAbsences: input.maxConcurrentAbsences || null };
  await db.update(operationalRestrictions).set({ ...afterData, startDate: new Date(`${input.startDate}T00:00:00Z`), endDate: new Date(`${input.endDate}T00:00:00Z`) }).where(eq(operationalRestrictions.id, input.restrictionId));
  await db.insert(auditLogs).values({ entityType: "operational_restriction", entityId: input.restrictionId, action: "updated", beforeData: { operationalGroupId: existing.operationalGroupId, jobRoleId: existing.jobRoleId, baseId: existing.baseId, startDate: existing.startDate, endDate: existing.endDate, reason: existing.reason, blocksApproval: existing.blocksApproval, maxConcurrentAbsences: existing.maxConcurrentAbsences }, afterData, actorUserId: input.actorUserId });
}

async function findBlockingRestriction(input: { employeeId: number; startDate: Date; endDate: Date }) {
  const db = await getDb();
  if (!db) return undefined;
  const employee = (await db.select({ jobRoleId: employees.jobRoleId, operationalGroupId: employees.operationalGroupId, baseId: employees.baseId }).from(employees).where(eq(employees.id, input.employeeId)).limit(1))[0];
  if (!employee) return undefined;
  const restrictions = await db.select().from(operationalRestrictions).where(and(lte(operationalRestrictions.startDate, input.endDate), gte(operationalRestrictions.endDate, input.startDate)));
  const matchingRestrictions = restrictions.filter(restriction => (!restriction.jobRoleId || restriction.jobRoleId === employee.jobRoleId) && (!restriction.operationalGroupId || restriction.operationalGroupId === employee.operationalGroupId) && (!restriction.baseId || restriction.baseId === employee.baseId));
  const directBlock = matchingRestrictions.find(restriction => restriction.blocksApproval);
  if (directBlock) return directBlock;
  const approvedPeriods = await db.select({ startDate: vacationPeriods.startDate, endDate: vacationPeriods.endDate, jobRoleId: employees.jobRoleId, operationalGroupId: employees.operationalGroupId, baseId: employees.baseId }).from(vacationPeriods).innerJoin(employees, eq(vacationPeriods.employeeId, employees.id)).where(and(eq(vacationPeriods.status, "approved"), lte(vacationPeriods.startDate, input.endDate), gte(vacationPeriods.endDate, input.startDate)));
  for (const restriction of matchingRestrictions.filter(item => item.maxConcurrentAbsences)) {
    const scopeRanges = approvedPeriods.filter(period => (!restriction.jobRoleId || restriction.jobRoleId === period.jobRoleId) && (!restriction.operationalGroupId || restriction.operationalGroupId === period.operationalGroupId) && (!restriction.baseId || restriction.baseId === period.baseId)).map(period => ({ startDate: period.startDate.toISOString().slice(0, 10), endDate: period.endDate.toISOString().slice(0, 10) }));
    if (exceedsConcurrentAbsenceLimit({ startDate: input.startDate.toISOString().slice(0, 10), endDate: input.endDate.toISOString().slice(0, 10) }, scopeRanges, restriction.maxConcurrentAbsences!)) return { ...restriction, reason: `${restriction.reason} (limite de ${restriction.maxConcurrentAbsences} ausência(s) simultânea(s))` };
  }
  return undefined;
}

export async function listEmployees() {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      id: employees.id,
      employeeCode: employees.employeeCode,
      fullName: employees.fullName,
      displayName: employees.displayName,
      email: employees.email,
      admissionDate: employees.admissionDate,
      active: employees.active,
      notes: employees.notes,
      jobRoleId: employees.jobRoleId,
      jobRoleName: jobRoles.name,
      operationalGroupId: employees.operationalGroupId,
      operationalGroupName: operationalGroups.name,
      baseId: employees.baseId,
      baseName: bases.name,
    })
    .from(employees)
    .leftJoin(jobRoles, eq(employees.jobRoleId, jobRoles.id))
    .leftJoin(operationalGroups, eq(employees.operationalGroupId, operationalGroups.id))
    .leftJoin(bases, eq(employees.baseId, bases.id))
    .orderBy(employees.fullName);
}

export async function createEmployee(input: {
  employeeCode?: string;
  fullName: string;
  displayName?: string;
  email?: string;
  admissionDate?: string;
  jobRoleId?: number;
  operationalGroupId?: number;
  baseId?: number;
  active: boolean;
  notes?: string;
  actorUserId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");

  const result = await db.insert(employees).values({
    employeeCode: input.employeeCode || null,
    fullName: input.fullName,
    displayName: input.displayName || null,
    email: input.email || null,
    admissionDate: input.admissionDate ? new Date(`${input.admissionDate}T00:00:00Z`) : null,
    jobRoleId: input.jobRoleId ?? null,
    operationalGroupId: input.operationalGroupId ?? null,
    baseId: input.baseId ?? null,
    active: input.active,
    notes: input.notes || null,
  });
  const employeeId = Number(result[0].insertId);
  await db.insert(auditLogs).values({ entityType: "employee", entityId: employeeId, action: "created", afterData: { ...input, actorUserId: undefined }, actorUserId: input.actorUserId });
  return employeeId;
}

export async function updateEmployee(input: {
  employeeId: number;
  employeeCode?: string;
  fullName: string;
  displayName?: string;
  email?: string;
  admissionDate?: string;
  jobRoleId?: number;
  operationalGroupId?: number;
  baseId?: number;
  active: boolean;
  notes?: string;
  actorUserId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const existing = (await db.select().from(employees).where(eq(employees.id, input.employeeId)).limit(1))[0];
  if (!existing) throw new Error("Colaborador não encontrado.");
  const afterData = { employeeCode: input.employeeCode || null, fullName: input.fullName, displayName: input.displayName || null, email: input.email || null, admissionDate: input.admissionDate || null, jobRoleId: input.jobRoleId || null, operationalGroupId: input.operationalGroupId || null, baseId: input.baseId || null, active: input.active, notes: input.notes || null };
  await db.update(employees).set({ ...afterData, admissionDate: input.admissionDate ? new Date(`${input.admissionDate}T00:00:00Z`) : null }).where(eq(employees.id, input.employeeId));
  await db.insert(auditLogs).values({ entityType: "employee", entityId: input.employeeId, action: "updated", beforeData: { fullName: existing.fullName, displayName: existing.displayName, email: existing.email, active: existing.active, jobRoleId: existing.jobRoleId, operationalGroupId: existing.operationalGroupId, baseId: existing.baseId }, afterData, actorUserId: input.actorUserId });
}

export async function updateEmployeeActiveStatus(employeeId: number, active: boolean, actorUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const existing = (await db.select({ id: employees.id, active: employees.active }).from(employees).where(eq(employees.id, employeeId)).limit(1))[0];
  if (!existing) throw new Error("Colaborador não encontrado.");
  await db.update(employees).set({ active }).where(eq(employees.id, employeeId));
  await db.insert(auditLogs).values({ entityType: "employee", entityId: employeeId, action: active ? "activated" : "inactivated", beforeData: { active: existing.active }, afterData: { active }, actorUserId });
}

function cycleBalanceExpression() {
  const usedDays = sql<number>`coalesce(sum(case when ${vacationPeriods.status} in ('approved', 'completed') then ${vacationPeriods.calendarDays} else 0 end), 0)`;
  return sql<number>`${vacationCycles.entitledDays} - ${vacationCycles.soldDays} + ${vacationCycles.adjustmentDays} - ${usedDays}`;
}

export async function listVacationCyclesWithBalances() {
  const db = await getDb();
  if (!db) return [];

  const balance = cycleBalanceExpression();
  return db
    .select({
      id: vacationCycles.id,
      employeeId: vacationCycles.employeeId,
      employeeName: employees.fullName,
      reference: vacationCycles.reference,
      accrualStartDate: vacationCycles.accrualStartDate,
      accrualEndDate: vacationCycles.accrualEndDate,
      expirationDate: vacationCycles.expirationDate,
      entitledDays: vacationCycles.entitledDays,
      soldDays: vacationCycles.soldDays,
      adjustmentDays: vacationCycles.adjustmentDays,
      exceptionJustification: vacationCycles.exceptionJustification,
      usedDays: sql<number>`coalesce(sum(case when ${vacationPeriods.status} in ('approved', 'completed') then ${vacationPeriods.calendarDays} else 0 end), 0)`,
      balance,
    })
    .from(vacationCycles)
    .innerJoin(employees, eq(vacationCycles.employeeId, employees.id))
    .leftJoin(vacationPeriods, eq(vacationPeriods.vacationCycleId, vacationCycles.id))
    .groupBy(
      vacationCycles.id,
      vacationCycles.employeeId,
      employees.fullName,
      vacationCycles.reference,
      vacationCycles.accrualStartDate,
      vacationCycles.accrualEndDate,
      vacationCycles.expirationDate,
      vacationCycles.entitledDays,
      vacationCycles.soldDays,
      vacationCycles.adjustmentDays,
      vacationCycles.exceptionJustification,
    )
    .orderBy(vacationCycles.expirationDate);
}

export async function createVacationCycle(input: {
  employeeId: number;
  reference: string;
  accrualStartDate?: string;
  accrualEndDate?: string;
  expirationDate: string;
  entitledDays: number;
  soldDays: number;
  adjustmentDays: number;
  exceptionJustification?: string;
  actorUserId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");

  const result = await db.insert(vacationCycles).values({
    employeeId: input.employeeId,
    reference: input.reference,
    accrualStartDate: input.accrualStartDate ? new Date(`${input.accrualStartDate}T00:00:00Z`) : null,
    accrualEndDate: input.accrualEndDate ? new Date(`${input.accrualEndDate}T00:00:00Z`) : null,
    expirationDate: new Date(`${input.expirationDate}T00:00:00Z`),
    entitledDays: input.entitledDays,
    soldDays: input.soldDays,
    adjustmentDays: input.adjustmentDays,
    exceptionJustification: input.exceptionJustification || null,
  });
  const cycleId = Number(result[0].insertId);
  await db.insert(auditLogs).values({
    entityType: "vacation_cycle",
    entityId: cycleId,
    action: "created",
    afterData: { reference: input.reference, employeeId: input.employeeId, expirationDate: input.expirationDate },
    actorUserId: input.actorUserId,
  });
}

export async function updateVacationCycle(input: {
  vacationCycleId: number;
  employeeId: number;
  reference: string;
  accrualStartDate?: string;
  accrualEndDate?: string;
  expirationDate: string;
  entitledDays: number;
  soldDays: number;
  adjustmentDays: number;
  exceptionJustification?: string;
  actorUserId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const existing = (await db.select().from(vacationCycles).where(eq(vacationCycles.id, input.vacationCycleId)).limit(1))[0];
  if (!existing) throw new Error("Ciclo de férias não encontrado.");
  const afterData = { employeeId: input.employeeId, reference: input.reference, accrualStartDate: input.accrualStartDate || null, accrualEndDate: input.accrualEndDate || null, expirationDate: input.expirationDate, entitledDays: input.entitledDays, soldDays: input.soldDays, adjustmentDays: input.adjustmentDays, exceptionJustification: input.exceptionJustification || null };
  await db.update(vacationCycles).set({ ...afterData, accrualStartDate: input.accrualStartDate ? new Date(`${input.accrualStartDate}T00:00:00Z`) : null, accrualEndDate: input.accrualEndDate ? new Date(`${input.accrualEndDate}T00:00:00Z`) : null, expirationDate: new Date(`${input.expirationDate}T00:00:00Z`) }).where(eq(vacationCycles.id, input.vacationCycleId));
  await db.insert(auditLogs).values({ entityType: "vacation_cycle", entityId: input.vacationCycleId, action: "updated", beforeData: { employeeId: existing.employeeId, reference: existing.reference, expirationDate: existing.expirationDate, entitledDays: existing.entitledDays, soldDays: existing.soldDays, adjustmentDays: existing.adjustmentDays }, afterData, actorUserId: input.actorUserId });
}

export async function listVacationPeriodsWithDetails() {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      id: vacationPeriods.id,
      employeeId: vacationPeriods.employeeId,
      employeeName: employees.fullName,
      vacationCycleId: vacationPeriods.vacationCycleId,
      cycleReference: vacationCycles.reference,
      startDate: vacationPeriods.startDate,
      endDate: vacationPeriods.endDate,
      calendarDays: vacationPeriods.calendarDays,
      status: vacationPeriods.status,
      exceptionJustification: vacationPeriods.exceptionJustification,
      createdAt: vacationPeriods.createdAt,
    })
    .from(vacationPeriods)
    .innerJoin(employees, eq(vacationPeriods.employeeId, employees.id))
    .innerJoin(vacationCycles, eq(vacationPeriods.vacationCycleId, vacationCycles.id))
    .orderBy(vacationPeriods.startDate);
}

export async function listCalendarEntries(filters: {
  startDate?: string;
  endDate?: string;
  jobRoleId?: number;
  operationalGroupId?: number;
  baseId?: number;
  status?: "draft" | "requested" | "approved" | "rejected" | "cancelled" | "completed";
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (filters.startDate) conditions.push(gte(vacationPeriods.endDate, new Date(`${filters.startDate}T00:00:00Z`)));
  if (filters.endDate) conditions.push(lte(vacationPeriods.startDate, new Date(`${filters.endDate}T00:00:00Z`)));
  if (filters.jobRoleId) conditions.push(eq(employees.jobRoleId, filters.jobRoleId));
  if (filters.operationalGroupId) conditions.push(eq(employees.operationalGroupId, filters.operationalGroupId));
  if (filters.baseId) conditions.push(eq(employees.baseId, filters.baseId));
  if (filters.status) conditions.push(eq(vacationPeriods.status, filters.status));

  return db
    .select({
      id: vacationPeriods.id,
      employeeName: employees.fullName,
      employeeId: employees.id,
      jobRoleName: jobRoles.name,
      operationalGroupName: operationalGroups.name,
      baseName: bases.name,
      startDate: vacationPeriods.startDate,
      endDate: vacationPeriods.endDate,
      calendarDays: vacationPeriods.calendarDays,
      status: vacationPeriods.status,
    })
    .from(vacationPeriods)
    .innerJoin(employees, eq(vacationPeriods.employeeId, employees.id))
    .leftJoin(jobRoles, eq(employees.jobRoleId, jobRoles.id))
    .leftJoin(operationalGroups, eq(employees.operationalGroupId, operationalGroups.id))
    .leftJoin(bases, eq(employees.baseId, bases.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(vacationPeriods.startDate, employees.fullName);
}

export async function createVacationPeriod(input: {
  employeeId: number;
  vacationCycleId: number;
  startDate: string;
  endDate: string;
  calendarDays: number;
  status: "draft" | "requested" | "approved" | "rejected" | "cancelled" | "completed";
  exceptionJustification?: string;
  requestedByUserId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");

  const result = await db.insert(vacationPeriods).values({
    employeeId: input.employeeId,
    vacationCycleId: input.vacationCycleId,
    startDate: new Date(`${input.startDate}T00:00:00Z`),
    endDate: new Date(`${input.endDate}T00:00:00Z`),
    calendarDays: input.calendarDays,
    status: input.status,
    exceptionJustification: input.exceptionJustification || null,
    requestedByUserId: input.requestedByUserId,
  });
  const periodId = Number(result[0].insertId);
  await db.insert(approvalHistory).values({
    vacationPeriodId: periodId,
    previousStatus: null,
    nextStatus: input.status,
    comment: "Período criado.",
    changedByUserId: input.requestedByUserId,
  });
  await db.insert(auditLogs).values({
    entityType: "vacation_period",
    entityId: periodId,
    action: "created",
    afterData: { employeeId: input.employeeId, vacationCycleId: input.vacationCycleId, status: input.status },
    actorUserId: input.requestedByUserId,
  });
}

export async function updateVacationPeriod(input: {
  vacationPeriodId: number;
  employeeId: number;
  vacationCycleId: number;
  startDate: string;
  endDate: string;
  calendarDays: number;
  exceptionJustification?: string;
  actorUserId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const existing = (await db.select().from(vacationPeriods).where(eq(vacationPeriods.id, input.vacationPeriodId)).limit(1))[0];
  if (!existing) throw new Error("Período de férias não encontrado.");
  if (existing.status !== "draft" && existing.status !== "requested") throw new Error("Somente rascunhos ou solicitações pendentes podem ser editados.");
  const afterData = { employeeId: input.employeeId, vacationCycleId: input.vacationCycleId, startDate: input.startDate, endDate: input.endDate, calendarDays: input.calendarDays, exceptionJustification: input.exceptionJustification || null };
  await db.update(vacationPeriods).set({ ...afterData, startDate: new Date(`${input.startDate}T00:00:00Z`), endDate: new Date(`${input.endDate}T00:00:00Z`) }).where(eq(vacationPeriods.id, input.vacationPeriodId));
  await db.insert(auditLogs).values({ entityType: "vacation_period", entityId: input.vacationPeriodId, action: "updated", beforeData: { employeeId: existing.employeeId, vacationCycleId: existing.vacationCycleId, startDate: existing.startDate, endDate: existing.endDate, calendarDays: existing.calendarDays, status: existing.status }, afterData, actorUserId: input.actorUserId });
}

export async function transitionVacationPeriodStatus(input: {
  vacationPeriodId: number;
  toStatus: "draft" | "requested" | "approved" | "rejected" | "cancelled" | "completed";
  comment?: string;
  actorUserId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");

  const existing = (await db.select().from(vacationPeriods).where(eq(vacationPeriods.id, input.vacationPeriodId)).limit(1))[0];
  if (!existing) throw new Error("Período de férias não encontrado.");
  if (!canTransitionVacationStatus(existing.status, input.toStatus)) {
    throw new Error("Esta transição de status não é permitida.");
  }
  if (input.toStatus === "approved") {
    const blockingRestriction = await findBlockingRestriction({ employeeId: existing.employeeId, startDate: existing.startDate, endDate: existing.endDate });
    if (blockingRestriction) throw new Error(`A aprovação é bloqueada pela restrição operacional: ${blockingRestriction.reason}`);
  }

  const decision = input.toStatus === "approved" || input.toStatus === "rejected";
  await db.update(vacationPeriods).set({
    status: input.toStatus,
    approvedByUserId: decision ? input.actorUserId : existing.approvedByUserId,
    decisionAt: decision ? new Date() : existing.decisionAt,
  }).where(eq(vacationPeriods.id, input.vacationPeriodId));
  await db.insert(approvalHistory).values({
    vacationPeriodId: input.vacationPeriodId,
    previousStatus: existing.status,
    nextStatus: input.toStatus,
    comment: input.comment || null,
    changedByUserId: input.actorUserId,
  });
  await db.insert(auditLogs).values({
    entityType: "vacation_period",
    entityId: input.vacationPeriodId,
    action: "status_changed",
    beforeData: { status: existing.status },
    afterData: { status: input.toStatus, comment: input.comment || null },
    actorUserId: input.actorUserId,
  });
}

export async function createImportBatch(input: {
  originalFilename: string;
  storageKey: string;
  storageUrl: string;
  createdByUserId: number;
  preview: WorkbookPreview;
}) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");

  const result = await db.insert(importBatches).values({
    originalFilename: input.originalFilename,
    storageKey: input.storageKey,
    storageUrl: input.storageUrl,
    sourceSheetName: input.preview.sourceSheetName,
    status: "reviewed",
    totalRows: input.preview.totalRows,
    acceptedRows: input.preview.acceptedRows,
    warningRows: input.preview.warningRows,
    errorRows: input.preview.errorRows,
    summary: { periodBlocksDetected: input.preview.periodBlocksDetected },
    createdByUserId: input.createdByUserId,
  });
  const batchId = Number(result[0].insertId);
  const issueValues = input.preview.issues.map((issue: ImportIssueDraft) => ({
    importBatchId: batchId,
    rowNumber: issue.rowNumber,
    entityType: issue.entityType,
    severity: issue.severity,
    field: issue.field,
    message: issue.message,
    rawData: issue.rawData ?? null,
  }));
  if (issueValues.length) await db.insert(importIssues).values(issueValues);
  await db.insert(auditLogs).values({
    entityType: "import_batch",
    entityId: batchId,
    action: "preview_created",
    afterData: { filename: input.originalFilename, acceptedRows: input.preview.acceptedRows, warningRows: input.preview.warningRows, errorRows: input.preview.errorRows },
    actorUserId: input.createdByUserId,
  });
  return batchId;
}

const importKey = (value: string) => value.trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export async function publishImportBatch(input: { batchId: number; actorUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const batch = (await db.select().from(importBatches).where(eq(importBatches.id, input.batchId)).limit(1))[0];
  if (!batch) throw new Error("Lote de importação não encontrado.");
  if (batch.status !== "reviewed") throw new Error("Somente lotes em prévia podem ser publicados.");

  const signedUrl = await storageGetSignedUrl(batch.storageKey);
  const fileResponse = await fetch(signedUrl);
  if (!fileResponse.ok) throw new Error("Não foi possível recuperar a planilha armazenada para publicação.");
  const preview = buildWorkbookPreview(Buffer.from(await fileResponse.arrayBuffer()), Number.MAX_SAFE_INTEGER);
  if (preview.errorRows > 0) throw new Error("O lote possui pendências impeditivas e não pode ser publicado.");

  const [existingRoles, existingBases, existingEmployees, existingCycles] = await Promise.all([
    db.select({ id: jobRoles.id, name: jobRoles.name }).from(jobRoles),
    db.select({ id: bases.id, name: bases.name }).from(bases),
    db.select({ id: employees.id, fullName: employees.fullName }).from(employees),
    db.select({ id: vacationCycles.id, employeeId: vacationCycles.employeeId, reference: vacationCycles.reference }).from(vacationCycles),
  ]);
  const roleMap = new Map(existingRoles.map(entry => [importKey(entry.name), entry.id]));
  const baseMap = new Map(existingBases.map(entry => [importKey(entry.name), entry.id]));
  const employeeMap = new Map(existingEmployees.map(entry => [importKey(entry.fullName), entry.id]));
  const cycleMap = new Map(existingCycles.map(entry => [`${entry.employeeId}:${importKey(entry.reference)}`, entry.id]));
  let createdEmployees = 0;
  let existingEmployeeCount = 0;
  let createdRoles = 0;
  let createdBases = 0;
  let createdCycles = 0;
  let existingCycleCount = 0;
  let createdPeriods = 0;
  let skippedPeriods = 0;

  for (const employee of preview.employees) {
    let jobRoleId: number | undefined;
    let baseId: number | undefined;
    if (employee.jobRole) {
      const key = importKey(employee.jobRole);
      jobRoleId = roleMap.get(key);
      if (!jobRoleId) {
        const result = await db.insert(jobRoles).values({ name: employee.jobRole, active: true });
        jobRoleId = Number(result[0].insertId);
        roleMap.set(key, jobRoleId);
        createdRoles += 1;
      }
    }
    if (employee.base) {
      const key = importKey(employee.base);
      baseId = baseMap.get(key);
      if (!baseId) {
        const result = await db.insert(bases).values({ name: employee.base, active: true });
        baseId = Number(result[0].insertId);
        baseMap.set(key, baseId);
        createdBases += 1;
      }
    }
    const employeeKey = importKey(employee.fullName);
    let employeeId = employeeMap.get(employeeKey);
    if (employeeId) {
      existingEmployeeCount += 1;
      continue;
    }
    const result = await db.insert(employees).values({ fullName: employee.fullName, displayName: employee.displayName, admissionDate: employee.admissionDate ? new Date(`${employee.admissionDate}T00:00:00Z`) : null, jobRoleId, baseId, active: true });
    employeeId = Number(result[0].insertId);
    employeeMap.set(employeeKey, employeeId);
    createdEmployees += 1;
  }

  for (const cycle of preview.vacationCycles) {
    const employeeId = employeeMap.get(importKey(cycle.employeeName));
    if (!employeeId) continue;
    const cycleKey = `${employeeId}:${importKey(cycle.reference)}`;
    if (cycleMap.has(cycleKey)) {
      existingCycleCount += 1;
      continue;
    }
    const created = await db.insert(vacationCycles).values({ employeeId, reference: cycle.reference, expirationDate: new Date(`${cycle.expirationDate}T00:00:00Z`), entitledDays: cycle.entitledDays, soldDays: cycle.soldDays, adjustmentDays: 0 });
    cycleMap.set(cycleKey, Number(created[0].insertId));
    createdCycles += 1;
  }

  for (const period of preview.vacationPeriods) {
    const employeeId = employeeMap.get(importKey(period.employeeName));
    const cycleId = period.cycleReference ? cycleMap.get(`${employeeId}:${importKey(period.cycleReference)}`) : undefined;
    if (!employeeId || !cycleId) {
      skippedPeriods += 1;
      continue;
    }
    const created = await db.insert(vacationPeriods).values({ employeeId, vacationCycleId: cycleId, startDate: new Date(`${period.startDate}T00:00:00Z`), endDate: new Date(`${period.endDate}T00:00:00Z`), calendarDays: period.calendarDays, status: period.status, requestedByUserId: input.actorUserId });
    const periodId = Number(created[0].insertId);
    await db.insert(approvalHistory).values({ vacationPeriodId: periodId, previousStatus: null, nextStatus: period.status, comment: "Importado de planilha legada.", changedByUserId: input.actorUserId });
    createdPeriods += 1;
  }

  const result = { createdEmployees, existingEmployeeCount, createdRoles, createdBases, createdCycles, existingCycleCount, createdPeriods, skippedPeriods, periodBlocksDetected: preview.periodBlocksDetected };
  await db.update(importBatches).set({ status: "published", publishedAt: new Date(), acceptedRows: preview.acceptedRows, warningRows: preview.warningRows, errorRows: preview.errorRows, summary: result }).where(eq(importBatches.id, batch.id));
  await db.insert(auditLogs).values({ entityType: "import_batch", entityId: batch.id, action: "published", afterData: result, actorUserId: input.actorUserId });
  return result;
}

export async function backfillPendingPeriodReconciliations(importBatchId: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const batch = (await db.select().from(importBatches).where(eq(importBatches.id, importBatchId)).limit(1))[0];
  if (!batch || batch.status !== "published") throw new Error("O lote publicado não foi encontrado para reconciliação.");
  const currentCount = (await db.select({ id: pendingPeriodReconciliations.id }).from(pendingPeriodReconciliations).where(eq(pendingPeriodReconciliations.importBatchId, importBatchId))).length;
  if (currentCount) return { created: 0, existing: currentCount };
  const fileResponse = await fetch(await storageGetSignedUrl(batch.storageKey));
  if (!fileResponse.ok) throw new Error("Não foi possível recuperar a planilha publicada para reconciliação.");
  const preview = buildWorkbookPreview(Buffer.from(await fileResponse.arrayBuffer()), Number.MAX_SAFE_INTEGER);
  const [employeeRows, cycleRows] = await Promise.all([
    db.select({ id: employees.id, fullName: employees.fullName }).from(employees),
    db.select({ id: vacationCycles.id, employeeId: vacationCycles.employeeId, reference: vacationCycles.reference }).from(vacationCycles),
  ]);
  const employeeMap = new Map(employeeRows.map(entry => [importKey(entry.fullName), entry.id]));
  const cycleMap = new Map(cycleRows.map(entry => [`${entry.employeeId}:${importKey(entry.reference)}`, entry.id]));
  const pending = preview.vacationPeriods.flatMap(period => {
    const employeeId = employeeMap.get(importKey(period.employeeName));
    const cycleId = employeeId && period.cycleReference ? cycleMap.get(`${employeeId}:${importKey(period.cycleReference)}`) : undefined;
    if (employeeId && cycleId) return [];
    return [{ importBatchId, employeeId: employeeId ?? null, sourceRowNumber: period.rowNumber, sourceCycleReference: period.cycleReference, sourceStartDate: new Date(`${period.startDate}T00:00:00Z`), sourceEndDate: new Date(`${period.endDate}T00:00:00Z`), calendarDays: period.calendarDays, sourceStatus: period.status, rawData: { employeeName: period.employeeName, cycleReference: period.cycleReference, startDate: period.startDate, endDate: period.endDate } }];
  });
  if (pending.length) await db.insert(pendingPeriodReconciliations).values(pending);
  return { created: pending.length, existing: 0 };
}

export async function listPendingPeriodReconciliations() {
  const db = await getDb();
  if (!db) return [];
  const [entries, cycles] = await Promise.all([
    db.select({ id: pendingPeriodReconciliations.id, importBatchId: pendingPeriodReconciliations.importBatchId, employeeId: pendingPeriodReconciliations.employeeId, employeeName: employees.fullName, sourceRowNumber: pendingPeriodReconciliations.sourceRowNumber, sourceCycleReference: pendingPeriodReconciliations.sourceCycleReference, sourceStartDate: pendingPeriodReconciliations.sourceStartDate, sourceEndDate: pendingPeriodReconciliations.sourceEndDate, calendarDays: pendingPeriodReconciliations.calendarDays, sourceStatus: pendingPeriodReconciliations.sourceStatus, status: pendingPeriodReconciliations.status, createdAt: pendingPeriodReconciliations.createdAt }).from(pendingPeriodReconciliations).leftJoin(employees, eq(pendingPeriodReconciliations.employeeId, employees.id)).where(eq(pendingPeriodReconciliations.status, "pending")).orderBy(pendingPeriodReconciliations.sourceStartDate),
    db.select({ id: vacationCycles.id, employeeId: vacationCycles.employeeId, reference: vacationCycles.reference, expirationDate: vacationCycles.expirationDate }).from(vacationCycles),
  ]);
  return entries.map(entry => ({ ...entry, candidateCycles: cycles.filter(cycle => cycle.employeeId === entry.employeeId) }));
}

export async function resolvePendingPeriodReconciliation(input: { reconciliationId: number; vacationCycleId: number; resolutionNote?: string; actorUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const reconciliation = (await db.select().from(pendingPeriodReconciliations).where(eq(pendingPeriodReconciliations.id, input.reconciliationId)).limit(1))[0];
  if (!reconciliation || reconciliation.status !== "pending") throw new Error("Pendência não encontrada ou já tratada.");
  const employeeId = reconciliation.employeeId;
  if (!employeeId) throw new Error("A pendência não possui colaborador reconhecido e precisa de revisão cadastral antes da vinculação.");
  const cycle = (await db.select().from(vacationCycles).where(and(eq(vacationCycles.id, input.vacationCycleId), eq(vacationCycles.employeeId, employeeId))).limit(1))[0];
  if (!cycle) throw new Error("O ciclo selecionado não pertence ao colaborador da pendência.");
  return persistPendingPeriodResolution({ reconciliationId: reconciliation.id, employeeId, cycleEmployeeId: cycle.employeeId, vacationCycleId: cycle.id, sourceStartDate: reconciliation.sourceStartDate, sourceEndDate: reconciliation.sourceEndDate, calendarDays: reconciliation.calendarDays, sourceStatus: reconciliation.sourceStatus, sourceCycleReference: reconciliation.sourceCycleReference, resolutionNote: input.resolutionNote, actorUserId: input.actorUserId }, {
    findDuplicatePeriod: async () => (await db.select({ id: vacationPeriods.id }).from(vacationPeriods).where(and(eq(vacationPeriods.employeeId, employeeId), eq(vacationPeriods.vacationCycleId, cycle.id), eq(vacationPeriods.startDate, new Date(`${reconciliation.sourceStartDate}T00:00:00Z`)), eq(vacationPeriods.endDate, new Date(`${reconciliation.sourceEndDate}T00:00:00Z`)))).limit(1))[0]?.id,
    createVacationPeriod: async () => Number((await db.insert(vacationPeriods).values({ employeeId, vacationCycleId: cycle.id, startDate: new Date(`${reconciliation.sourceStartDate}T00:00:00Z`), endDate: new Date(`${reconciliation.sourceEndDate}T00:00:00Z`), calendarDays: reconciliation.calendarDays, status: reconciliation.sourceStatus, requestedByUserId: input.actorUserId }))[0].insertId),
    addApprovalHistory: async periodId => { await db.insert(approvalHistory).values({ vacationPeriodId: periodId, previousStatus: null, nextStatus: reconciliation.sourceStatus, comment: "Reconciliado de período importado sem ciclo reconhecido.", changedByUserId: input.actorUserId }); },
    updateReconciliation: async resolution => { await db.update(pendingPeriodReconciliations).set(resolution).where(eq(pendingPeriodReconciliations.id, reconciliation.id)); },
    addAuditLog: async audit => { await db.insert(auditLogs).values({ entityType: "pending_period_reconciliation", entityId: reconciliation.id, action: "resolved", beforeData: { status: "pending", sourceCycleReference: reconciliation.sourceCycleReference }, afterData: audit, actorUserId: input.actorUserId }); },
  });
}

export async function dismissPendingPeriodReconciliation(input: { reconciliationId: number; resolutionNote: string; actorUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const reconciliation = (await db.select().from(pendingPeriodReconciliations).where(eq(pendingPeriodReconciliations.id, input.reconciliationId)).limit(1))[0];
  if (!reconciliation || reconciliation.status !== "pending") throw new Error("Pendência não encontrada ou já tratada.");
  const dismissal = buildPendingPeriodDismissal(input);
  const resolvedAt = new Date();
  await db.update(pendingPeriodReconciliations).set({ status: dismissal.status, resolvedVacationPeriodId: dismissal.resolvedVacationPeriodId, resolutionNote: dismissal.resolutionNote, resolvedByUserId: dismissal.resolvedByUserId, resolvedAt }).where(eq(pendingPeriodReconciliations.id, reconciliation.id));
  await db.insert(auditLogs).values({ entityType: "pending_period_reconciliation", entityId: reconciliation.id, action: "dismissed", beforeData: { status: "pending", sourceCycleReference: reconciliation.sourceCycleReference }, afterData: { status: "dismissed", resolutionNote: dismissal.resolutionNote }, actorUserId: input.actorUserId });
  return { dismissed: true } as const;
}

export async function upsertSystemAlert(input: {
  category: "expiration_soon" | "expiration_overdue" | "pending_request" | "negative_balance" | "conflict" | "data_quality" | "job_failure";
  severity: "info" | "warning" | "high" | "critical";
  employeeId?: number;
  vacationCycleId?: number;
  vacationPeriodId?: number;
  dedupeKey: string;
  title: string;
  description: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const validated = systemAlertInputSchema.parse(input);
  const existing = (await db.select({ id: alerts.id }).from(alerts).where(eq(alerts.dedupeKey, validated.dedupeKey)).limit(1))[0];
  if (existing) {
    await db.update(alerts).set({ title: validated.title, description: validated.description, severity: validated.severity, detectedAt: new Date() }).where(eq(alerts.id, existing.id));
    return false;
  }
  await db.insert(alerts).values({ ...validated });
  return true;
}

export async function listAlerts(filters: {
  status?: "open" | "acknowledged" | "resolved" | "dismissed";
  category?: "expiration_soon" | "expiration_overdue" | "pending_request" | "negative_balance" | "conflict" | "data_quality" | "job_failure";
  severity?: "info" | "warning" | "high" | "critical";
  startDate?: string;
  endDate?: string;
  employeeId?: number;
  jobRoleId?: number;
  operationalGroupId?: number;
  baseId?: number;
} = {}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters.status) conditions.push(eq(alerts.status, filters.status));
  if (filters.category) conditions.push(eq(alerts.category, filters.category));
  if (filters.severity) conditions.push(eq(alerts.severity, filters.severity));
  if (filters.startDate) conditions.push(gte(alerts.detectedAt, new Date(`${filters.startDate}T00:00:00Z`)));
  if (filters.endDate) conditions.push(lte(alerts.detectedAt, new Date(`${filters.endDate}T23:59:59.999Z`)));
  if (filters.employeeId) conditions.push(eq(alerts.employeeId, filters.employeeId));
  if (filters.jobRoleId) conditions.push(eq(employees.jobRoleId, filters.jobRoleId));
  if (filters.operationalGroupId) conditions.push(eq(employees.operationalGroupId, filters.operationalGroupId));
  if (filters.baseId) conditions.push(eq(employees.baseId, filters.baseId));
  return db.select({ id: alerts.id, dedupeKey: alerts.dedupeKey, category: alerts.category, severity: alerts.severity, status: alerts.status, title: alerts.title, description: alerts.description, detectedAt: alerts.detectedAt, handlingNote: alerts.handlingNote, employeeName: employees.fullName }).from(alerts).leftJoin(employees, eq(alerts.employeeId, employees.id)).where(conditions.length ? and(...conditions) : undefined).orderBy(alerts.detectedAt);
}

export async function listAlertsByDedupeKeys(dedupeKeys: string[]) {
  const db = await getDb();
  if (!db || dedupeKeys.length === 0) return [];
  const result = [];
  for (const dedupeKey of dedupeKeys) {
    const entry = (await db.select({ id: alerts.id, dedupeKey: alerts.dedupeKey, category: alerts.category, severity: alerts.severity, title: alerts.title, description: alerts.description, employeeName: employees.fullName }).from(alerts).leftJoin(employees, eq(alerts.employeeId, employees.id)).where(eq(alerts.dedupeKey, dedupeKey)).limit(1))[0];
    if (entry) result.push(entry);
  }
  return result;
}

export async function listNotificationRecipients() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notificationRecipients).orderBy(notificationRecipients.email);
}

export async function listActiveNotificationRecipients() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notificationRecipients).where(eq(notificationRecipients.active, true)).orderBy(notificationRecipients.email);
}

export async function createNotificationRecipient(input: { email: string; name?: string; actorUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const existing = (await db.select().from(notificationRecipients).where(eq(notificationRecipients.email, input.email)).limit(1))[0];
  if (existing) throw new Error("Este destinatário já está cadastrado.");
  const result = await db.insert(notificationRecipients).values({ email: input.email, name: input.name || null, createdByUserId: input.actorUserId });
  const id = Number(result[0].insertId);
  await db.insert(auditLogs).values({ entityType: "notification_recipient", entityId: id, action: "created", afterData: { email: input.email, name: input.name || null }, actorUserId: input.actorUserId });
  return id;
}

export async function updateNotificationRecipientStatus(input: { recipientId: number; active: boolean; actorUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const existing = (await db.select().from(notificationRecipients).where(eq(notificationRecipients.id, input.recipientId)).limit(1))[0];
  if (!existing) throw new Error("Destinatário não encontrado.");
  await db.update(notificationRecipients).set({ active: input.active }).where(eq(notificationRecipients.id, input.recipientId));
  await db.insert(auditLogs).values({ entityType: "notification_recipient", entityId: input.recipientId, action: input.active ? "activated" : "deactivated", beforeData: { active: existing.active }, afterData: { active: input.active }, actorUserId: input.actorUserId });
}

export async function createEmailDelivery(input: { alertId?: number; recipientId: number; notificationType: "alert" | "test" | "weekly_summary"; subject: string; idempotencyKey: string }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const existing = (await db.select({ id: emailDeliveries.id }).from(emailDeliveries).where(eq(emailDeliveries.idempotencyKey, input.idempotencyKey)).limit(1))[0];
  if (existing) return null;
  const result = await db.insert(emailDeliveries).values(input);
  return Number(result[0].insertId);
}

export async function completeEmailDelivery(input: { id: number; status: "sent" | "failed" | "skipped"; resendEmailId?: string; errorSummary?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  await db.update(emailDeliveries).set({ status: input.status, resendEmailId: input.resendEmailId || null, errorSummary: input.errorSummary || null, sentAt: input.status === "sent" ? new Date() : null }).where(eq(emailDeliveries.id, input.id));
}

export async function listRecentEmailDeliveries() {
  const db = await getDb();
  if (!db) return [];
  const entries = await db.select({ id: emailDeliveries.id, notificationType: emailDeliveries.notificationType, subject: emailDeliveries.subject, status: emailDeliveries.status, errorSummary: emailDeliveries.errorSummary, sentAt: emailDeliveries.sentAt, createdAt: emailDeliveries.createdAt, recipientEmail: notificationRecipients.email, recipientName: notificationRecipients.name }).from(emailDeliveries).innerJoin(notificationRecipients, eq(emailDeliveries.recipientId, notificationRecipients.id)).orderBy(emailDeliveries.createdAt);
  return entries.slice(-15).reverse();
}

export async function handleAlert(input: { alertId: number; status: "acknowledged" | "resolved" | "dismissed"; handlingNote?: string; actorUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const existing = (await db.select().from(alerts).where(eq(alerts.id, input.alertId)).limit(1))[0];
  if (!existing) throw new Error("Alerta não encontrado.");
  const now = new Date();
  await db.update(alerts).set({ status: input.status, handlingNote: input.handlingNote || null, handledByUserId: input.actorUserId, acknowledgedAt: input.status === "acknowledged" ? now : existing.acknowledgedAt, resolvedAt: input.status === "resolved" ? now : existing.resolvedAt }).where(eq(alerts.id, input.alertId));
  await db.insert(auditLogs).values({ entityType: "alert", entityId: input.alertId, action: input.status, beforeData: { status: existing.status }, afterData: { status: input.status, handlingNote: input.handlingNote || null }, actorUserId: input.actorUserId });
}

export async function createJobExecutionLog(jobName: string) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const result = await db.insert(jobExecutionLogs).values({ jobName, status: "running" });
  return Number(result[0].insertId);
}

export async function completeJobExecutionLog(input: { id: number; status: "success" | "partial" | "failed"; recordsProcessed: number; alertsCreated: number; alertsUpdated: number; notificationsSent?: number; errorSummary?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const current = (await db.select({ startedAt: jobExecutionLogs.startedAt }).from(jobExecutionLogs).where(eq(jobExecutionLogs.id, input.id)).limit(1))[0];
  const completedAt = new Date();
  const durationMs = current ? calculateExecutionDurationMs(current.startedAt, completedAt) : null;
  await db.update(jobExecutionLogs).set({ status: input.status, completedAt, recordsProcessed: input.recordsProcessed, alertsCreated: input.alertsCreated, alertsUpdated: input.alertsUpdated, notificationsSent: input.notificationsSent ?? 0, errorSummary: input.errorSummary || null, durationMs }).where(eq(jobExecutionLogs.id, input.id));
}

export async function listRecentJobExecutions() {
  const db = await getDb();
  if (!db) return [];
  const executions = await db.select().from(jobExecutionLogs).orderBy(jobExecutionLogs.startedAt);
  return executions.slice(-10).reverse();
}

export async function getJobScheduleByTaskUid(taskUid: string) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(jobSchedules).where(eq(jobSchedules.scheduleCronTaskUid, taskUid)).limit(1))[0];
}

export async function getJobScheduleByName(name: string) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(jobSchedules).where(eq(jobSchedules.name, name)).limit(1))[0];
}

export async function saveJobSchedule(input: { name: string; taskUid: string; cronExpression: string; createdByUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  await db.insert(jobSchedules).values({ name: input.name, scheduleCronTaskUid: input.taskUid, cronExpression: input.cronExpression, createdByUserId: input.createdByUserId }).onDuplicateKeyUpdate({ set: { scheduleCronTaskUid: input.taskUid, cronExpression: input.cronExpression, active: true, createdByUserId: input.createdByUserId } });
}

export async function getDashboardSummary() {
  const db = await getDb();
  const empty = {
    activeEmployees: 0,
    pendingRequests: 0,
    expiringCycles: 0,
    negativeBalanceCycles: 0,
    openAlerts: 0,
    conflictAlerts: 0,
  };
  if (!db) return empty;

  const today = new Date();
  const limit = new Date(today);
  limit.setDate(limit.getDate() + 90);

  const balanceExpression = cycleBalanceExpression();

  const [activeEmployees, pendingRequests, expiringCycles, negativeBalanceCycles, openAlerts, conflictAlerts] = await Promise.all([
    db.select({ value: count() }).from(employees).where(eq(employees.active, true)),
    db.select({ value: count() }).from(vacationPeriods).where(eq(vacationPeriods.status, "requested")),
    db.select({ value: count() }).from(vacationCycles).where(and(
      gte(vacationCycles.expirationDate, today),
      lte(vacationCycles.expirationDate, limit),
    )),
    db.select({ id: vacationCycles.id })
      .from(vacationCycles)
      .leftJoin(vacationPeriods, eq(vacationPeriods.vacationCycleId, vacationCycles.id))
      .groupBy(vacationCycles.id, vacationCycles.entitledDays, vacationCycles.soldDays, vacationCycles.adjustmentDays)
      .having(lt(balanceExpression, 0)),
    db.select({ value: count() }).from(alerts).where(eq(alerts.status, "open")),
    db.select({ value: count() }).from(alerts).where(and(
      eq(alerts.status, "open"),
      eq(alerts.category, "conflict"),
    )),
  ]);

  return {
    activeEmployees: Number(activeEmployees[0]?.value ?? 0),
    pendingRequests: Number(pendingRequests[0]?.value ?? 0),
    expiringCycles: Number(expiringCycles[0]?.value ?? 0),
    negativeBalanceCycles: negativeBalanceCycles.length,
    openAlerts: Number(openAlerts[0]?.value ?? 0),
    conflictAlerts: Number(conflictAlerts[0]?.value ?? 0),
  };
}
