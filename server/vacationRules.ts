export type PeriodStatus = "draft" | "requested" | "approved" | "rejected" | "cancelled" | "completed";

type VacationRange = {
  startDate: string;
  endDate: string;
};

type BalanceInput = {
  entitledDays: number;
  soldDays: number;
  adjustmentDays: number;
  periods: Array<VacationRange & { calendarDays: number; status: PeriodStatus }>;
};

function parseDate(value: string): number {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.valueOf()) || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Data inválida. Use o formato AAAA-MM-DD.");
  }
  return date.valueOf();
}

export function calculateCalendarDays(startDate: string, endDate: string): number {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (end < start) throw new Error("A data final não pode ser anterior à data inicial.");
  return Math.floor((end - start) / 86_400_000) + 1;
}

export function rangesOverlap(first: VacationRange, second: VacationRange): boolean {
  const firstStart = parseDate(first.startDate);
  const firstEnd = parseDate(first.endDate);
  const secondStart = parseDate(second.startDate);
  const secondEnd = parseDate(second.endDate);
  if (firstEnd < firstStart || secondEnd < secondStart) {
    throw new Error("Não é possível comparar períodos com datas inválidas.");
  }
  return firstStart <= secondEnd && secondStart <= firstEnd;
}

export function calculateCycleBalance({ entitledDays, soldDays, adjustmentDays, periods }: BalanceInput): number {
  const usedDays = periods
    .filter(period => period.status === "approved" || period.status === "completed")
    .reduce((total, period) => total + period.calendarDays, 0);
  return entitledDays - soldDays + adjustmentDays - usedDays;
}

export function meetsMinimumContinuousPeriod(periods: VacationRange[], minimumDays = 14): boolean {
  return periods.some(period => calculateCalendarDays(period.startDate, period.endDate) >= minimumDays);
}

export function exceedsConcurrentAbsenceLimit(proposed: VacationRange, approvedRanges: VacationRange[], maximumAbsences: number): boolean {
  if (!Number.isInteger(maximumAbsences) || maximumAbsences < 1) throw new Error("O limite de ausências deve ser um número inteiro maior que zero.");
  const start = parseDate(proposed.startDate);
  const end = parseDate(proposed.endDate);
  if (end < start) throw new Error("A data final não pode ser anterior à data inicial.");
  for (let current = start; current <= end; current += 86_400_000) {
    const day = new Date(current).toISOString().slice(0, 10);
    const existingAbsences = approvedRanges.filter(range => rangesOverlap(range, { startDate: day, endDate: day })).length;
    if (existingAbsences + 1 > maximumAbsences) return true;
  }
  return false;
}
