import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import AppHeader from "./AppHeader";

const logout = vi.fn().mockResolvedValue({ success: true });
let currentUser = {
  name: "Ana Rocha",
  email: "ana@example.com",
  avatar: null,
};

vi.mock("@/features/auth", () => ({
  useAuth: () => ({ logout, user: currentUser }),
}));

vi.mock("@/features/inbox/components/UserInbox", () => ({
  default: () => <button type="button" aria-label="Central de notificações, 0 pendentes" />,
}));

function renderHeader(props = {}) {
  return render(
    <MemoryRouter>
      <AppHeader
        breadcrumbs={[
          { label: "Projetos", href: "/projetos" },
          { label: "Revisao de saude", href: "/projetos/7" },
          { label: "Triagem" },
        ]}
        title="Triagem"
        {...props}
      />
    </MemoryRouter>
  );
}

describe("AppHeader", () => {
  it("renders clickable breadcrumb ancestors separated by chevrons", () => {
    renderHeader();

    expect(screen.getByRole("link", { name: "Projetos" })).toHaveAttribute("href", "/projetos");
    expect(screen.getByRole("link", { name: "Revisao de saude" })).toHaveAttribute("href", "/projetos/7");
    expect(screen.getByText("Triagem")).toBeInTheDocument();
    expect(screen.getAllByTestId("breadcrumb-separator")).toHaveLength(2);
  });

  it("shows the authenticated identity and account actions without a theme control", async () => {
    renderHeader();

    expect(screen.getByText("AR")).toBeInTheDocument();
    expect(screen.queryByText("JS")).not.toBeInTheDocument();
    expect(screen.queryByTitle(/Alternar para tema/)).not.toBeInTheDocument();

    fireEvent.pointerDown(screen.getByRole("button", { name: "Abrir menu da conta" }), {
      button: 0,
      ctrlKey: false,
    });

    await waitFor(() => expect(screen.getByText("Ana Rocha")).toBeInTheDocument());
    expect(screen.getByText("ana@example.com")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Sair" })).toBeInTheDocument();
  });

  it("keeps account controls in compact mode", () => {
    renderHeader({ compact: true });

    expect(screen.getByRole("button", { name: "Abrir menu da conta" })).toBeInTheDocument();
    expect(screen.getByText("AR")).toBeInTheDocument();
  });

  it("uses the same horizontal grid in compact and regular modes", () => {
    const { container, rerender } = renderHeader({ compact: false });
    const regularHeader = container.querySelector("header");

    expect(regularHeader).toHaveClass("h-[72px]", "pl-20", "pr-5", "md:px-10");
    expect(regularHeader).not.toHaveClass("lg:px-14", "pl-16");

    rerender(
      <MemoryRouter>
        <AppHeader compact breadcrumbs={[{ label: "Projetos", href: "/projetos" }]} />
      </MemoryRouter>
    );

    const compactHeader = container.querySelector("header");
    expect(compactHeader).toHaveClass("h-[72px]", "pl-20", "pr-5", "md:px-10");
  });
});
