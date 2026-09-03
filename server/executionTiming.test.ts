import { describe, expect, it } from "vitest";
import { calculateExecutionDurationMs } from "./executionTiming";

describe("duração de execuções", () => {
  it("calcula a duração e impede valores negativos", () => {
    expect(calculateExecutionDurationMs(new Date("2026-09-03T09:00:00.000Z"), new Date("2026-09-03T09:00:01.250Z"))).toBe(1250);
    expect(calculateExecutionDurationMs(new Date("2026-09-03T09:00:01.000Z"), new Date("2026-09-03T09:00:00.000Z"))).toBe(0);
  });
});
