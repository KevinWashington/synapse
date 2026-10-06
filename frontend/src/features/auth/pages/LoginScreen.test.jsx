import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import LoginScreen from "./LoginScreen";

vi.mock("@features/auth", () => ({
  useAuth: () => ({
    loginWithGoogle: vi.fn(),
    error: null,
    isAuthenticated: () => false,
  }),
}));

vi.mock("@features/auth/components/GoogleSignInButton", () => ({
  default: () => <button type="button">Continuar com o Google</button>,
}));

describe("LoginScreen", () => {
  it("apresenta o produto e o acesso sem envolver o formulario em um card", () => {
    render(
      <MemoryRouter>
        <LoginScreen />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Transforme pesquisa em evidência confiável." })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Acesse seu espaço de revisão" })).toBeVisible();
    expect(screen.getByText("Identifique")).toBeVisible();
    expect(screen.getByText("Avalie")).toBeVisible();
    expect(screen.getByText("Sintetize")).toBeVisible();
    expect(screen.queryByTestId("login-card")).not.toBeInTheDocument();
  });
});
