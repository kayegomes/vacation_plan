import { describe, expect, it } from "vitest";
import { buildPendingPeriodDismissal, buildPendingPeriodResolution } from "./reconciliationRules";

describe("regras de reconciliação de períodos", () => {
  it("gera uma resolução auditável quando o ciclo pertence ao colaborador", () => {
    expect(buildPendingPeriodResolution({ reconciliationId: 7, employeeId: 3, cycleEmployeeId: 3, vacationPeriodId: 12, actorUserId: 1, resolutionNote: "Confirmado com RH" })).toEqual({ reconciliationId: 7, status: "resolved", resolvedVacationPeriodId: 12, resolutionNote: "Confirmado com RH", resolvedByUserId: 1 });
  });

  it("bloqueia vínculo com ciclo de outro colaborador ou sem colaborador reconhecido", () => {
    expect(() => buildPendingPeriodResolution({ reconciliationId: 7, employeeId: 3, cycleEmployeeId: 4, vacationPeriodId: 12, actorUserId: 1 })).toThrow("não pertence");
    expect(() => buildPendingPeriodResolution({ reconciliationId: 7, employeeId: null, cycleEmployeeId: 4, vacationPeriodId: 12, actorUserId: 1 })).toThrow("não possui colaborador");
  });

  it("gera descarte auditável apenas com justificativa suficiente", () => {
    expect(buildPendingPeriodDismissal({ reconciliationId: 8, resolutionNote: "Registro duplicado na planilha.", actorUserId: 1 })).toEqual({ reconciliationId: 8, status: "dismissed", resolvedVacationPeriodId: null, resolutionNote: "Registro duplicado na planilha.", resolvedByUserId: 1 });
    expect(() => buildPendingPeriodDismissal({ reconciliationId: 8, resolutionNote: "  ", actorUserId: 1 })).toThrow("justificativa");
  });
});
