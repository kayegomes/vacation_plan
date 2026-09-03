export function buildPendingPeriodResolution(input: { reconciliationId: number; employeeId: number | null; cycleEmployeeId: number; vacationPeriodId: number; actorUserId: number; resolutionNote?: string }) {
  if (!input.employeeId) throw new Error("A pendência não possui colaborador reconhecido e precisa de revisão cadastral antes da vinculação.");
  if (input.employeeId !== input.cycleEmployeeId) throw new Error("O ciclo selecionado não pertence ao colaborador da pendência.");
  return {
    reconciliationId: input.reconciliationId,
    status: "resolved" as const,
    resolvedVacationPeriodId: input.vacationPeriodId,
    resolutionNote: input.resolutionNote || null,
    resolvedByUserId: input.actorUserId,
  };
}

export function buildPendingPeriodDismissal(input: { reconciliationId: number; resolutionNote: string; actorUserId: number }) {
  const resolutionNote = input.resolutionNote.trim();
  if (resolutionNote.length < 3) throw new Error("Informe a justificativa do descarte.");
  return {
    reconciliationId: input.reconciliationId,
    status: "dismissed" as const,
    resolvedVacationPeriodId: null,
    resolutionNote,
    resolvedByUserId: input.actorUserId,
  };
}
