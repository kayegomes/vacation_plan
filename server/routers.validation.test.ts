import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function contextFor(user: NonNullable<TrpcContext["user"]>): TrpcContext {
  return { user, req: { headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

function account(role: "user" | "planner" | "approver" | "admin", id: number, email: string) {
  const now = new Date();
  return { id, openId: `internal-${role}-test`, name: role, email, loginMethod: "internal", role, createdAt: now, updatedAt: now, lastSignedIn: now };
}

describe("validação runtime das procedures", () => {
  it("rejeita tratativa de alerta sem justificativa de resolução", async () => {
    const caller = appRouter.createCaller(contextFor(account("admin", 1, "admin@example.com")));
    await expect(caller.alerts.handle({ alertId: 1, status: "resolved" })).rejects.toThrow();
  });

  it("rejeita status de tratativa não permitido pela procedure", async () => {
    const caller = appRouter.createCaller(contextFor(account("admin", 1, "admin@example.com")));
    await expect(caller.alerts.handle({ alertId: 1, status: "open" as never })).rejects.toThrow();
  });

  it("rejeita filtros de alerta e calendário fora do contrato antes da consulta", async () => {
    const caller = appRouter.createCaller(contextFor(account("admin", 1, "admin@example.com")));
    await expect(caller.alerts.list({ severity: "urgente" as never })).rejects.toThrow();
    await expect(caller.alerts.list({ startDate: "2026-09-10", endDate: "2026-09-09" })).rejects.toThrow();
    await expect(caller.calendar.list({ startDate: "2026-09-10", endDate: "2026-09-09" })).rejects.toThrow();
  });

  it("impede que planejamento e aprovação administrem acessos", async () => {
    await expect(appRouter.createCaller(contextFor(account("planner", 2, "planner@example.com"))).access.listUsers()).rejects.toThrow("permissão administrativa");
    await expect(appRouter.createCaller(contextFor(account("approver", 3, "approver@example.com"))).access.listUsers()).rejects.toThrow("permissão administrativa");
  });

  it("preserva o usuário interno em auth.me e bloqueia planejamento ao perfil de consulta", async () => {
    const viewer = appRouter.createCaller(contextFor(account("user", 4, "consulta@example.com")));
    await expect(viewer.auth.me()).resolves.toMatchObject({ email: "consulta@example.com", role: "user" });
    await expect(viewer.vacations.createCycle({ employeeId: 1, accrualStartDate: "2026-01-01", accrualEndDate: "2026-12-31", leaveStartDeadline: "2027-12-31", entitledDays: 30 })).rejects.toThrow("permissão para planejar");
  });

  it("retorna sempre um valor explícito para o agendamento diário", async () => {
    const caller = appRouter.createCaller(contextFor(account("admin", 1, "admin@example.com")));
    await expect(caller.automation.dailyCheckSchedule()).resolves.not.toBeUndefined();
  });

  it("rejeita reconciliação incompleta antes de alterar períodos", async () => {
    const caller = appRouter.createCaller(contextFor(account("planner", 2, "planner@example.com")));
    await expect(caller.reconciliation.resolve({ reconciliationId: 1, vacationCycleId: 0 })).rejects.toThrow();
    await expect(caller.reconciliation.dismiss({ reconciliationId: 1, resolutionNote: "" })).rejects.toThrow();
  });
});
