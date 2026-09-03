import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  reset: vi.fn(),
  invalidate: vi.fn(),
  setLocation: vi.fn(),
  loginError: null as Error | null,
  resetError: null as Error | null,
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ auth: { me: { invalidate: mocks.invalidate } } }),
    auth: {
      internalLogin: { useMutation: () => ({ mutateAsync: mocks.login, isPending: false, error: mocks.loginError }) },
      requestPasswordReset: { useMutation: () => ({ mutateAsync: mocks.reset, isPending: false, isSuccess: false, error: mocks.resetError }) },
    },
  },
}));

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...props}>{children}</a>,
  useLocation: () => ["/entrar", mocks.setLocation],
}));

import InternalLoginPage from "./InternalLoginPage";
import PasswordResetRequestPage from "./PasswordResetRequestPage";

describe("jornadas de autenticação interna", () => {
  beforeEach(() => {
    mocks.login.mockReset(); mocks.reset.mockReset(); mocks.invalidate.mockReset(); mocks.setLocation.mockReset();
    mocks.loginError = null; mocks.resetError = null;
  });
  afterEach(cleanup);

  it("submete e-mail e senha no login interno pelos campos rotulados", async () => {
    const user = userEvent.setup();
    render(<InternalLoginPage />);
    await user.type(screen.getByLabelText("E-mail"), "conta@example.com");
    await user.type(screen.getByLabelText("Senha"), "senha-segura-2026");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(mocks.login).toHaveBeenCalledWith({ email: "conta@example.com", password: "senha-segura-2026" });
    expect(screen.getByRole("link", { name: "Esqueci a senha" }).getAttribute("href")).toBe("/redefinir-senha");
  });

  it("anuncia falha de login em região de alerta", () => {
    mocks.loginError = new Error("E-mail ou senha inválidos.");
    render(<InternalLoginPage />);
    expect(screen.getByRole("alert").textContent).toContain("E-mail ou senha inválidos.");
  });

  it("solicita redefinição por uma resposta neutra", async () => {
    const user = userEvent.setup();
    mocks.reset.mockResolvedValue({ success: true });
    render(<PasswordResetRequestPage />);
    await user.type(screen.getByLabelText("E-mail"), "conta@example.com");
    await user.click(screen.getByRole("button", { name: "Enviar instruções" }));
    expect(mocks.reset).toHaveBeenCalledWith(expect.objectContaining({ email: "conta@example.com" }));
  });
});
