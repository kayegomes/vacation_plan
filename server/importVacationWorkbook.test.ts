import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { buildWorkbookPreview } from "./importVacationWorkbook";

function makeWorkbook(rows: unknown[][]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "base_férias_2026");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("prévia de importação de férias", () => {
  it("identifica a base, os colaboradores, os blocos de períodos e pendências cadastrais", () => {
    const preview = buildWorkbookPreview(makeWorkbook([
      ["Código", "Nome", "Cargo", "Base", "Admissão", "Qtd Dias"],
      ["001", "Ana Costa", "Narradora", "RJ", "12/01/2020", 15],
      ["002", "Bruno Silva", null, null, "?", 10],
    ]));

    expect(preview.sourceSheetName).toBe("base_férias_2026");
    expect(preview.totalRows).toBe(2);
    expect(preview.periodBlocksDetected).toBe(1);
    expect(preview.warningRows).toBe(1);
    expect(preview.issues).toHaveLength(3);
  });

  it("retorna erro de estrutura quando não encontra cabeçalho de colaborador", () => {
    const preview = buildWorkbookPreview(makeWorkbook([["Código", "Cidade"], ["001", "Rio"]]));
    expect(preview.errorRows).toBe(1);
    expect(preview.issues[0]?.message).toContain("cabeçalho");
  });
});
