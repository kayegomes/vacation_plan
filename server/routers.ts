import { COOKIE_NAME } from "@shared/const";
import { parse as parseCookie } from "cookie";
import { TRPCError } from "@trpc/server";
import { activateInternalAccount, backfillPendingPeriodReconciliations, completeJobExecutionLog, createEmployee, createImportBatch, createInternalAccountInvite, createJobExecutionLog, createNotificationRecipient, createOperationalRestriction, createOrganizationEntry, createVacationCycle, createVacationPeriod, dismissPendingPeriodReconciliation, getDashboardSummary, getInternalUserByEmail, getJobScheduleByName, handleAlert, listAlerts, listCalendarEntries, listEmployees, listNotificationRecipients, listOperationalRestrictions, listOrganizationEntries, listPendingPeriodReconciliations, listRecentEmailDeliveries, listRecentJobExecutions, listSystemUsers, listVacationCyclesWithBalances, listVacationPeriodsWithDetails, publishImportBatch, resolvePendingPeriodReconciliation, saveJobSchedule, transitionVacationPeriodStatus, updateEmployee, updateEmployeeActiveStatus, updateNotificationRecipientStatus, updateOperationalRestriction, updateOrganizationEntry, updateSystemUserRole, updateVacationCycle, updateVacationPeriod } from "./db";
import { createInternalPasswordReset } from "./db";
import { updateInternalAccountStatus } from "./db";
import { changeInternalPassword } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { alertActionInputSchema, alertFilterInputSchema, calendarExportInputSchema, calendarFilterInputSchema, emailTestInputSchema, employeeActiveInputSchema, employeeInputSchema, employeeUpdateInputSchema, importWorkbookInputSchema, internalAccountInviteInputSchema, internalLoginInputSchema, internalPasswordActivationInputSchema, notificationRecipientInputSchema, notificationRecipientStatusInputSchema, operationalRestrictionInputSchema, operationalRestrictionUpdateInputSchema, organizationEntitySchema, organizationEntryInputSchema, organizationEntryUpdateInputSchema, pendingPeriodDismissalInputSchema, pendingPeriodResolutionInputSchema, publishImportBatchInputSchema, userRoleUpdateInputSchema, vacationCycleInputSchema, vacationCycleUpdateInputSchema, vacationPeriodInputSchema, vacationPeriodStatusInputSchema, vacationPeriodUpdateInputSchema } from "./vacationSchemas";
import { internalPasswordResetRequestInputSchema } from "./vacationSchemas";
import { internalAccountStatusInputSchema } from "./vacationSchemas";
import { internalPasswordChangeInputSchema } from "./vacationSchemas";
import { calculateCalendarDays } from "./vacationRules";
import { buildWorkbookPreview } from "./importVacationWorkbook";
import { storagePut } from "./storage";
import { inspectVacationPlanning, notifyDailyCheckFailure } from "./dailyVacationCheck";
import { createHeartbeatJob } from "./_core/heartbeat";
import { buildCalendarExport } from "./exportVacationData";
import { isEmailConfigured, sendInternalAccountInvite, sendTestEmail } from "./emailNotifications";
import { sendInternalPasswordReset } from "./emailNotifications";
import { normalizeScheduleResult } from "./automationSchedule";
import { createInternalSession, createRawAccountToken, hashAccountToken, hashPassword, INTERNAL_SESSION_COOKIE, normalizeEmail, verifyPassword } from "./internalAuth";

const plannerProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role === "planner" || ctx.user.role === "admin") return next();
  throw new TRPCError({ code: "FORBIDDEN", message: "Seu perfil não possui permissão para planejar férias." });
});

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role === "admin") return next();
  throw new TRPCError({ code: "FORBIDDEN", message: "Seu perfil não possui permissão administrativa." });
});

const approverProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role === "approver" || ctx.user.role === "admin") return next();
  throw new TRPCError({ code: "FORBIDDEN", message: "Seu perfil não possui permissão para aprovar férias." });
});

const alertHandlerProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role === "planner" || ctx.user.role === "approver" || ctx.user.role === "admin") return next();
  throw new TRPCError({ code: "FORBIDDEN", message: "Seu perfil não possui permissão para tratar alertas." });
});

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      ctx.res.clearCookie(INTERNAL_SESSION_COOKIE, { ...cookieOptions, sameSite: "lax", maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    internalLogin: publicProcedure.input(internalLoginInputSchema).mutation(async ({ ctx, input }) => {
      const user = await getInternalUserByEmail(normalizeEmail(input.email));
      if (!user || !(await verifyPassword(input.password, user.passwordHash))) throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha inválidos." });
      const token = await createInternalSession(user.id);
      ctx.res.cookie(INTERNAL_SESSION_COOKIE, token, { ...getSessionCookieOptions(ctx.req), sameSite: "lax", maxAge: 60 * 60 * 8 });
      return { success: true } as const;
    }),
    requestPasswordReset: publicProcedure.input(internalPasswordResetRequestInputSchema).mutation(async ({ input }) => {
      const rawToken = createRawAccountToken();
      const account = await createInternalPasswordReset({ email: normalizeEmail(input.email), tokenHash: hashAccountToken(rawToken), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
      if (account) {
        const resetUrl = `${input.origin.replace(/\/$/, "")}/ativar-conta?token=${encodeURIComponent(rawToken)}`;
        await sendInternalPasswordReset({ email: input.email, name: account.name || "Pessoa usuária", resetUrl });
      }
      return { success: true } as const;
    }),
    changeInternalPassword: protectedProcedure.input(internalPasswordChangeInputSchema).mutation(async ({ ctx, input }) => {
      const account = await getInternalUserByEmail(normalizeEmail(ctx.user.email || ""));
      if (!account || !(await verifyPassword(input.currentPassword, account.passwordHash))) throw new TRPCError({ code: "UNAUTHORIZED", message: "A senha atual não confere." });
      await changeInternalPassword(ctx.user.id, await hashPassword(input.password));
      return { success: true } as const;
    }),
    activateInternalAccount: publicProcedure.input(internalPasswordActivationInputSchema).mutation(async ({ ctx, input }) => {
      const user = await activateInternalAccount({ tokenHash: hashAccountToken(input.token), passwordHash: await hashPassword(input.password) });
      if (!user) throw new TRPCError({ code: "BAD_REQUEST", message: "Não foi possível ativar esta conta." });
      const session = await createInternalSession(user.id);
      ctx.res.cookie(INTERNAL_SESSION_COOKIE, session, { ...getSessionCookieOptions(ctx.req), sameSite: "lax", maxAge: 60 * 60 * 8 });
      return { success: true } as const;
    }),
    inviteInternalAccount: adminProcedure.input(internalAccountInviteInputSchema).mutation(async ({ ctx, input }) => {
      const rawToken = createRawAccountToken();
      const account = await createInternalAccountInvite({ email: normalizeEmail(input.email), name: input.name, role: input.role, tokenHash: hashAccountToken(rawToken), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), actorUserId: ctx.user.id });
      const inviteUrl = `${input.origin.replace(/\/$/, "")}/ativar-conta?token=${encodeURIComponent(rawToken)}`;
      await sendInternalAccountInvite({ email: input.email, name: account.name || input.name, inviteUrl });
      return { success: true } as const;
    }),
  }),
  dashboard: router({
    summary: protectedProcedure.query(async () => getDashboardSummary()),
  }),
  organization: router({
    list: protectedProcedure.input(organizationEntitySchema).query(({ input }) => listOrganizationEntries(input)),
    create: adminProcedure.input(organizationEntryInputSchema).mutation(async ({ ctx, input }) => {
      await createOrganizationEntry({ ...input, actorUserId: ctx.user.id });
      return { success: true } as const;
    }),
    update: adminProcedure.input(organizationEntryUpdateInputSchema).mutation(async ({ ctx, input }) => {
      await updateOrganizationEntry({ ...input, actorUserId: ctx.user.id });
      return { success: true } as const;
    }),
  }),
  employees: router({
    list: protectedProcedure.query(async () => listEmployees()),
    create: plannerProcedure.input(employeeInputSchema).mutation(async ({ ctx, input }) => {
      await createEmployee({ ...input, actorUserId: ctx.user.id });
      return { success: true } as const;
    }),
    update: plannerProcedure.input(employeeUpdateInputSchema).mutation(async ({ ctx, input }) => {
      await updateEmployee({ ...input, actorUserId: ctx.user.id });
      return { success: true } as const;
    }),
    setActive: plannerProcedure.input(employeeActiveInputSchema).mutation(async ({ ctx, input }) => {
      await updateEmployeeActiveStatus(input.employeeId, input.active, ctx.user.id);
      return { success: true } as const;
    }),
  }),
  access: router({
    listUsers: adminProcedure.query(() => listSystemUsers()),
    updateRole: adminProcedure.input(userRoleUpdateInputSchema).mutation(async ({ ctx, input }) => {
      await updateSystemUserRole(input.userId, input.role, ctx.user.id);
      return { success: true } as const;
    }),
    updateInternalAccountStatus: adminProcedure.input(internalAccountStatusInputSchema).mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id && !input.active) throw new TRPCError({ code: "BAD_REQUEST", message: "Não é possível suspender a própria conta." });
      await updateInternalAccountStatus(input.userId, input.active, ctx.user.id);
      return { success: true } as const;
    }),
  }),
  restrictions: router({
    list: protectedProcedure.query(() => listOperationalRestrictions()),
    create: adminProcedure.input(operationalRestrictionInputSchema).mutation(async ({ ctx, input }) => {
      const id = await createOperationalRestriction({ ...input, actorUserId: ctx.user.id });
      return { id };
    }),
    update: adminProcedure.input(operationalRestrictionUpdateInputSchema).mutation(async ({ ctx, input }) => {
      await updateOperationalRestriction({ ...input, actorUserId: ctx.user.id });
      return { success: true } as const;
    }),
  }),
  vacations: router({
    cycles: protectedProcedure.query(async () => listVacationCyclesWithBalances()),
    periods: protectedProcedure.query(async () => listVacationPeriodsWithDetails()),
    createCycle: plannerProcedure.input(vacationCycleInputSchema).mutation(async ({ ctx, input }) => {
      await createVacationCycle({ ...input, actorUserId: ctx.user.id });
      return { success: true } as const;
    }),
    updateCycle: plannerProcedure.input(vacationCycleUpdateInputSchema).mutation(async ({ ctx, input }) => {
      await updateVacationCycle({ ...input, actorUserId: ctx.user.id });
      return { success: true } as const;
    }),
    createPeriod: plannerProcedure.input(vacationPeriodInputSchema).mutation(async ({ ctx, input }) => {
      if (input.status !== "draft" && input.status !== "requested") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Novos períodos devem começar como rascunho ou solicitação." });
      }
      await createVacationPeriod({
        ...input,
        calendarDays: calculateCalendarDays(input.startDate, input.endDate),
        requestedByUserId: ctx.user.id,
      });
      return { success: true } as const;
    }),
    updatePeriod: plannerProcedure.input(vacationPeriodUpdateInputSchema).mutation(async ({ ctx, input }) => {
      await updateVacationPeriod({ ...input, calendarDays: calculateCalendarDays(input.startDate, input.endDate), actorUserId: ctx.user.id });
      return { success: true } as const;
    }),
    sendForApproval: plannerProcedure.input(vacationPeriodStatusInputSchema).mutation(async ({ ctx, input }) => {
      if (input.toStatus !== "requested") throw new TRPCError({ code: "BAD_REQUEST", message: "Esta ação deve enviar o período para aprovação." });
      await transitionVacationPeriodStatus({ ...input, actorUserId: ctx.user.id });
      return { success: true } as const;
    }),
    decide: approverProcedure.input(vacationPeriodStatusInputSchema).mutation(async ({ ctx, input }) => {
      if (input.toStatus !== "approved" && input.toStatus !== "rejected") throw new TRPCError({ code: "BAD_REQUEST", message: "A decisão deve aprovar ou rejeitar o período." });
      await transitionVacationPeriodStatus({ ...input, actorUserId: ctx.user.id });
      return { success: true } as const;
    }),
    cancel: plannerProcedure.input(vacationPeriodStatusInputSchema).mutation(async ({ ctx, input }) => {
      if (input.toStatus !== "cancelled") throw new TRPCError({ code: "BAD_REQUEST", message: "Esta ação deve cancelar o período." });
      await transitionVacationPeriodStatus({ ...input, actorUserId: ctx.user.id });
      return { success: true } as const;
    }),
    complete: plannerProcedure.input(vacationPeriodStatusInputSchema).mutation(async ({ ctx, input }) => {
      if (input.toStatus !== "completed") throw new TRPCError({ code: "BAD_REQUEST", message: "Esta ação deve concluir o período." });
      await transitionVacationPeriodStatus({ ...input, actorUserId: ctx.user.id });
      return { success: true } as const;
    }),
  }),
  calendar: router({
    list: protectedProcedure.input(calendarFilterInputSchema).query(({ input }) => listCalendarEntries(input)),
  }),
  exports: router({
    calendar: protectedProcedure.input(calendarExportInputSchema).mutation(async ({ input }) => {
      const { format, ...filters } = input;
      const entries = await listCalendarEntries(filters);
      const exportFile = buildCalendarExport(entries, format);
      const encoded = format === "csv" ? Buffer.from(exportFile.content, "utf-8").toString("base64") : exportFile.content;
      return { fileBase64: encoded, contentType: exportFile.contentType, filename: `calendario-ferias-${new Date().toISOString().slice(0, 10)}.${exportFile.extension}` };
    }),
  }),
  alerts: router({
    list: protectedProcedure.input(alertFilterInputSchema).query(async ({ input }) => listAlerts(input)),
    handle: alertHandlerProcedure.input(alertActionInputSchema).mutation(async ({ ctx, input }) => {
      await handleAlert({ ...input, actorUserId: ctx.user.id });
      return { success: true } as const;
    }),
  }),
  emailNotifications: router({
    configuration: adminProcedure.query(async () => ({ configured: isEmailConfigured(), recipients: await listNotificationRecipients(), deliveries: await listRecentEmailDeliveries() })),
    addRecipient: adminProcedure.input(notificationRecipientInputSchema).mutation(async ({ ctx, input }) => {
      const recipientId = await createNotificationRecipient({ ...input, actorUserId: ctx.user.id });
      return { recipientId };
    }),
    setRecipientStatus: adminProcedure.input(notificationRecipientStatusInputSchema).mutation(async ({ ctx, input }) => {
      await updateNotificationRecipientStatus({ ...input, actorUserId: ctx.user.id });
      return { success: true } as const;
    }),
    sendTest: adminProcedure.input(emailTestInputSchema).mutation(async ({ input }) => ({ result: await sendTestEmail(input.recipientId) })),
  }),
  automation: router({
    recentExecutions: adminProcedure.query(() => listRecentJobExecutions()),
    runDailyCheckNow: adminProcedure.mutation(async () => {
      const executionId = await createJobExecutionLog("daily-vacation-check-manual");
      try {
        const result = await inspectVacationPlanning();
        await completeJobExecutionLog({ id: executionId, status: result.notificationsFailed ? "partial" : "success", ...result });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha desconhecida";
        const notification = await notifyDailyCheckFailure(message);
        await completeJobExecutionLog({ id: executionId, status: "failed", recordsProcessed: 0, alertsCreated: notification.created ? 1 : 0, alertsUpdated: notification.created ? 0 : 1, notificationsSent: notification.sent, errorSummary: message });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
      }
    }),
    dailyCheckSchedule: adminProcedure.query(async () => normalizeScheduleResult(await getJobScheduleByName("daily-vacation-check"))),
    scheduleDailyCheck: adminProcedure.mutation(async ({ ctx }) => {
      const existing = await getJobScheduleByName("daily-vacation-check");
      if (existing?.scheduleCronTaskUid) return { taskUid: existing.scheduleCronTaskUid, alreadyScheduled: true } as const;
      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      if (!sessionToken) throw new TRPCError({ code: "UNAUTHORIZED", message: "Não foi possível criar o agendamento sem uma sessão válida." });
      const job = await createHeartbeatJob({ name: "daily-vacation-check", cron: "0 0 9 * * *", path: "/api/scheduled/daily-vacation-check", description: "Verificação diária de vencimentos, pendências, saldos e conflitos de férias." }, sessionToken);
      await saveJobSchedule({ name: "daily-vacation-check", taskUid: job.taskUid, cronExpression: "0 0 9 * * *", createdByUserId: ctx.user.id });
      return { taskUid: job.taskUid, alreadyScheduled: false, nextExecutionAt: job.nextExecutionAt } as const;
    }),
  }),
  reconciliation: router({
    listPending: plannerProcedure.query(() => listPendingPeriodReconciliations()),
    resolve: plannerProcedure.input(pendingPeriodResolutionInputSchema).mutation(async ({ ctx, input }) => resolvePendingPeriodReconciliation({ ...input, actorUserId: ctx.user.id })),
    dismiss: plannerProcedure.input(pendingPeriodDismissalInputSchema).mutation(async ({ ctx, input }) => dismissPendingPeriodReconciliation({ ...input, actorUserId: ctx.user.id })),
    backfillPublishedBatch: adminProcedure.input(publishImportBatchInputSchema).mutation(async ({ input }) => backfillPendingPeriodReconciliations(input.batchId)),
  }),
  imports: router({
    previewWorkbook: adminProcedure.input(importWorkbookInputSchema).mutation(async ({ ctx, input }) => {
      const content = Buffer.from(input.fileBase64, "base64");
      if (!content.length || content.length > 20 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "O arquivo deve ter no máximo 20 MB." });
      let preview;
      try {
        preview = buildWorkbookPreview(content);
      } catch {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Não foi possível ler este arquivo XLSX. Verifique se ele não está corrompido ou protegido." });
      }
      const safeFilename = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
      const stored = await storagePut(`imports/${ctx.user.id}/${Date.now()}-${safeFilename}`, content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      const batchId = await createImportBatch({ originalFilename: input.filename, storageKey: stored.key, storageUrl: stored.url, createdByUserId: ctx.user.id, preview });
      return { batchId, fileUrl: stored.url, ...preview };
    }),
    publishBatch: adminProcedure.input(publishImportBatchInputSchema).mutation(async ({ ctx, input }) => {
      return publishImportBatch({ batchId: input.batchId, actorUserId: ctx.user.id });
    }),
  }),
});

export type AppRouter = typeof appRouter;
