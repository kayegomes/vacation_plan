import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf-8");

describe("contratos de acessibilidade dos fluxos críticos", () => {
  it("mantém campos associados a labels e foco visível no cadastro de equipe", () => {
    const team = source("client/src/pages/TeamPage.tsx");
    expect(team).toContain("<label");
    expect(team).toContain("focus:ring-2");
    expect(team).toContain('aria-label="Filtrar por situação"');
  });

  it("mantém formulários semânticos e erros anunciáveis na configuração de cobertura", () => {
    const restrictions = source("client/src/pages/RestrictionsPage.tsx");
    expect(restrictions).toContain("<form");
    expect(restrictions).toContain("<label");
    expect(restrictions).toContain('role="alert"');
  });

  it("preserva ações textuais e foco explícito no planejamento de férias", () => {
    const planning = source("client/src/pages/PlanningPage.tsx");
    expect(planning).toContain("Salvar ciclo");
    expect(planning).toContain("Salvar rascunho");
    expect(planning).toContain("focus:ring-2");
  });
});
