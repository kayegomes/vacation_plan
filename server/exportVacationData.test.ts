import { describe, expect, it } from "vitest";
import { buildCalendarExport } from "./exportVacationData";

const entries = [{ employeeName: "Ana Costa", jobRoleName: "Narradora", operationalGroupName: "Operação", baseName: "RJ", startDate: "2026-09-03T00:00:00.000Z", endDate: "2026-09-12T00:00:00.000Z", calendarDays: 10, status: "approved" }];

describe("exportação do calendário", () => {
  it("gera CSV delimitado por ponto e vírgula", () => {
    const result = buildCalendarExport(entries, "csv");
    expect(result.extension).toBe("csv");
    expect(result.content).toContain("Colaborador;Cargo");
    expect(result.content).toContain("Ana Costa;Narradora");
  });

  it("gera conteúdo XLSX em base64", () => {
    const result = buildCalendarExport(entries, "xlsx");
    expect(result.extension).toBe("xlsx");
    expect(result.content.length).toBeGreaterThan(100);
  });
});
