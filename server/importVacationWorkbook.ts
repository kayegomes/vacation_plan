import * as XLSX from "xlsx";

export type ImportIssueDraft = {
  rowNumber: number | null;
  entityType: "workbook" | "employee" | "cycle" | "period";
  severity: "warning" | "error";
  field: string | null;
  message: string;
  rawData?: Record<string, unknown>;
};

export type ImportedEmployee = {
  rowNumber: number;
  fullName: string;
  displayName: string | null;
  jobRole: string | null;
  base: string | null;
  admissionDate: string | null;
};

export type ImportedVacationCycle = {
  rowNumber: number;
  employeeName: string;
  reference: string;
  expirationDate: string;
  entitledDays: number;
  soldDays: number;
};

export type ImportedVacationPeriod = {
  rowNumber: number;
  employeeName: string;
  cycleReference: string | null;
  startDate: string;
  endDate: string;
  calendarDays: number;
  status: "draft" | "requested" | "approved" | "rejected" | "cancelled" | "completed";
};

export type WorkbookPreview = {
  sourceSheetName: string | null;
  totalRows: number;
  acceptedRows: number;
  warningRows: number;
  errorRows: number;
  periodBlocksDetected: number;
  employees: ImportedEmployee[];
  vacationCycles: ImportedVacationCycle[];
  vacationPeriods: ImportedVacationPeriod[];
  issues: ImportIssueDraft[];
};

const normalize = (value: unknown) => String(value ?? "").trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const visibleText = (value: unknown) => String(value ?? "").trim();

function findColumn(headers: unknown[], candidates: string[]) {
  return headers.findIndex(header => candidates.some(candidate => normalize(header).includes(candidate)));
}

function findColumns(headers: unknown[], candidate: string) {
  return headers.reduce<number[]>((columns, header, index) => normalize(header).includes(candidate) ? [...columns, index] : columns, []);
}

function formatImportDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    const dateCode = XLSX.SSF.parse_date_code(value);
    if (dateCode) return `${dateCode.y}-${String(dateCode.m).padStart(2, "0")}-${String(dateCode.d).padStart(2, "0")}`;
  }
  const text = visibleText(value);
  if (!text) return null;
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function positiveInteger(value: unknown): number | null {
  const parsed = Number.parseInt(visibleText(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function importedStatus(value: unknown): ImportedVacationPeriod["status"] {
  const text = normalize(value);
  if (text.includes("aprov")) return "approved";
  if (text.includes("rejeit") || text.includes("negad")) return "rejected";
  if (text.includes("cancel")) return "cancelled";
  if (text.includes("conclu") || text.includes("gozad")) return "completed";
  if (text.includes("solicit") || text === "sim" || text === "s") return "requested";
  return "draft";
}

function blankPreview(sourceSheetName: string | null, message: string): WorkbookPreview {
  return { sourceSheetName, totalRows: 0, acceptedRows: 0, warningRows: 0, errorRows: 1, periodBlocksDetected: 0, employees: [], vacationCycles: [], vacationPeriods: [], issues: [{ rowNumber: null, entityType: "workbook", severity: "error", field: null, message }] };
}

export function buildWorkbookPreview(buffer: Buffer, employeeLimit = 200): WorkbookPreview {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const preferredSheet = workbook.SheetNames.find(name => normalize(name).includes("base") && normalize(name).includes("ferias"));
  const sourceSheetName = preferredSheet ?? workbook.SheetNames[0] ?? null;
  if (!sourceSheetName) return blankPreview(null, "A planilha não contém nenhuma aba utilizável.");

  const sourceSheet = workbook.Sheets[sourceSheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sourceSheet, { header: 1, defval: null, raw: true });
  const headerRowIndex = rows.findIndex(row => Array.isArray(row) && findColumn(row, ["nome", "colaborador"]) >= 0);
  if (headerRowIndex < 0) return blankPreview(sourceSheetName, "Não foi localizado um cabeçalho de nome ou colaborador na aba selecionada.");

  const headers = rows[headerRowIndex];
  const groupHeaders = rows[Math.max(0, headerRowIndex - 1)] ?? [];
  const nameIndex = findColumn(headers, ["nome", "colaborador"]);
  const displayNameIndex = findColumn(headers, ["nome de exibicao", "nome agenda", "apelido"]);
  const roleIndex = findColumn(headers, ["cargo", "funcao", "função"]);
  const baseIndex = findColumn(headers, ["base"]);
  const admissionIndex = findColumn(headers, ["admissao", "admissão"]);
  const expirationColumns = findColumns(headers, "vcto ferias");
  const periodStartColumns = findColumns(headers, "inicio");
  const periodBlocksDetected = Math.max(periodStartColumns.length, findColumns(headers, "qtd dias").length);
  const issues: ImportIssueDraft[] = [];
  const employees: ImportedEmployee[] = [];
  const vacationCycles: ImportedVacationCycle[] = [];
  const vacationPeriods: ImportedVacationPeriod[] = [];

  rows.slice(headerRowIndex + 1).forEach((row, offset) => {
    if (!Array.isArray(row)) return;
    const rowNumber = headerRowIndex + offset + 2;
    const fullName = visibleText(row[nameIndex]);
    if (!fullName) return;
    const employee: ImportedEmployee = { rowNumber, fullName, displayName: displayNameIndex >= 0 ? visibleText(row[displayNameIndex]) || null : null, jobRole: roleIndex >= 0 ? visibleText(row[roleIndex]) || null : null, base: baseIndex >= 0 ? visibleText(row[baseIndex]) || null : null, admissionDate: admissionIndex >= 0 ? formatImportDate(row[admissionIndex]) : null };
    employees.push(employee);
    if (!employee.jobRole) issues.push({ rowNumber, entityType: "employee", severity: "warning", field: "cargo", message: "Colaborador sem cargo identificado.", rawData: { fullName } });
    if (!employee.base) issues.push({ rowNumber, entityType: "employee", severity: "warning", field: "base", message: "Colaborador sem base identificada.", rawData: { fullName } });
    if (admissionIndex >= 0 && row[admissionIndex] && !employee.admissionDate) issues.push({ rowNumber, entityType: "employee", severity: "warning", field: "data_de_admissao", message: "A data de admissão não pôde ser reconhecida.", rawData: { fullName, admission: visibleText(row[admissionIndex]) } });

    expirationColumns.forEach(column => {
      const expirationDate = formatImportDate(row[column]);
      const reference = visibleText(groupHeaders[column]);
      if (!expirationDate && !reference) return;
      if (!expirationDate || !reference) {
        issues.push({ rowNumber, entityType: "cycle", severity: "warning", field: "ciclo", message: "Ciclo de férias identificado sem referência ou vencimento reconhecível; ele não será publicado.", rawData: { fullName, reference, expiration: visibleText(row[column]) } });
        return;
      }
      vacationCycles.push({ rowNumber, employeeName: fullName, reference, expirationDate, entitledDays: positiveInteger(row[column + 1]) ?? 30, soldDays: positiveInteger(row[column + 3]) ?? 0 });
    });

    periodStartColumns.forEach(startColumn => {
      const endColumn = startColumn + 1;
      const startDate = formatImportDate(row[startColumn]);
      const endDate = formatImportDate(row[endColumn]);
      if (!startDate && !endDate) return;
      if (!startDate || !endDate || startDate > endDate) {
        issues.push({ rowNumber, entityType: "period", severity: "error", field: "período", message: "Período de férias com data inicial ou final inválida; ele não será publicado.", rawData: { fullName, start: visibleText(row[startColumn]), end: visibleText(row[endColumn]) } });
        return;
      }
      vacationPeriods.push({ rowNumber, employeeName: fullName, cycleReference: visibleText(row[startColumn + 3]) || null, startDate, endDate, calendarDays: positiveInteger(row[startColumn - 1]) ?? Math.floor((new Date(`${endDate}T00:00:00Z`).valueOf() - new Date(`${startDate}T00:00:00Z`).valueOf()) / 86_400_000) + 1, status: importedStatus(row[startColumn + 2]) });
    });
  });

  if (periodBlocksDetected === 0) issues.push({ rowNumber: null, entityType: "workbook", severity: "warning", field: "periodos", message: "Nenhum bloco de períodos foi identificado automaticamente; revise o mapeamento antes da publicação." });
  const warningRows = new Set(issues.filter(issue => issue.severity === "warning" && issue.rowNumber).map(issue => issue.rowNumber)).size;
  const errorRows = new Set(issues.filter(issue => issue.severity === "error" && issue.rowNumber).map(issue => issue.rowNumber)).size;
  return { sourceSheetName, totalRows: employees.length, acceptedRows: employees.length - errorRows, warningRows, errorRows, periodBlocksDetected, employees: employees.slice(0, employeeLimit), vacationCycles, vacationPeriods, issues };
}
