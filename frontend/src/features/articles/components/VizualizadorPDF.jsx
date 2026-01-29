import { DownloadIcon, FileIcon, FileTextIcon } from "lucide-react";
import { Button } from "@/components/ui/button.js";
import { articleService } from "@/services/artigosService";
import { useState } from "react";

function VizualizadorPDF({ projetoId, artigoId, artigo }) {
  const [pdfError, setPdfError] = useState(false);

  const hasPdf = artigo?.hasPdf;
  const hasAbstract = artigo?.abstract && artigo.abstract.trim().length > 0;

  const handleOpenPdf = () => {
    window.open(articleService.getPdfUrl(projetoId, artigoId), "_blank");
  };

  // Se não tem PDF, mostra o abstract ou mensagem
  if (!hasPdf) {
    return (
      <div className="lg:col-span-3 bg-card border border-border overflow-hidden h-full">
        <div className="w-full h-full min-h-[500px] flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border bg-muted/50">
            <div className="flex items-center gap-2">
              <FileTextIcon className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium text-sm">
                {hasAbstract ? "Abstract / Resumo" : "Conteúdo do Artigo"}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-6">
            {hasAbstract ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                  {artigo.abstract}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <FileIcon className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  Nenhum conteúdo disponível
                </h3>
                <p className="text-muted-foreground max-w-md">
                  Este artigo não possui PDF nem abstract cadastrado.
                  Você pode adicionar um PDF através da edição do artigo.
                </p>
              </div>
            )}
          </div>

          {/* Footer info */}
          {hasAbstract && (
            <div className="px-4 py-2 border-t border-border bg-muted/30">
              <p className="text-xs text-muted-foreground">
                PDF não disponível para este artigo. Exibindo o abstract/resumo.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Tem PDF - mostra o visualizador
  return (
    <div className="lg:col-span-3 bg-card border border-border overflow-hidden h-full">
      <div className="w-full h-full min-h-[500px]">
        {pdfError ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center bg-gray-50 dark:bg-gray-900">
            <FileIcon className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              Não foi possível carregar o visualizador de PDF
            </h3>
            <p className="text-muted-foreground mb-4">
              O PDF está disponível para download ou visualização em nova aba
            </p>
            <div className="flex gap-3 mt-2">
              <Button
                onClick={handleOpenPdf}
                className="flex items-center gap-2"
              >
                <FileIcon className="h-4 w-4" />
                Abrir PDF em Nova Aba
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  window.open(
                    articleService.getPdfDownloadUrl(projetoId, artigoId),
                    "_blank"
                  )
                }
                className="flex items-center gap-2"
              >
                <DownloadIcon className="h-4 w-4" />
                Download PDF
              </Button>
              <Button
                variant="outline"
                onClick={() => setPdfError(false)}
                className="flex items-center gap-2"
              >
                Tentar Novamente
              </Button>
            </div>
          </div>
        ) : (
          <object
            data={articleService.getPdfUrl(projetoId, artigoId)}
            type="application/pdf"
            title={artigo.title}
            className="w-full h-full border-0"
            onError={() => setPdfError(true)}
          >
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
              <FileIcon className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="mb-2">Não foi possível exibir o PDF no navegador</p>
              <Button
                variant="outline"
                onClick={handleOpenPdf}
                className="flex items-center gap-2 mt-2"
              >
                <FileIcon className="h-4 w-4" />
                Abrir PDF em Nova Aba
              </Button>
            </div>
          </object>
        )}
      </div>
    </div>
  );
}

export default VizualizadorPDF;
