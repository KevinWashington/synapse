import { useEffect, useMemo, useState } from "react";
import { DownloadIcon, FileIcon, FileTextIcon, LoaderIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { articleService } from "@features/articles/services/articleService";

function PdfViewer({ projectId, articleId, article, pdfData }) {
  const [pdfError, setPdfError] = useState(false);

  const hasPdf = article?.hasPdf;
  const hasAbstract = article?.abstract && article.abstract.trim().length > 0;

  const pdfObjectUrl = useMemo(() => {
    if (!pdfData) {
      return null;
    }
    const blob = new Blob([pdfData], { type: "application/pdf" });
    return URL.createObjectURL(blob);
  }, [pdfData]);

  useEffect(() => {
    return () => {
      if (pdfObjectUrl) {
        URL.revokeObjectURL(pdfObjectUrl);
      }
    };
  }, [pdfObjectUrl]);

  async function handleOpenPdf() {
    if (pdfObjectUrl) {
      window.open(pdfObjectUrl, "_blank", "noopener,noreferrer");
      return;
    }
    await articleService.openPdfInNewTab(projectId, articleId);
  }

  async function handleDownloadPdf() {
    await articleService.downloadPdf(projectId, articleId);
  }

  if (!hasPdf) {
    return (
      <div className="h-full overflow-hidden rounded-[var(--syn-radius-card)] border border-[var(--syn-border)] bg-[var(--syn-bg-primary)]">
        <div className="flex h-full min-h-0 w-full flex-col">
          <div className="border-b border-[var(--syn-border)] px-4 py-3">
            <div className="flex items-center gap-2">
              <FileTextIcon className="h-4 w-4 text-[var(--syn-text-secondary)]" />
              <span className="text-sm font-semibold text-[var(--syn-text-primary)]">
                {hasAbstract ? "Abstract / Resumo" : "Conteudo do Artigo"}
              </span>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-6">
            {hasAbstract ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--syn-text-primary)]">
                {article.abstract}
              </p>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <FileIcon className="mb-4 h-16 w-16 text-[var(--syn-text-secondary)]" />
                <h3 className="mb-2 text-lg font-medium text-[var(--syn-text-primary)]">Nenhum conteudo disponivel</h3>
                <p className="max-w-md text-sm text-[var(--syn-text-secondary)]">
                  Este artigo nao possui PDF nem abstract cadastrado.
                </p>
              </div>
            )}
          </div>
          {hasAbstract ? (
            <div className="border-t border-[var(--syn-border)] px-4 py-2">
              <p className="text-[10px] text-[var(--syn-text-secondary)]">
                PDF nao disponivel para este artigo. Exibindo o abstract/resumo.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden rounded-[var(--syn-radius-card)] border border-[var(--syn-border)] bg-[var(--syn-bg-primary)]">
      <div className="h-full min-h-0 w-full">
        {!pdfObjectUrl && !pdfError ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-[var(--syn-text-secondary)]">
            <LoaderIcon className="h-4 w-4 animate-spin" />
            Carregando PDF...
          </div>
        ) : pdfError ? (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center">
            <FileIcon className="mb-4 h-16 w-16 text-[var(--syn-text-secondary)]" />
            <h3 className="mb-2 text-lg font-medium text-[var(--syn-text-primary)]">
              Nao foi possivel carregar o visualizador de PDF
            </h3>
            <p className="mb-4 text-sm text-[var(--syn-text-secondary)]">
              O PDF esta disponivel para download ou visualizacao em nova aba.
            </p>
            <div className="mt-2 flex gap-3">
              <Button onClick={handleOpenPdf} className="gap-2">
                <FileIcon className="h-4 w-4" />
                Abrir PDF em Nova Aba
              </Button>
              <Button variant="outline" onClick={handleDownloadPdf} className="gap-2">
                <DownloadIcon className="h-4 w-4" />
                Download PDF
              </Button>
              <Button variant="outline" onClick={() => setPdfError(false)}>
                Tentar Novamente
              </Button>
            </div>
          </div>
        ) : (
          <object
            data={pdfObjectUrl}
            type="application/pdf"
            title={article.title}
            className="h-full w-full border-0"
            onError={() => setPdfError(true)}
          >
            <div className="flex h-full flex-col items-center justify-center p-6 text-center">
              <FileIcon className="mb-4 h-16 w-16 text-[var(--syn-text-secondary)]" />
              <p className="mb-2 text-sm text-[var(--syn-text-primary)]">Nao foi possivel exibir o PDF no navegador.</p>
              <div className="mt-2 flex gap-3">
                <Button variant="outline" onClick={handleOpenPdf} className="gap-2">
                  <FileIcon className="h-4 w-4" />
                  Abrir PDF em Nova Aba
                </Button>
                <Button variant="outline" onClick={handleDownloadPdf} className="gap-2">
                  <DownloadIcon className="h-4 w-4" />
                  Download PDF
                </Button>
              </div>
            </div>
          </object>
        )}
      </div>
    </div>
  );
}

export default PdfViewer;
