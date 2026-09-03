import { describe, expect, it, vi } from "vitest";
import { persistPendingPeriodResolution } from "./reconciliationPersistence";

describe("persistência da reconciliação", () => {
  it("cria o período, registra histórico, resolve a pendência e audita a operação", async () => {
    const persistence = { findDuplicatePeriod: vi.fn().mockResolvedValue(undefined), createVacationPeriod: vi.fn().mockResolvedValue(19), addApprovalHistory: vi.fn().mockResolvedValue(undefined), updateReconciliation: vi.fn().mockResolvedValue(undefined), addAuditLog: vi.fn().mockResolvedValue(undefined) };
    const result = await persistPendingPeriodResolution({ reconciliationId: 4, employeeId: 2, cycleEmployeeId: 2, vacationCycleId: 8, sourceStartDate: "2026-01-10", sourceEndDate: "2026-01-20", calendarDays: 11, sourceStatus: "approved", sourceCycleReference: "2025/2026", resolutionNote: "Confirmado com RH", actorUserId: 1 }, persistence);
    expect(result).toEqual({ vacationPeriodId: 19, created: true });
    expect(persistence.addApprovalHistory).toHaveBeenCalledWith(19);
    expect(persistence.updateReconciliation).toHaveBeenCalledWith(expect.objectContaining({ status: "resolved", resolvedVacationPeriodId: 19, resolvedByUserId: 1 }));
    expect(persistence.addAuditLog).toHaveBeenCalledWith({ vacationCycleId: 8, vacationPeriodId: 19, resolutionNote: "Confirmado com RH" });
  });

  it("preserva o período existente e ainda resolve e audita a pendência", async () => {
    const persistence = { findDuplicatePeriod: vi.fn().mockResolvedValue(11), createVacationPeriod: vi.fn(), addApprovalHistory: vi.fn(), updateReconciliation: vi.fn().mockResolvedValue(undefined), addAuditLog: vi.fn().mockResolvedValue(undefined) };
    const result = await persistPendingPeriodResolution({ reconciliationId: 4, employeeId: 2, cycleEmployeeId: 2, vacationCycleId: 8, sourceStartDate: "2026-01-10", sourceEndDate: "2026-01-20", calendarDays: 11, sourceStatus: "approved", sourceCycleReference: "2025/2026", actorUserId: 1 }, persistence);
    expect(result).toEqual({ vacationPeriodId: 11, created: false });
    expect(persistence.createVacationPeriod).not.toHaveBeenCalled();
    expect(persistence.addApprovalHistory).not.toHaveBeenCalled();
    expect(persistence.updateReconciliation).toHaveBeenCalledWith(expect.objectContaining({ status: "resolved", resolvedVacationPeriodId: 11 }));
  });
});
