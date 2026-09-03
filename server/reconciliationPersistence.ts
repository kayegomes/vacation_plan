import { buildPendingPeriodResolution } from "./reconciliationRules";

type ResolutionInput = {
  reconciliationId: number;
  employeeId: number;
  cycleEmployeeId: number;
  vacationCycleId: number;
  sourceStartDate: Date | string;
  sourceEndDate: Date | string;
  calendarDays: number;
  sourceStatus: "draft" | "requested" | "approved" | "rejected" | "cancelled" | "completed";
  sourceCycleReference: string | null;
  resolutionNote?: string;
  actorUserId: number;
};

type Persistence = {
  findDuplicatePeriod: () => Promise<number | undefined>;
  createVacationPeriod: () => Promise<number>;
  addApprovalHistory: (periodId: number) => Promise<void>;
  updateReconciliation: (input: { status: "resolved"; resolvedVacationPeriodId: number; resolutionNote: string | null; resolvedByUserId: number; resolvedAt: Date }) => Promise<void>;
  addAuditLog: (input: { vacationCycleId: number; vacationPeriodId: number; resolutionNote: string | null }) => Promise<void>;
};

export async function persistPendingPeriodResolution(input: ResolutionInput, persistence: Persistence) {
  const duplicatePeriodId = await persistence.findDuplicatePeriod();
  const periodId = duplicatePeriodId ?? await persistence.createVacationPeriod();
  if (!duplicatePeriodId) await persistence.addApprovalHistory(periodId);
  const resolution = buildPendingPeriodResolution({ reconciliationId: input.reconciliationId, employeeId: input.employeeId, cycleEmployeeId: input.cycleEmployeeId, vacationPeriodId: periodId, actorUserId: input.actorUserId, resolutionNote: input.resolutionNote });
  await persistence.updateReconciliation({ status: resolution.status, resolvedVacationPeriodId: resolution.resolvedVacationPeriodId, resolutionNote: resolution.resolutionNote, resolvedByUserId: resolution.resolvedByUserId, resolvedAt: new Date() });
  await persistence.addAuditLog({ vacationCycleId: input.vacationCycleId, vacationPeriodId: periodId, resolutionNote: resolution.resolutionNote });
  return { vacationPeriodId: periodId, created: !duplicatePeriodId };
}
