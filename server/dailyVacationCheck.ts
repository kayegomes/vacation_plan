import { listAlerts, listAlertsByDedupeKeys, listCalendarEntries, listEmployees, listOperationalRestrictions, listVacationCyclesWithBalances, listVacationPeriodsWithDetails, upsertSystemAlert } from "./db";
import { deliverNewAlertEmails, deliverWeeklyAlertSummary } from "./emailNotifications";
import { exceedsConcurrentAbsenceLimit } from "./vacationRules";

type CheckResult = { recordsProcessed: number; alertsCreated: number; alertsUpdated: number; notificationsSent: number; notificationsFailed: number };

function isoDate(value: Date | string) { return new Date(value).toISOString().slice(0, 10); }
function intervalOverlap(first: { startDate: Date | string; endDate: Date | string }, second: { startDate: Date | string; endDate: Date | string }) { return Math.max(new Date(first.startDate).valueOf(), new Date(second.startDate).valueOf()) <= Math.min(new Date(first.endDate).valueOf(), new Date(second.endDate).valueOf()); }

export async function inspectVacationPlanning(today = new Date()): Promise<CheckResult> {
  const [cycles, periods, employees, restrictions, calendarEntries] = await Promise.all([listVacationCyclesWithBalances(), listVacationPeriodsWithDetails(), listEmployees(), listOperationalRestrictions(), listCalendarEntries({})]);
  const upcomingLimit = new Date(today);
  upcomingLimit.setUTCDate(upcomingLimit.getUTCDate() + 90);
  let alertsCreated = 0;
  let alertsUpdated = 0;
  async function report(alert: Parameters<typeof upsertSystemAlert>[0]) { const created = await upsertSystemAlert(alert); if (created) alertsCreated += 1; else alertsUpdated += 1; }

  for (const cycle of cycles) {
    const expiration = new Date(cycle.expirationDate);
    if (expiration < today) await report({ category: "expiration_overdue", severity: "critical", employeeId: cycle.employeeId, vacationCycleId: cycle.id, dedupeKey: `expiration-overdue-${cycle.id}`, title: `Férias vencidas: ${cycle.employeeName}`, description: `O ciclo ${cycle.reference} venceu em ${isoDate(expiration)} e requer tratativa.` });
    else if (expiration <= upcomingLimit) await report({ category: "expiration_soon", severity: "warning", employeeId: cycle.employeeId, vacationCycleId: cycle.id, dedupeKey: `expiration-soon-${cycle.id}`, title: `Vencimento próximo: ${cycle.employeeName}`, description: `O ciclo ${cycle.reference} vence em ${isoDate(expiration)}.` });
    if (Number(cycle.balance) < 0) await report({ category: "negative_balance", severity: "high", employeeId: cycle.employeeId, vacationCycleId: cycle.id, dedupeKey: `negative-balance-${cycle.id}`, title: `Saldo negativo: ${cycle.employeeName}`, description: `O ciclo ${cycle.reference} está com saldo de ${Number(cycle.balance)} dia(s).` });
  }

  for (const employee of employees.filter(employee => employee.active && (!employee.jobRoleId || !employee.baseId))) {
    const missing = [!employee.jobRoleId ? "cargo" : "", !employee.baseId ? "base" : ""].filter(Boolean).join(" e ");
    await report({ category: "data_quality", severity: "warning", employeeId: employee.id, dedupeKey: `employee-quality-${employee.id}`, title: `Cadastro incompleto: ${employee.fullName}`, description: `O colaborador ativo não possui ${missing} definido(s), o que reduz a precisão de filtros e regras de cobertura.` });
  }

  const pendingPeriods = periods.filter(period => period.status === "requested");
  for (const period of pendingPeriods) await report({ category: "pending_request", severity: "warning", employeeId: period.employeeId, vacationCycleId: period.vacationCycleId, vacationPeriodId: period.id, dedupeKey: `pending-request-${period.id}`, title: `Solicitação pendente: ${period.employeeName}`, description: `Período de ${isoDate(period.startDate)} a ${isoDate(period.endDate)} aguarda aprovação.` });

  const activePeriods = periods.filter(period => period.status === "requested" || period.status === "approved");
  for (let index = 0; index < activePeriods.length; index += 1) for (let pairIndex = index + 1; pairIndex < activePeriods.length; pairIndex += 1) {
    const first = activePeriods[index]; const second = activePeriods[pairIndex];
    if (first.employeeId === second.employeeId || !intervalOverlap(first, second)) continue;
    const ids = [first.id, second.id].sort((a, b) => a - b);
    await report({ category: "conflict", severity: "high", employeeId: first.employeeId, vacationPeriodId: first.id, dedupeKey: `period-conflict-${ids.join("-")}`, title: `Sobreposição: ${first.employeeName} e ${second.employeeName}`, description: `Ausências simultâneas entre ${isoDate(first.startDate)}–${isoDate(first.endDate)} e ${isoDate(second.startDate)}–${isoDate(second.endDate)} requerem avaliação de cobertura.` });
  }

  const activeEntries = calendarEntries.filter(entry => entry.status === "requested" || entry.status === "approved");
  for (const restriction of restrictions.filter(item => item.maxConcurrentAbsences)) {
    const scopedEntries = activeEntries.filter(entry => (!restriction.jobRoleName || restriction.jobRoleName === entry.jobRoleName) && (!restriction.operationalGroupName || restriction.operationalGroupName === entry.operationalGroupName) && (!restriction.baseName || restriction.baseName === entry.baseName) && intervalOverlap(entry, restriction));
    for (const entry of scopedEntries) {
      const otherRanges = scopedEntries.filter(other => other.id !== entry.id).map(other => ({ startDate: isoDate(other.startDate), endDate: isoDate(other.endDate) }));
      if (exceedsConcurrentAbsenceLimit({ startDate: isoDate(entry.startDate), endDate: isoDate(entry.endDate) }, otherRanges, restriction.maxConcurrentAbsences!)) await report({ category: "conflict", severity: "high", employeeId: entry.employeeId, vacationPeriodId: entry.id, dedupeKey: `capacity-conflict-${restriction.id}-${entry.id}`, title: `Capacidade excedida: ${entry.employeeName}`, description: `A restrição “${restriction.reason}” permite no máximo ${restriction.maxConcurrentAbsences} ausência(s) simultânea(s) no escopo definido.` });
    }
  }
  return { recordsProcessed: cycles.length + periods.length + employees.length + restrictions.length, alertsCreated, alertsUpdated, notificationsSent: 0, notificationsFailed: 0 };
}

export async function sendWeeklyVacationSummary(today = new Date()): Promise<CheckResult> {
  const alerts = await listAlerts({ status: "open" });
  const emailResult = await deliverWeeklyAlertSummary(alerts, today);
  return { recordsProcessed: alerts.length, alertsCreated: 0, alertsUpdated: 0, notificationsSent: emailResult.sent, notificationsFailed: emailResult.failed };
}

export async function notifyDailyCheckFailure(message: string) {
  const day = new Date().toISOString().slice(0, 10);
  const dedupeKey = `job-failure-${day}`;
  const created = await upsertSystemAlert({ category: "job_failure", severity: "critical", dedupeKey, title: "Falha na verificação diária de férias", description: message });
  if (!created) return { created: false, sent: 0, failed: 0, skipped: 1 };
  const alerts = await listAlertsByDedupeKeys([dedupeKey]);
  return { created: true, ...(await deliverNewAlertEmails(alerts)) };
}
