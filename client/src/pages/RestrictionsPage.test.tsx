// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createMutate: vi.fn(),
  updateMutate: vi.fn(),
  invalidate: vi.fn(),
  createError: null as Error | null,
}));

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ user: { role: "admin" } }),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ restrictions: { list: { invalidate: mocks.invalidate } } }),
    organization: {
      list: {
        useQuery: (entity: string) => ({ data: entity === "base" ? [{ id: 7, name: "São Paulo" }] : [], isLoading: false }),
      },
    },
    restrictions: {
      list: { useQuery: () => ({ data: [], isLoading: false }) },
      create: { useMutation: () => ({ mutate: mocks.createMutate, isPending: false, error: mocks.createError }) },
      update: { useMutation: () => ({ mutate: mocks.updateMutate, isPending: false, error: null }) },
    },
  },
}));

import RestrictionsPage from "./RestrictionsPage";

describe("jornada acessível de restrições operacionais", () => {
  beforeEach(() => {
    mocks.createMutate.mockReset();
    mocks.updateMutate.mockReset();
    mocks.invalidate.mockReset();
    mocks.createError = null;
  });

  afterEach(cleanup);

  it("permite navegar por teclado e salvar uma restrição com campos rotulados", async () => {
    const user = userEvent.setup();
    render(<RestrictionsPage />);
    const cargo = screen.getByLabelText("Cargo");
    const base = screen.getByLabelText("Base");
    expect(cargo.tagName).toBe("SELECT");
    await user.tab();
    expect(document.activeElement).toBe(cargo);
    await user.selectOptions(base, "7");
    fireEvent.change(screen.getByLabelText("Data inicial"), { target: { value: "2026-07-01" } });
    fireEvent.change(screen.getByLabelText("Data final"), { target: { value: "2026-07-10" } });
    await user.type(screen.getByLabelText("Motivo"), "Escala mínima");
    await user.click(screen.getByRole("button", { name: "Salvar restrição" }));
    expect(mocks.createMutate).toHaveBeenCalledWith(expect.objectContaining({ baseId: 7, reason: "Escala mínima", blocksApproval: true }));
  });

  it("anuncia falha de envio em uma região de alerta", () => {
    mocks.createError = new Error("Não foi possível salvar a restrição.");
    render(<RestrictionsPage />);
    expect(screen.getByRole("alert").textContent).toContain("Não foi possível salvar a restrição.");
  });
});
