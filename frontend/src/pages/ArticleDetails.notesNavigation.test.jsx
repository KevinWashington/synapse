import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { afterEach, it, expect, vi } from "vitest";
import ArticleDetails from "./ArticleDetails";

const api = vi.hoisted(() => ({ getArticle: vi.fn(), saveNotes: vi.fn(), getList: vi.fn() }));
vi.mock("@services/chatService", () => ({ chatService: { sendChatMessage: async () => ({ content: "Achado documentado no resumo." }) } }));
vi.mock("@features/articles/services/articleService", () => ({ articleService: {
  getArticleById: api.getArticle, updateArticleNotes: api.saveNotes,
  getArticlesByProject: api.getList, getSelectionSummary: async () => ({ included: 2 }),
} }));
vi.mock("@features/projects/services/projectService", () => ({ projectService: {
  getProjectById: async () => ({ id: 7, title: "Projeto", dataExtractionSchema: [], qualityAssessmentSchema: [] }),
} }));
vi.mock("@/features/auth", () => ({ useAuth: () => ({ user: { name: "Revisor" }, logout: vi.fn() }) }));
vi.mock("@features/articles/components/PdfViewer", () => ({ default: () => <div>Conteúdo do artigo</div> }));
vi.mock("@/components/layout", async (importOriginal) => ({
  ...await importOriginal(), AppHeader: () => <header>Synapse</header>,
}));

function RoutedPage({ flow }) {
  const navigate = useNavigate();
  return <>
    <button onClick={() => navigate(`/projetos/7/artigos/11?flow=included&workspace=chat`)}>Voltar ao assistente</button>
    <button onClick={() => navigate(`/projetos/7/artigos/12?flow=${flow}`)}>Navegar para outro estudo</button>
    <ArticleDetails />
  </>;
}

afterEach(() => vi.useRealTimers());

it("closes the previous study's destructive confirmation when navigation starts", async () => {
  const first = { id: 11, title: "Estudo A", hasPdf: false, currentPhase: "eligibility", reviewOutcome: "active" };
  let finishSecond;
  api.getArticle.mockImplementation((_project, id) => id === "11" ? Promise.resolve(first)
    : new Promise((resolve) => { finishSecond = resolve; }));
  api.getList.mockResolvedValue({ articles: [first], total: 1 });
  const url = "/projetos/7/artigos/11?flow=eligibility";
  window.history.replaceState({}, "", url);
  render(<MemoryRouter initialEntries={[url]}><Routes>
    <Route path="/projetos/:projectId/artigos/:articleId" element={<RoutedPage flow="eligibility" />} />
  </Routes></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "Remover", exact: true }));
  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  // Trigger a route change outside the modal, like browser history navigation.
  fireEvent.click(screen.getByText("Navegar para outro estudo"));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await act(async () => finishSecond({ ...first, id: 12, title: "Estudo B" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it.each(["eligibility", "included"])("keeps the %s sidebar mounted and search intact while loading another study", async (flow) => {
  const first = { id: 11, title: "Estudo A", hasPdf: false, notas: "", currentPhase: "eligibility",
    reviewOutcome: flow === "included" ? "included" : "active" };
  const second = { ...first, id: 12, title: "Estudo B" };
  let finishSecond;
  api.getArticle.mockImplementation((_project, id) => id === "11" ? Promise.resolve(first)
    : new Promise((resolve) => { finishSecond = resolve; }));
  api.getList.mockResolvedValue({ articles: [first, second], total: 2 });
  const url = `/projetos/7/artigos/11?flow=${flow}`;
  window.history.replaceState({}, "", url);
  render(<MemoryRouter initialEntries={[url]}><Routes>
    <Route path="/projetos/:projectId/artigos/:articleId" element={<ArticleDetails />} />
  </Routes></MemoryRouter>);
  const search = await screen.findByPlaceholderText("Buscar estudos");
  fireEvent.change(search, { target: { value: "Estudo" } });
  const sidebar = search.closest("aside");
  fireEvent.click(within(sidebar).getByRole("button", { name: /Estudo B/ }));
  expect(screen.getByPlaceholderText("Buscar estudos")).toBe(search);
  expect(search).toHaveValue("Estudo");
  expect(screen.getByText("Carregando artigo...")).toBeInTheDocument();
  await act(async () => finishSecond(second));
  await waitFor(() => expect(screen.queryByText("Carregando artigo...")).not.toBeInTheDocument());
  expect(screen.getByPlaceholderText("Buscar estudos").closest("aside")).toBe(sidebar);
  expect(search).toHaveValue("Estudo");
});

it("keeps navigation usable after a failed study load and retries in place", async () => {
  const first = { id: 11, title: "Estudo A", hasPdf: false, currentPhase: "eligibility", reviewOutcome: "active" };
  const second = { ...first, id: 12, title: "Estudo B" };
  api.getArticle.mockResolvedValueOnce(first).mockRejectedValueOnce(new Error("Conexão interrompida"))
    .mockResolvedValueOnce(second);
  api.getList.mockResolvedValue({ articles: [first, second], total: 2 });
  const url = "/projetos/7/artigos/11?flow=eligibility";
  window.history.replaceState({}, "", url);
  render(<MemoryRouter initialEntries={[url]}><Routes>
    <Route path="/projetos/:projectId/artigos/:articleId" element={<ArticleDetails />} />
  </Routes></MemoryRouter>);
  const search = await screen.findByPlaceholderText("Buscar estudos");
  fireEvent.click(within(search.closest("aside")).getByRole("button", { name: /Estudo B/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Conexão interrompida");
  expect(screen.getByPlaceholderText("Buscar estudos")).toBe(search);
  expect(screen.queryByRole("textbox", { name: "Notas do artigo" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  await screen.findByRole("heading", { name: "Estudo B" });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByPlaceholderText("Buscar estudos")).toBe(search);
});

it("keeps the conversation and pending question when visiting extraction", async () => {
  const article = { id: 11, title: "Estudo A", abstract: "Resumo do estudo", hasPdf: false,
    currentPhase: "eligibility", reviewOutcome: "included", notas: "" };
  api.getArticle.mockResolvedValue(article);
  api.getList.mockResolvedValue({ articles: [article], total: 1 });
  const url = "/projetos/7/artigos/11?flow=included&workspace=chat";
  window.history.replaceState({}, "", url);
  render(<MemoryRouter initialEntries={[url]}><Routes>
    <Route path="/projetos/:projectId/artigos/:articleId" element={<RoutedPage flow="included" />} />
  </Routes></MemoryRouter>);
  const input = await screen.findByRole("textbox", { name: "Pergunta ao assistente" }, { timeout: 5000 });
  fireEvent.change(input, { target: { value: "Resuma" } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar pergunta" }));
  await screen.findByText("Achado documentado no resumo.");
  fireEvent.change(input, { target: { value: "E as limitações?" } });
  fireEvent.click(screen.getByRole("button", { name: "Extração", exact: true }));
  expect(screen.queryByRole("textbox", { name: "Pergunta ao assistente" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Voltar ao assistente" }));
  expect(await screen.findByRole("textbox", { name: "Pergunta ao assistente" })).toHaveValue("E as limitações?");
  expect(screen.getByText("Achado documentado no resumo.")).toBeInTheDocument();
});

it.each(["identification", "included"])("never sends the previous %s article's in-flight note to the new route", async (flow) => {
  const article = {
    id: 11, title: "Estudo A", authors: "Autora", year: 2026, journal: "Revista",
    hasPdf: false, notas: "", currentPhase: flow === "included" ? "eligibility" : flow,
    reviewOutcome: flow === "included" ? "included" : "active",
  };
  let finishFirstSave;
  const saved = [];
  api.getArticle.mockImplementation(async (_project, id) => {
    if (id === "12") return new Promise(() => {});
    return article;
  });
  api.getList.mockResolvedValue({ articles: [article, { ...article, id: 12, title: "Estudo B" }], total: 2 });
  api.saveNotes.mockImplementation(async (_project, id, value) => {
    saved.push({ id, value });
    if (saved.length === 1) await new Promise((resolve) => { finishFirstSave = resolve; });
    return { ...article, id: Number(id), notas: value };
  });
  window.history.replaceState({}, "", `/projetos/7/artigos/11?flow=${flow}`);
  render(<MemoryRouter initialEntries={[`/projetos/7/artigos/11?flow=${flow}`]}>
    <Routes><Route path="/projetos/:projectId/artigos/:articleId" element={<RoutedPage flow={flow} />} /></Routes>
  </MemoryRouter>);
  if (flow === "included") fireEvent.click(await screen.findByRole("button", { name: "Notas" }));
  const editor = await screen.findByRole("textbox", { name: "Notas do artigo" });
  vi.useFakeTimers();
  fireEvent.change(editor, { target: { value: "Versão A1" } });
  await act(async () => vi.advanceTimersByTimeAsync(1500));
  fireEvent.change(editor, { target: { value: "Versão A2" } });
  fireEvent.click(screen.getByRole("button", { name: "Navegar para outro estudo" }));
  await act(async () => finishFirstSave());
  expect(saved).toEqual([{ id: "11", value: "Versão A1" }, { id: "11", value: "Versão A2" }]);
});
