import { describe, expect, it } from "vitest";
import { buildAlertEmail, buildWeeklySummaryEmail, isEmailConfigured } from "./emailNotifications";

describe("notificações transacionais", () => {
  it("valida que as credenciais de envio estão disponíveis sem expor seus valores", () => {
    expect(isEmailConfigured()).toBe(true);
  });

  it("compõe e escapa o conteúdo do alerta para e-mail", () => {
    const message = buildAlertEmail({ id: 1, dedupeKey: "conflict-1", title: "Conflito <crítico>", description: "Atenção & revisão", category: "conflict", severity: "high", employeeName: "Ana & João" });
    expect(message.subject).toContain("Conflito <crítico>");
    expect(message.html).toContain("Conflito &lt;crítico&gt;");
    expect(message.html).toContain("Atenção &amp; revisão");
    expect(message.text).toContain("Ana & João");
  });

  it("compõe um resumo semanal sem expor HTML não tratado dos alertas", () => {
    const message = buildWeeklySummaryEmail([{ id: 1, dedupeKey: "conflict-1", title: "Conflito <crítico>", description: "Atenção & revisão", category: "conflict", severity: "high", employeeName: "Ana & João" }], new Date("2026-09-07T11:00:00Z"));
    expect(message.subject).toContain("Resumo semanal");
    expect(message.html).toContain("Conflito &lt;crítico&gt;");
    expect(message.html).toContain("Atenção &amp; revisão");
    expect(message.text).toContain("Ana & João");
  });
});
