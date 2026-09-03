import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  listVacationCyclesWithBalances: vi.fn(),
  listVacationPeriodsWithDetails: vi.fn(),
  listEmployees: vi.fn(),
  listOperationalRestrictions: vi.fn(),
  listCalendarEntries: vi.fn(),
  listAlertsByDedupeKeys: vi.fn(),
  listAlerts: vi.fn(),
  upsertSystemAlert: vi.fn(),
}));

const emailNotifications = vi.hoisted(() => ({ deliverNewAlertEmails: vi.fn(), deliverWeeklyAlertSummary: vi.fn() }));

vi.mock("./db", () => db);
vi.mock("./emailNotifications", () => emailNotifications);

import { inspectVacationPlanning, notifyDailyCheckFailure, sendWeeklyVacationSummary } from "./dailyVacationCheck";

describe("verificação diária e resumo semanal de férias", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.listVacationCyclesWithBalances.mockResolvedValue([{ id: 1, employeeId: 10, employeeName: "Ana", reference: "2026/2027", expirationDate: new Date("2026-01-05T00:00:00Z"), balance: -2 }]);
    db.listVacationPeriodsWithDetails.mockResolvedValue([{ id: 2, employeeId: 10, employeeName: "Ana", vacationCycleId: 1, startDate: new Date("2026-02-10T00:00:00Z"), endDate: new Date("2026-02-14T00:00:00Z"), status: "requested" }]);
    db.listEmployees.mockResolvedValue([{ id: 10, fullName: "Ana", active: true, jobRoleId: null, baseId: null }]);
    db.listOperationalRestrictions.mockResolvedValue([]);
    db.listCalendarEntries.mockResolvedValue([]);
    db.listAlertsByDedupeKeys.mockResolvedValue([{ id: 1, dedupeKey: "expiration-soon-1", category: "expiration_soon", severity: "warning", title: "Vencimento próximo", description: "Ciclo próximo do vencimento.", employeeName: "Ana" }]);
    db.listAlerts.mockResolvedValue([{ id: 1, dedupeKey: "expiration-soon-1", category: "expiration_soon", severity: "warning", title: "Vencimento próximo", description: "Ciclo próximo do vencimento.", employeeName: "Ana" }]);
    db.upsertSystemAlert.mockResolvedValue(true);
    emailNotifications.deliverNewAlertEmails.mockResolvedValue({ sent: 1, failed: 0, skipped: 0 });
    emailNotifications.deliverWeeklyAlertSummary.mockResolvedValue({ sent: 1, failed: 0, skipped: 0 });
  });

  it("gera alertas diariamente sem enviar e-mails de rotina", async () => {
    const result = await inspectVacationPlanning(new Date("2026-01-01T00:00:00Z"));
    const categories = db.upsertSystemAlert.mock.calls.map(([alert]) => alert.category);
    expect(categories).toEqual(expect.arrayContaining(["expiration_soon", "negative_balance", "pending_request", "data_quality"]));
    expect(emailNotifications.deliverNewAlertEmails).not.toHaveBeenCalled();
    expect(result).toEqual({ recordsProcessed: 3, alertsCreated: 4, alertsUpdated: 0, notificationsSent: 0, notificationsFailed: 0 });
  });

  it("contabiliza atualizações quando a chave de deduplicação já existe", async () => {
    db.upsertSystemAlert.mockResolvedValue(false);
    const result = await inspectVacationPlanning(new Date("2026-01-01T00:00:00Z"));
    expect(result.alertsCreated).toBe(0);
    expect(result.alertsUpdated).toBe(4);
  });

  it("registra e notifica falha crítica da rotina apenas uma vez por dia", async () => {
    db.upsertSystemAlert.mockResolvedValue(true);
    db.listAlertsByDedupeKeys.mockResolvedValue([{ id: 9, dedupeKey: "job-failure-2026-01-01", category: "job_failure", severity: "critical", title: "Falha na verificação diária de férias", description: "Banco indisponível", employeeName: null }]);
    const result = await notifyDailyCheckFailure("Banco indisponível");
    expect(db.upsertSystemAlert).toHaveBeenCalledWith(expect.objectContaining({ category: "job_failure", severity: "critical", description: "Banco indisponível" }));
    expect(emailNotifications.deliverNewAlertEmails).toHaveBeenCalledWith([expect.objectContaining({ category: "job_failure" })]);
    expect(result).toEqual({ created: true, sent: 1, failed: 0, skipped: 0 });
  });

  it("envia o resumo semanal com alertas em aberto, sem depender da verificação diária", async () => {
    const reference = new Date("2026-09-07T11:00:00Z");
    const result = await sendWeeklyVacationSummary(reference);
    expect(db.listAlerts).toHaveBeenCalledWith({ status: "open" });
    expect(emailNotifications.deliverWeeklyAlertSummary).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ dedupeKey: "expiration-soon-1" })]), reference);
    expect(result).toEqual({ recordsProcessed: 1, alertsCreated: 0, alertsUpdated: 0, notificationsSent: 1, notificationsFailed: 0 });
  });
});
