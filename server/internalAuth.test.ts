import { describe, expect, it } from "vitest";
import { createInternalSession, createRawAccountToken, hashAccountToken, hashPassword, INTERNAL_SESSION_COOKIE, normalizeEmail, readInternalSession, verifyPassword } from "./internalAuth";

describe("autenticação interna", () => {
  it("normaliza e-mails e valida senhas sem persistir texto puro", async () => {
    const hash = await hashPassword("SenhaSegura#2026");
    expect(hash).not.toContain("SenhaSegura#2026");
    expect(normalizeEmail(" Conta.Admin@Example.com ")).toBe("conta.admin@example.com");
    await expect(verifyPassword("SenhaSegura#2026", hash)).resolves.toBe(true);
    await expect(verifyPassword("senha-incorreta", hash)).resolves.toBe(false);
  });

  it("gera tokens de convite não reversíveis quando persistidos", () => {
    const token = createRawAccountToken();
    expect(token.length).toBeGreaterThan(32);
    expect(hashAccountToken(token)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("emite e valida uma sessão interna vinculada ao identificador da conta", async () => {
    const session = await createInternalSession(42);
    await expect(readInternalSession(`${INTERNAL_SESSION_COOKIE}=${session}`)).resolves.toBe(42);
    await expect(readInternalSession(`${INTERNAL_SESSION_COOKIE}=invalida`)).resolves.toBeNull();
  });
});
