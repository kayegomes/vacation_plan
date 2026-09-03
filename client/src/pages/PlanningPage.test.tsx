import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ role: "planner" as "planner" | "approver" }));

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, role: mocks.role, email: "conta@example.com", name: "Conta" } }),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ vacations: { cycles: { invalidate: vi.fn() }, periods: { invalidate: vi.fn() } }, dashboard: { summary: { invalidate: vi.fn() } } }),
    employees: { list: { useQuery: () => ({ data: [], isLoading: false }) } },
    vacations: {
      cycles: { useQuery: () => ({ data: [], isLoading: false }) },
      periods: { useQuery: () => ({ data: [], isLoading: false }) },
      createCycle: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: null }) }, createPeriod: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: null }) }, updateCycle: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: null }) }, updatePeriod: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: null }) }, sendForApproval: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: null }) }, decide: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: null }) }, cancel: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: null }) }, complete: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: null }) },
    },
  },
}));

vi.mock("wouter", () => ({ Link: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...props}>{children}</a> }));

import PlanningPage from "./PlanningPage";

describe("permissões visuais do planejamento", () => {
  beforeEach(() => { mocks.role = "planner"; });
  afterEach(cleanup);

  it("habilita criação para o perfil de planejamento", () => {
    render(<PlanningPage />);
    expect((screen.getByRole("button", { name: "Novo ciclo" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: "Novo período" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("bloqueia criação e orienta o perfil de aprovação", () => {
    mocks.role = "approver";
    render(<PlanningPage />);
    expect((screen.getByRole("button", { name: "Novo ciclo" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Seu perfil é de consulta ou aprovação/)).toBeTruthy();
  });
});
