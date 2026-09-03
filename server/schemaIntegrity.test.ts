import { getTableConfig } from "drizzle-orm/mysql-core";
import { describe, expect, it } from "vitest";
import {
  alerts,
  approvalHistory,
  auditLogs,
  employees,
  operationalRestrictions,
  vacationCycles,
  vacationPeriods,
} from "../drizzle/schema";

describe("integridade referencial do domínio de férias", () => {
  it("mantém as relações necessárias entre estruturas, colaboradores, ciclos, períodos e histórico", () => {
    expect(getTableConfig(employees).foreignKeys).toHaveLength(3);
    expect(getTableConfig(vacationCycles).foreignKeys).toHaveLength(1);
    expect(getTableConfig(vacationPeriods).foreignKeys).toHaveLength(4);
    expect(getTableConfig(approvalHistory).foreignKeys).toHaveLength(2);
    expect(getTableConfig(alerts).foreignKeys).toHaveLength(4);
    expect(getTableConfig(auditLogs).foreignKeys).toHaveLength(1);
    expect(getTableConfig(operationalRestrictions).foreignKeys).toHaveLength(3);
  });
});
