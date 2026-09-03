export function normalizeScheduleResult<T>(schedule: T | undefined): T | null {
  return schedule ?? null;
}
