import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PdfViewer from "./PdfViewer";

describe("PdfViewer", () => {
  it("uses consistent Portuguese copy when only the summary is available", () => {
    render(
      <PdfViewer
        projectId={7}
        articleId={12}
        article={{ title: "Estudo", abstract: "Resumo do estudo", hasPdf: false }}
      />,
    );

    expect(screen.getByText("Resumo")).toBeInTheDocument();
    expect(screen.getByText("PDF não disponível para este artigo. Exibindo o resumo.")).toBeInTheDocument();
    expect(screen.queryByText(/abstract/i)).not.toBeInTheDocument();
  });
});
