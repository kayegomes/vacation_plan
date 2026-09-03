import { describe, expect, it } from "vitest";
import { getConflictDays, getEntriesForDay } from "./calendarUtils";

describe("calendário consolidado", () => {
  const entries = [
    { id: 1, employeeId: 1, employeeName: "Ana", startDate: "2026-09-03T00:00:00.000Z", endDate: "2026-09-05T00:00:00.000Z" },
    { id: 2, employeeId: 2, employeeName: "Bruno", startDate: "2026-09-05T00:00:00.000Z", endDate: "2026-09-08T00:00:00.000Z" },
  ];

  it("mostra todas as ausências ativas em um dia", () => {
    expect(getEntriesForDay(entries, new Date("2026-09-05T00:00:00.000Z"))).toHaveLength(2);
  });

  it("identifica dias com sobreposição e mantém as pessoas vinculadas às entradas", () => {
    const conflicts = getConflictDays(entries, [
      new Date("2026-09-04T00:00:00.000Z"),
      new Date("2026-09-05T00:00:00.000Z"),
      new Date("2026-09-06T00:00:00.000Z"),
    ]);
    expect(conflicts.map(date => date.toISOString().slice(0, 10))).toEqual(["2026-09-05"]);
  });
});
