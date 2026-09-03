import { describe, expect, it } from "vitest";
import {
  calculateCalendarDays,
  calculateCycleBalance,
  exceedsConcurrentAbsenceLimit,
  meetsMinimumContinuousPeriod,
  rangesOverlap,
} from "./vacationRules";

describe("regras de férias", () => {
  it("calcula dias corridos com início e fim inclusivos", () => {
    expect(calculateCalendarDays("2026-01-10", "2026-01-10")).toBe(1);
    expect(calculateCalendarDays("2026-01-10", "2026-01-23")).toBe(14);
  });

  it("rejeita períodos com a data final anterior à inicial", () => {
    expect(() => calculateCalendarDays("2026-02-02", "2026-02-01")).toThrow("data final");
  });

  it("identifica conflito inclusive quando períodos tocam no mesmo dia", () => {
    expect(rangesOverlap(
      { startDate: "2026-03-01", endDate: "2026-03-10" },
      { startDate: "2026-03-10", endDate: "2026-03-14" },
    )).toBe(true);
    expect(rangesOverlap(
      { startDate: "2026-03-01", endDate: "2026-03-10" },
      { startDate: "2026-03-11", endDate: "2026-03-14" },
    )).toBe(false);
  });

  it("calcula o saldo descontando somente períodos aprovados ou concluídos", () => {
    expect(calculateCycleBalance({
      entitledDays: 30,
      soldDays: 10,
      adjustmentDays: 0,
      periods: [
        { startDate: "2026-04-01", endDate: "2026-04-14", calendarDays: 14, status: "approved" },
        { startDate: "2026-08-01", endDate: "2026-08-05", calendarDays: 5, status: "requested" },
      ],
    })).toBe(6);
  });

  it("verifica a regra configurável de período contínuo mínimo", () => {
    expect(meetsMinimumContinuousPeriod([
      { startDate: "2026-05-01", endDate: "2026-05-10" },
      { startDate: "2026-09-01", endDate: "2026-09-14" },
    ])).toBe(true);
    expect(meetsMinimumContinuousPeriod([
      { startDate: "2026-05-01", endDate: "2026-05-05" },
      { startDate: "2026-09-01", endDate: "2026-09-08" },
    ])).toBe(false);
  });

  it("bloqueia proposta que ultrapassa o máximo de ausências em um dia compartilhado", () => {
    const approved = [{ startDate: "2026-04-10", endDate: "2026-04-14" }];
    expect(exceedsConcurrentAbsenceLimit({ startDate: "2026-04-12", endDate: "2026-04-16" }, approved, 1)).toBe(true);
    expect(exceedsConcurrentAbsenceLimit({ startDate: "2026-04-15", endDate: "2026-04-16" }, approved, 1)).toBe(false);
  });
});
