import { describe, expect, it } from "vitest";
import { normalizeScheduleResult } from "./automationSchedule";

describe("normalização de agendamento", () => {
  it("retorna null quando a rotina ainda não possui configuração", () => {
    expect(normalizeScheduleResult(undefined)).toBeNull();
  });

  it("preserva a rotina configurada", () => {
    expect(normalizeScheduleResult({ scheduleCronTaskUid: "task-1" })).toEqual({ scheduleCronTaskUid: "task-1" });
  });
});
