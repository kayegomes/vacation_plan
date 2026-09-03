import { describe, expect, it } from "vitest";
import {
  alertActionInputSchema,
  alertFilterInputSchema,
  approvalTransitionSchema,
  canTransitionVacationStatus,
  emailTestInputSchema,
  internalPasswordResetRequestInputSchema,
  internalPasswordChangeInputSchema,
  notificationRecipientInputSchema,
  pendingPeriodDismissalInputSchema,
  pendingPeriodResolutionInputSchema,
  operationalRestrictionInputSchema,
  systemAlertInputSchema,
  vacationCycleInputSchema,
  vacationPeriodInputSchema,
} from "./vacationSchemas";

describe("validações de entradas de férias", () => {
  it("exige justificativa para ajuste de saldo", () => {
    const result = vacationCycleInputSchema.safeParse({
      employeeId: 1,
      reference: "2026/2027",
      expirationDate: "2027-03-31",
      entitledDays: 30,
      soldDays: 0,
      adjustmentDays: -2,
    });
    expect(result.success).toBe(false);
  });

  it("rejeita abono acima do direito do ciclo", () => {
    const result = vacationCycleInputSchema.safeParse({
      employeeId: 1,
      reference: "2026/2027",
      expirationDate: "2027-03-31",
      entitledDays: 20,
      soldDays: 25,
      adjustmentDays: 0,
    });
    expect(result.success).toBe(false);
  });

  it("impede período com data final anterior à inicial", () => {
    const result = vacationPeriodInputSchema.safeParse({
      employeeId: 1,
      vacationCycleId: 1,
      startDate: "2026-06-10",
      endDate: "2026-06-09",
    });
    expect(result.success).toBe(false);
  });

  it("permite somente transições de aprovação previstas", () => {
    expect(canTransitionVacationStatus("requested", "approved")).toBe(true);
    expect(canTransitionVacationStatus("approved", "requested")).toBe(false);
    expect(approvalTransitionSchema.safeParse({
      vacationPeriodId: 1,
      fromStatus: "requested",
      toStatus: "rejected",
    }).success).toBe(false);
  });

  it("exige descrição de resolução para alertas resolvidos", () => {
    expect(alertActionInputSchema.safeParse({ alertId: 1, status: "resolved" }).success).toBe(false);
    expect(alertActionInputSchema.safeParse({ alertId: 1, status: "resolved", handlingNote: "Cobertura replanejada." }).success).toBe(true);
  });

  it("rejeita recorte de alertas com datas invertidas", () => {
    expect(alertFilterInputSchema.safeParse({ startDate: "2026-09-10", endDate: "2026-09-09" }).success).toBe(false);
    expect(alertFilterInputSchema.safeParse({ status: "open", category: "conflict", severity: "high", employeeId: 1, baseId: 2 }).success).toBe(true);
  });

  it("valida a estrutura técnica de alertas gerados pela rotina", () => {
    expect(systemAlertInputSchema.safeParse({ category: "conflict", severity: "high", dedupeKey: "period-conflict-1-2", title: "Sobreposição identificada", description: "Duas pessoas estão ausentes no mesmo período." }).success).toBe(true);
    expect(systemAlertInputSchema.safeParse({ category: "conflict", severity: "high", dedupeKey: "x", title: "x", description: "x" }).success).toBe(false);
  });

  it("exige escopo e bloqueio ou limite de capacidade para restrições operacionais", () => {
    expect(operationalRestrictionInputSchema.safeParse({ startDate: "2026-07-01", endDate: "2026-07-10", reason: "Plantão crítico", blocksApproval: true }).success).toBe(false);
    expect(operationalRestrictionInputSchema.safeParse({ baseId: 1, startDate: "2026-07-01", endDate: "2026-07-10", reason: "Plantão crítico", blocksApproval: false }).success).toBe(false);
    expect(operationalRestrictionInputSchema.safeParse({ baseId: 1, startDate: "2026-07-01", endDate: "2026-07-10", reason: "Plantão crítico", blocksApproval: false, maxConcurrentAbsences: 2 }).success).toBe(true);
  });

  it("valida destinatário e teste de e-mail administrativo", () => {
    expect(notificationRecipientInputSchema.safeParse({ email: "RH@VALEESSA.COM", name: "Equipe de RH" }).success).toBe(true);
    expect(notificationRecipientInputSchema.safeParse({ email: "invalido" }).success).toBe(false);
    expect(emailTestInputSchema.safeParse({ recipientId: 1 }).success).toBe(true);
    expect(emailTestInputSchema.safeParse({ recipientId: 0 }).success).toBe(false);
  });

  it("valida o vínculo assistido entre período pendente e ciclo", () => {
    expect(pendingPeriodResolutionInputSchema.safeParse({ reconciliationId: 4, vacationCycleId: 9, resolutionNote: "Conferido com RH." }).success).toBe(true);
    expect(pendingPeriodResolutionInputSchema.safeParse({ reconciliationId: 0, vacationCycleId: 9 }).success).toBe(false);
    expect(pendingPeriodResolutionInputSchema.safeParse({ reconciliationId: 4, vacationCycleId: 0 }).success).toBe(false);
  });

  it("exige justificativa antes de descartar período pendente", () => {
    expect(pendingPeriodDismissalInputSchema.safeParse({ reconciliationId: 4, resolutionNote: "" }).success).toBe(false);
    expect(pendingPeriodDismissalInputSchema.safeParse({ reconciliationId: 4, resolutionNote: "Não corresponde ao ciclo informado." }).success).toBe(true);
  });

  it("valida e-mail e origem antes da redefinição de senha", () => {
    expect(internalPasswordResetRequestInputSchema.safeParse({ email: "conta@example.com", origin: "https://ferias.example.com" }).success).toBe(true);
    expect(internalPasswordResetRequestInputSchema.safeParse({ email: "conta-invalida", origin: "https://ferias.example.com" }).success).toBe(false);
    expect(internalPasswordResetRequestInputSchema.safeParse({ email: "conta@example.com", origin: "origem-inválida" }).success).toBe(false);
  });

  it("exige senha atual e confirmação para a troca autenticada", () => {
    expect(internalPasswordChangeInputSchema.safeParse({ currentPassword: "atual-segura", password: "nova-senha-segura", confirmation: "nova-senha-segura" }).success).toBe(true);
    expect(internalPasswordChangeInputSchema.safeParse({ currentPassword: "", password: "nova-senha-segura", confirmation: "nova-senha-segura" }).success).toBe(false);
    expect(internalPasswordChangeInputSchema.safeParse({ currentPassword: "atual-segura", password: "curta", confirmation: "curta" }).success).toBe(false);
    expect(internalPasswordChangeInputSchema.safeParse({ currentPassword: "atual-segura", password: "nova-senha-segura", confirmation: "diferente" }).success).toBe(false);
  });
});
