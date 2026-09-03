import { z } from "zod";
import { calculateCalendarDays, type PeriodStatus } from "./vacationRules";

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD.")
  .refine(value => !Number.isNaN(new Date(`${value}T00:00:00Z`).valueOf()), "Informe uma data válida.");

const optionalText = (maxLength: number) => z.string().trim().max(maxLength).optional();

export const accessRoleSchema = z.enum(["user", "planner", "approver", "admin"]);
export const vacationStatusSchema = z.enum(["draft", "requested", "approved", "rejected", "cancelled", "completed"]);

export const internalAccountInviteInputSchema = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(320),
  name: z.string().trim().min(2, "Informe o nome.").max(160),
  role: accessRoleSchema,
  origin: z.string().url("Origem inválida."),
});

export const internalLoginInputSchema = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(320),
  password: z.string().min(1, "Informe a senha.").max(256),
});

export const internalPasswordActivationInputSchema = z.object({
  token: z.string().min(32, "Convite inválido.").max(128),
  password: z.string().min(12, "A senha deve ter ao menos 12 caracteres.").max(128),
  confirmation: z.string().min(1, "Confirme a senha."),
}).refine(value => value.password === value.confirmation, { message: "As senhas não coincidem.", path: ["confirmation"] });

export const internalPasswordResetRequestInputSchema = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(320),
  origin: z.string().url("Origem inválida."),
});

export const internalAccountStatusInputSchema = z.object({
  userId: z.number().int().positive(),
  active: z.boolean(),
});

export const internalPasswordChangeInputSchema = z.object({
  currentPassword: z.string().min(1, "Informe a senha atual."),
  password: z.string().min(12, "A senha deve ter ao menos 12 caracteres.").max(128),
  confirmation: z.string().min(1, "Confirme a nova senha."),
}).refine(value => value.password === value.confirmation, { message: "As senhas não coincidem.", path: ["confirmation"] });

export const employeeInputSchema = z.object({
  employeeCode: optionalText(64),
  fullName: z.string().trim().min(3, "Informe o nome completo.").max(180),
  displayName: optionalText(100),
  email: z.string().trim().email("Informe um e-mail válido.").max(320).optional().or(z.literal("")),
  admissionDate: dateSchema.optional(),
  jobRoleId: z.number().int().positive().optional(),
  operationalGroupId: z.number().int().positive().optional(),
  baseId: z.number().int().positive().optional(),
  active: z.boolean().default(true),
  notes: optionalText(4_000),
});

export const employeeUpdateInputSchema = employeeInputSchema.extend({
  employeeId: z.number().int().positive(),
});

export const userRoleUpdateInputSchema = z.object({
  userId: z.number().int().positive(),
  role: accessRoleSchema,
});

export const notificationRecipientInputSchema = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(320),
  name: optionalText(160),
});

export const notificationRecipientStatusInputSchema = z.object({
  recipientId: z.number().int().positive(),
  active: z.boolean(),
});

export const emailTestInputSchema = z.object({
  recipientId: z.number().int().positive(),
});

export const employeeActiveInputSchema = z.object({
  employeeId: z.number().int().positive(),
  active: z.boolean(),
});

export const organizationEntitySchema = z.enum(["jobRole", "operationalGroup", "base"]);

export const organizationEntryInputSchema = z.object({
  entity: organizationEntitySchema,
  name: z.string().trim().min(2, "Informe um nome com pelo menos 2 caracteres.").max(120),
  code: optionalText(24),
  description: optionalText(2_000),
});

export const organizationEntryUpdateInputSchema = organizationEntryInputSchema.extend({
  id: z.number().int().positive(),
});

export const operationalRestrictionInputSchema = z.object({
  operationalGroupId: z.number().int().positive().optional(),
  jobRoleId: z.number().int().positive().optional(),
  baseId: z.number().int().positive().optional(),
  startDate: dateSchema,
  endDate: dateSchema,
  reason: z.string().trim().min(3).max(240),
  blocksApproval: z.boolean().default(true),
  maxConcurrentAbsences: z.number().int().min(1).max(999).optional(),
}).superRefine((input, context) => {
  if (!input.operationalGroupId && !input.jobRoleId && !input.baseId) context.addIssue({ code: z.ZodIssueCode.custom, path: ["operationalGroupId"], message: "Informe ao menos um grupo, cargo ou base para a restrição." });
  if (input.endDate < input.startDate) context.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "A data final deve ser posterior à inicial." });
  if (!input.blocksApproval && !input.maxConcurrentAbsences) context.addIssue({ code: z.ZodIssueCode.custom, path: ["maxConcurrentAbsences"], message: "Defina um bloqueio total ou um limite de ausências simultâneas." });
});

export const operationalRestrictionUpdateInputSchema = operationalRestrictionInputSchema.safeExtend({
  restrictionId: z.number().int().positive(),
});

export const vacationCycleInputSchema = z.object({
  employeeId: z.number().int().positive(),
  reference: z.string().trim().min(4, "Informe a referência do ciclo.").max(32),
  accrualStartDate: dateSchema.optional(),
  accrualEndDate: dateSchema.optional(),
  expirationDate: dateSchema,
  entitledDays: z.number().int().min(1).max(60).default(30),
  soldDays: z.number().int().min(0).max(30).default(0),
  adjustmentDays: z.number().int().min(-30).max(30).default(0),
  exceptionJustification: optionalText(2_000),
}).superRefine((input, context) => {
  if (input.soldDays > input.entitledDays) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["soldDays"], message: "O abono não pode superar o direito do ciclo." });
  }
  if (input.adjustmentDays !== 0 && !input.exceptionJustification?.trim()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["exceptionJustification"], message: "Ajustes de saldo exigem justificativa." });
  }
  if (input.accrualStartDate && input.accrualEndDate && input.accrualEndDate < input.accrualStartDate) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["accrualEndDate"], message: "O fim do período aquisitivo deve ser posterior ao início." });
  }
});

export const vacationCycleUpdateInputSchema = vacationCycleInputSchema.safeExtend({
  vacationCycleId: z.number().int().positive(),
});

export const vacationPeriodInputSchema = z.object({
  employeeId: z.number().int().positive(),
  vacationCycleId: z.number().int().positive(),
  startDate: dateSchema,
  endDate: dateSchema,
  status: vacationStatusSchema.default("draft"),
  exceptionJustification: optionalText(2_000),
}).superRefine((input, context) => {
  try {
    if (calculateCalendarDays(input.startDate, input.endDate) > 60) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "Um período não pode superar 60 dias." });
    }
  } catch {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "A data final não pode ser anterior à data inicial." });
  }
});

export const vacationPeriodUpdateInputSchema = vacationPeriodInputSchema.safeExtend({
  vacationPeriodId: z.number().int().positive(),
});

const validTransitions: Record<PeriodStatus, PeriodStatus[]> = {
  draft: ["requested", "cancelled"],
  requested: ["approved", "rejected", "cancelled"],
  approved: ["completed", "cancelled"],
  rejected: ["draft", "cancelled"],
  cancelled: [],
  completed: [],
};

export function canTransitionVacationStatus(from: PeriodStatus, to: PeriodStatus): boolean {
  return validTransitions[from].includes(to);
}

export const approvalTransitionSchema = z.object({
  vacationPeriodId: z.number().int().positive(),
  fromStatus: vacationStatusSchema,
  toStatus: vacationStatusSchema,
  comment: optionalText(2_000),
}).superRefine((input, context) => {
  if (!canTransitionVacationStatus(input.fromStatus, input.toStatus)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["toStatus"], message: "Esta transição de status não é permitida." });
  }
  if ((input.toStatus === "rejected" || input.toStatus === "cancelled") && !input.comment?.trim()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["comment"], message: "Informe o motivo da rejeição ou cancelamento." });
  }
});

export const vacationPeriodStatusInputSchema = z.object({
  vacationPeriodId: z.number().int().positive(),
  toStatus: vacationStatusSchema,
  comment: optionalText(2_000),
}).superRefine((input, context) => {
  if ((input.toStatus === "rejected" || input.toStatus === "cancelled") && !input.comment?.trim()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["comment"], message: "Informe o motivo da rejeição ou cancelamento." });
  }
});

export const dashboardFilterSchema = z.object({
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  jobRoleId: z.number().int().positive().optional(),
  operationalGroupId: z.number().int().positive().optional(),
  baseId: z.number().int().positive().optional(),
  status: vacationStatusSchema.optional(),
});

export const calendarFilterInputSchema = dashboardFilterSchema.superRefine((input, context) => {
  if (input.startDate && input.endDate && input.endDate < input.startDate) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "A data final do filtro deve ser posterior à inicial." });
  }
});

export const calendarExportInputSchema = calendarFilterInputSchema.safeExtend({
  format: z.enum(["xlsx", "csv"]),
});

export const importWorkbookInputSchema = z.object({
  filename: z.string().trim().min(5).max(255).refine(value => /\.xlsx$/i.test(value), "Envie um arquivo XLSX."),
  fileBase64: z.string().min(20, "O conteúdo do arquivo não foi recebido.").max(30_000_000, "O arquivo excede o limite de 20 MB para prévia."),
});

export const publishImportBatchInputSchema = z.object({
  batchId: z.number().int().positive(),
  confirm: z.literal(true),
});

export const pendingPeriodResolutionInputSchema = z.object({
  reconciliationId: z.number().int().positive(),
  vacationCycleId: z.number().int().positive(),
  resolutionNote: optionalText(2_000),
});

export const pendingPeriodDismissalInputSchema = z.object({
  reconciliationId: z.number().int().positive(),
  resolutionNote: z.string().trim().min(3, "Informe a justificativa do descarte.").max(2_000),
});

export const alertActionInputSchema = z.object({
  alertId: z.number().int().positive(),
  status: z.enum(["acknowledged", "resolved", "dismissed"]),
  handlingNote: optionalText(2_000),
}).superRefine((input, context) => {
  if (input.status === "resolved" && !input.handlingNote?.trim()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["handlingNote"], message: "Informe como o alerta foi resolvido." });
  }
});

export const alertCategorySchema = z.enum(["expiration_soon", "expiration_overdue", "pending_request", "negative_balance", "conflict", "data_quality", "job_failure"]);
export const alertSeveritySchema = z.enum(["info", "warning", "high", "critical"]);
export const alertStatusSchema = z.enum(["open", "acknowledged", "resolved", "dismissed"]);

export const alertFilterInputSchema = z.object({
  status: alertStatusSchema.optional(),
  category: alertCategorySchema.optional(),
  severity: alertSeveritySchema.optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  employeeId: z.number().int().positive().optional(),
  jobRoleId: z.number().int().positive().optional(),
  operationalGroupId: z.number().int().positive().optional(),
  baseId: z.number().int().positive().optional(),
}).superRefine((input, context) => {
  if (input.startDate && input.endDate && input.endDate < input.startDate) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "A data final do filtro deve ser posterior à inicial." });
  }
});

export const systemAlertInputSchema = z.object({
  category: alertCategorySchema,
  severity: alertSeveritySchema,
  employeeId: z.number().int().positive().optional(),
  vacationCycleId: z.number().int().positive().optional(),
  vacationPeriodId: z.number().int().positive().optional(),
  dedupeKey: z.string().trim().min(5).max(255),
  title: z.string().trim().min(3).max(240),
  description: z.string().trim().min(3).max(10_000),
});
