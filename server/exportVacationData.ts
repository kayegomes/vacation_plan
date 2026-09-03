import * as XLSX from "xlsx";

type ExportEntry = {
  employeeName: string;
  jobRoleName: string | null;
  operationalGroupName: string | null;
  baseName: string | null;
  startDate: Date | string;
  endDate: Date | string;
  calendarDays: number;
  status: string;
};

function formatDate(value: Date | string) {
  return new Date(value).toISOString().slice(0, 10);
}

export function buildCalendarExport(entries: ExportEntry[], format: "xlsx" | "csv") {
  const rows = entries.map(entry => ({
    Colaborador: entry.employeeName,
    Cargo: entry.jobRoleName ?? "",
    "Grupo operacional": entry.operationalGroupName ?? "",
    Base: entry.baseName ?? "",
    "Data inicial": formatDate(entry.startDate),
    "Data final": formatDate(entry.endDate),
    "Dias corridos": entry.calendarDays,
    Status: entry.status,
  }));
  const sheet = XLSX.utils.json_to_sheet(rows);
  if (format === "csv") {
    return { content: XLSX.utils.sheet_to_csv(sheet, { FS: ";" }), contentType: "text/csv;charset=utf-8", extension: "csv" };
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Calendário");
  return { content: XLSX.write(workbook, { type: "base64", bookType: "xlsx" }), contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", extension: "xlsx" };
}
