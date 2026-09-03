import { cleanup, render, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ setLocation: vi.fn() }));

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ loading: false, user: null }),
}));

vi.mock("wouter", () => ({ useLocation: () => ["/planejamento", mocks.setLocation] }));

import DashboardLayout from "./DashboardLayout";

describe("acesso sem sessão interna", () => {
  afterEach(cleanup);

  it("redireciona rotas internas para o login quando não há sessão válida", async () => {
    render(<DashboardLayout><div>Conteúdo protegido</div></DashboardLayout>);
    await waitFor(() => expect(mocks.setLocation).toHaveBeenCalledWith("/entrar"));
  });
});
