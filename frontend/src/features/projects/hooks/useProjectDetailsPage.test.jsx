import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useProjectDetailsPage from "./useProjectDetailsPage";

vi.mock("@features/projects/services/projectService", () => ({
  projectService: {
    getProjectById: vi.fn().mockResolvedValue({ id: 7, title: "Projeto" }),
  },
}));

vi.mock("@/lib/toast", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

function Harness() {
  const { activeTab, setActiveTab } = useProjectDetailsPage();
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div>
      <output aria-label="aba ativa">{activeTab}</output>
      <output aria-label="consulta atual">{location.search}</output>
      <button type="button" onClick={() => setActiveTab("overview")}>Visão Geral</button>
      <button type="button" onClick={() => setActiveTab("planejamento")}>Planejamento</button>
      <button type="button" onClick={() => setActiveTab("artigos")}>Artigos</button>
      <button type="button" onClick={() => setActiveTab("fluxo")}>Fluxo</button>
      <button type="button" onClick={() => navigate(-1)}>Voltar</button>
      <button type="button" onClick={() => navigate(1)}>Avançar</button>
    </div>
  );
}

function renderAt(entry) {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/projetos/:id" element={<Harness />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("useProjectDetailsPage navigation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("opens planejamento from overview with one final URL", async () => {
    renderAt("/projetos/7");

    screen.getByRole("button", { name: "Planejamento" }).click();

    await waitFor(() => {
      expect(screen.getByLabelText("aba ativa")).toHaveTextContent("planejamento");
      expect(screen.getByLabelText("consulta atual")).toHaveTextContent("?tab=planejamento");
    });
  });

  it("opens artigos from fluxo with an explicit default flow in one update", async () => {
    renderAt("/projetos/7?tab=fluxo");

    screen.getByRole("button", { name: "Artigos" }).click();

    await waitFor(() => {
      expect(screen.getByLabelText("aba ativa")).toHaveTextContent("artigos");
      expect(screen.getByLabelText("consulta atual")).toHaveTextContent(
        "?tab=artigos&flow=identification"
      );
    });
  });

  it("removes article-only parameters when leaving artigos", async () => {
    renderAt("/projetos/7?tab=artigos&flow=screening&action=import");

    screen.getByRole("button", { name: "Fluxo" }).click();

    await waitFor(() => {
      expect(screen.getByLabelText("aba ativa")).toHaveTextContent("fluxo");
      expect(screen.getByLabelText("consulta atual")).toHaveTextContent("?tab=fluxo");
    });
  });

  it("follows browser history without restoring a stale local tab", async () => {
    renderAt("/projetos/7");
    screen.getByRole("button", { name: "Planejamento" }).click();
    screen.getByRole("button", { name: "Artigos" }).click();

    await act(async () => screen.getByRole("button", { name: "Voltar" }).click());

    await waitFor(() => {
      expect(screen.getByLabelText("aba ativa")).toHaveTextContent("planejamento");
      expect(screen.getByLabelText("consulta atual")).toHaveTextContent("?tab=planejamento");
    });
  });

  it("resolves an invalid tab directly to overview", () => {
    renderAt("/projetos/7?tab=desconhecida&flow=screening");

    expect(screen.getByLabelText("aba ativa")).toHaveTextContent("overview");
  });
});
