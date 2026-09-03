export type CalendarEntry = {
  id: number;
  employeeId: number;
  employeeName: string;
  startDate: Date | string;
  endDate: Date | string;
};

function utcStamp(value: Date | string) {
  const date = new Date(value);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function getEntriesForDay(entries: CalendarEntry[], date: Date) {
  const stamp = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return entries.filter(entry => utcStamp(entry.startDate) <= stamp && utcStamp(entry.endDate) >= stamp);
}

export function getConflictDays(entries: CalendarEntry[], days: Date[]) {
  return days.filter(day => getEntriesForDay(entries, day).length > 1);
}
