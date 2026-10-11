import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ArticleDetails from "./ArticleDetails";

const navigate = vi.fn();
const handleSaveNotes = vi.fn().mockResolvedValue(undefined);
let workspaceTab = "extracao";

const article = {
  id: 2,
  title: "Estudo atual",
  authors: "Ana Autor",
  year: 2026,
  journal: "Revista",
  currentPhase: "eligibility",
  reviewOutcome: "included",
  extractionData: { resultado: "" },
  qualityAssessmentAnswers: {},
  notas: "",
  hasPdf: true,
};

const project = {
  id: 7,
  title: "Revisão de saúde",
  status: "em-progresso",
  dataExtractionSchema: [{ key: "resultado", label: "Resultado", type: "text" }],
  qualityAssessmentSchema: [],
};

const articleList = [
  { ...article, id: 1, title: "Estudo anterior" },
  article,
  { ...article, id: 3, title: "Próximo estudo" },
];

vi.mock("@/features/auth", () => ({
  useAuth: () => ({
    logout: vi.fn().mockResolvedValue({ success: true }),
    user: { name: "Ana Rocha", email: "ana@example.com" },
  }),
}));

vi.mock("@features/articles/components/PdfViewer", () => ({
  default: () => <div>Visualizador PDF</div>,
}));

vi.mock("@/features/inbox/services/inboxService", () => ({ inboxService: {
  getInbox: async () => ({ notifications: [], invitations: [], unreadNotificationCount: 0, pendingInvitationCount: 0 }),
} }));

vi.mock("@features/articles/public/hooks", () => ({
  useArticleDetailsPage: () => ({
    article,
    articleList,
    articleListTotal: 1093,
    articleListLoading: false,
    articleId: "2",
    backUrl: "/projetos/7?tab=artigos&flow=included",
    error: null,
    handleAddNote: vi.fn(),
    handleDeleteArticle: vi.fn(),
    handleEligibilityDecision: vi.fn(),
    handleSaveEvidence: vi.fn().mockResolvedValue(undefined),
    handleSaveNotes,
    handleScreeningDecision: vi.fn(),
    isSavingEvidence: false,
    loading: false,
    navigate,
    pdfData: new ArrayBuffer(0),
    project,
    projectId: "7",
    refreshArticle: vi.fn(),
    rightTab: workspaceTab,
    setRightTab: vi.fn(),
  }),
}));

function renderPage() {
  window.history.pushState(
    {},
    "",
    "/projetos/7/artigos/2?flow=included&workspace=extracao"
  );
  return render(
    <MemoryRouter>
      <ArticleDetails />
    </MemoryRouter>
  );
}

describe("ArticleDetails extraction workspace", () => {
  beforeEach(() => {
    workspaceTab = "extracao";
    navigate.mockClear();
    handleSaveNotes.mockClear();
    delete article.hasActiveReviewAssignments;
    delete article.myReviewAssignment;
    delete article.canWriteReview;
    delete article.canManageArticle;
    article.currentPhase = "eligibility";
    article.reviewOutcome = "included";
    article.hasPdf = true;
  });

  it("collapses the review support panel without discarding unsaved notes", async () => {
    workspaceTab = "notas";
    article.reviewOutcome = "active";
    renderPage();
    const editor = await screen.findByRole("textbox", { name: "Notas do artigo" }, { timeout: 5000 });
    fireEvent.change(editor, { target: { value: "Nota preservada ao recolher" } });
    fireEvent.click(screen.getByRole("button", { name: "Recolher painel de apoio" }));
    expect(editor).not.toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Expandir painel de apoio" }));
    expect(screen.getByRole("textbox", { name: "Notas do artigo" })).toHaveValue("Nota preservada ao recolher");
  });

  it("switches between PDF and notes without losing extraction values", async () => {
    renderPage();

    const extractionField = await screen.findByPlaceholderText("Digite resultado...");
    fireEvent.change(extractionField, { target: { value: "Efeito preservado" } });

    expect(screen.queryByRole("button", { name: "Ver detalhes do artigo" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Notas" }));

    const notesField = await screen.findByPlaceholderText(
      "Digite suas notas aqui...",
      {},
      { timeout: 5000 }
    );
    fireEvent.change(notesField, { target: { value: "Nota da extracao" } });
    await waitFor(() => expect(handleSaveNotes).toHaveBeenCalledWith("Nota da extracao"), {
      timeout: 2500,
    });

    fireEvent.click(screen.getByRole("button", { name: "PDF" }));
    expect(screen.getByText("Visualizador PDF")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Digite resultado...")).toHaveValue("Efeito preservado");

    fireEvent.click(screen.getByRole("button", { name: "Notas" }));
    expect(screen.getByPlaceholderText("Digite resultado...")).toHaveValue("Efeito preservado");
  });

  it("keeps the extraction URL when navigating between included studies", async () => {
    renderPage();
    await screen.findByPlaceholderText("Digite resultado...");

    fireEvent.click(screen.getByRole("button", { name: /Anterior/ }));
    expect(navigate).toHaveBeenCalledWith(
      "/projetos/7/artigos/1?flow=included&workspace=extracao"
    );

    fireEvent.click(screen.getByRole("button", { name: "PróximoPróximo estudo" }));
    expect(navigate).toHaveBeenCalledWith(
      "/projetos/7/artigos/3?flow=included&workspace=extracao"
    );
  });

  it("keeps whitespace and empty objects pending in the article list", async () => {
    const listedArticle = articleList[2];
    Object.assign(listedArticle, { extractionData: { resultado: "  ", extra: {} }, extractionCompletedAt: null });
    project.dataExtractionSchema = [{ key: "resultado" }, { key: "extra" }];
    try {
      renderPage();
      const listedTitle = (await screen.findAllByText("Próximo estudo"))[0];
      const listedButton = listedTitle.closest("button");
      expect(listedButton).toHaveTextContent("Pendente");
      expect(listedButton).not.toHaveTextContent("Rascunho");
      expect(screen.getByText("Em extração")).toBeInTheDocument();
    } finally {
      listedArticle.extractionData = article.extractionData;
      project.dataExtractionSchema = [{ key: "resultado", label: "Resultado", type: "text" }];
    }
  });

  it("shows the server total instead of treating the loaded detail list as the whole stage", async () => {
    renderPage();
    await screen.findByPlaceholderText("Digite resultado...");

    expect(screen.getAllByText(/de 1\.093 estudos/).length).toBeGreaterThan(0);
  });

  it("keeps an unassigned extraction workspace readable with all write controls disabled", async () => {
    Object.assign(article, { hasActiveReviewAssignments: true, myReviewAssignment: null, canWriteReview: false, canManageArticle: false });
    renderPage();
    const field = await screen.findByPlaceholderText("Digite resultado...");
    expect(field).toBeDisabled();
    expect(screen.getByRole("button", { name: "Salvar rascunho" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Marcar como concluído/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Notas" }));
    expect(await screen.findByPlaceholderText("Digite suas notas aqui...")).toHaveAttribute("readonly");
    expect(screen.getAllByText("Este artigo não foi atribuído a você.").length).toBeGreaterThan(0);
  });

  it("disables eligibility, PDF and administrative actions for an unassigned reviewer", async () => {
    Object.assign(article, { currentPhase: "eligibility", reviewOutcome: "active", hasPdf: false,
      hasActiveReviewAssignments: true, myReviewAssignment: null, canWriteReview: false, canManageArticle: false });
    window.history.pushState({}, "", "/projetos/7/artigos/2?flow=eligibility");
    render(<MemoryRouter><ArticleDetails /></MemoryRouter>);
    expect(await screen.findByRole("button", { name: "Registrar elegibilidade" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Enviar PDF" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remover" })).toBeDisabled();
    expect(screen.getByRole("heading", { name: "Estudo atual" })).toBeInTheDocument();
  });

  it("keeps breadcrumbs, account controls, and shell alignment in extraction", async () => {
    renderPage();
    await screen.findByPlaceholderText("Digite resultado...");

    expect(screen.getByRole("navigation", { name: "Navegação estrutural" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir menu da conta" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Synapse" })).toHaveAttribute("href", "/");
    expect(screen.queryByText("PRISMA")).not.toBeInTheDocument();
    expect(screen.getByText("Synapse").closest("div.grid")).toHaveClass(
      "xl:grid-cols-[240px_minmax(0,1fr)]"
    );
  });
});
