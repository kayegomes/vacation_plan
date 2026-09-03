export function calculateExecutionDurationMs(startedAt: Date, completedAt: Date) {
  return Math.max(0, completedAt.valueOf() - startedAt.valueOf());
}
