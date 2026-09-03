import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  role: "user" as "user" | "admin",
  refetch: vi.fn(),
  updateRole: vi.fn(),
  updateAccountStatus: vi.fn(),
  invite: vi.fn(),
}));

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, role: mocks.role, email: "conta@example.com", name: "Conta" } }),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({}),
    access: {
      listUsers: { useQuery: () => ({ data: [], isLoading: false, isError: false, refetch: mocks.refetch }) },
      updateRole: { useMutation: () => ({ mutate: mocks.updateRole, isPending: false }) },
      updateInternalAccountStatus: { useMutation: () => ({ mutate: mocks.updateAccountStatus, isPending: false }) },
    },
    auth: { inviteInternalAccount: { useMutation: () => ({ mutateAsync: mocks.invite, isPending: false, error: null }) } },
  },
}));

import AccessPage from "./AccessPage";

describe("permissões visuais da administração de contas", () => {
  beforeEach(() => { mocks.role = "user"; mocks.refetch.mockReset(); mocks.updateRole.mockReset(); mocks.updateAccountStatus.mockReset(); mocks.invite.mockReset(); });
  afterEach(cleanup);

  it("bloqueia a gestão visual para o perfil de consulta", () => {
    render(<AccessPage />);
    expect(screen.getByRole("heading", { name: "Acesso restrito" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Enviar convite" })).toBeNull();
  });

  it("exibe o convite para o perfil administrativo", () => {
    mocks.role = "admin";
    render(<AccessPage />);
    expect(screen.getByRole("heading", { name: "Acessos e perfis" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Enviar convite" })).toBeTruthy();
  });
});
