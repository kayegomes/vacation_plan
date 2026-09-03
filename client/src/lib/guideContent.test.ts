import { describe, expect, it } from "vitest";
import { guideModules, roleGuidance, statusGuide } from "./guideContent";

describe("conteúdo do guia de uso", () => {
  it("cobre os módulos operacionais essenciais", () => {
    expect(guideModules.map(item => item.title).join(" ")).toContain("Importe planilhas");
    expect(guideModules.map(item => item.title).join(" ")).toContain("Reconcilie períodos");
    expect(guideModules).toHaveLength(8);
  });

  it("descreve todos os perfis e estados de um período", () => {
    expect(roleGuidance).toHaveLength(4);
    expect(statusGuide.map(item => item.label)).toEqual(["Rascunho", "Solicitado", "Aprovado", "Rejeitado", "Cancelado", "Concluído"]);
  });
});
