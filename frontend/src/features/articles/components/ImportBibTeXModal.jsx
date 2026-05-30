import { useState } from "react";
import { FileTextIcon, LoaderIcon, UploadIcon } from "lucide-react";
import { parse as parseBibTeXLib } from "bibtex-parse";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import ArticleDialogErrorAlert from "@features/articles/components/ArticleDialogErrorAlert";
import ArticleDialogFooter from "@features/articles/components/ArticleDialogFooter";
import { articleService } from "@features/articles/services/articleService";
import { SOURCE_CATEGORY_OPTIONS, SOURCE_NAME_OPTIONS, STUDY_TYPE_OPTIONS } from "@features/articles/utils/selectionFlow";
import { toast } from "@/lib/toast";

function ImportBibTeXModal({ isOpen, onClose, onSuccess, projectId }) {
  const [bibtexContent, setBibtexContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sourceCategory, setSourceCategory] = useState("database");
  const [sourceName, setSourceName] = useState("Scopus");
  const [studyType, setStudyType] = useState("");
  const [batchLabel, setBatchLabel] = useState("");

  function cleanBibTeXValue(value) {
    if (!value) {
      return "";
    }

    return value
      .replace(/\\[a-zA-Z]+(\[[^\]]*\])?(\{[^}]*\})?/g, "")
      .replace(/\\([{}$&%#^_~])/g, "$1")
      .replace(/^{+|}+$/g, "")
      .replace(/([^\\]){+([^}]*)}/g, "$1$2")
      .replace(/\s*,\s*$/, "")
      .replace(/\s+/g, " ")
      .replace(/^"(.*)"$/, "$1")
      .trim();
  }

  function parseBibTeX(content) {
    const articles = [];
    const bibEntries = parseBibTeXLib(content);

    for (const entry of bibEntries) {
      const fields = {};
      if (entry.fields && Array.isArray(entry.fields)) {
        entry.fields.forEach((field) => {
          if (field.name && field.value) {
            fields[field.name.toLowerCase()] = field.value;
          }
        });
      }

      const title = cleanBibTeXValue(fields.title);
      const authors = cleanBibTeXValue(fields.author);
      const year = Number.parseInt(cleanBibTeXValue(fields.year), 10);
      if (!title || !authors || Number.isNaN(year)) {
        continue;
      }

      articles.push({
        title,
        authors,
        year,
        journal:
          cleanBibTeXValue(fields.journal || fields.booktitle) ||
          "Conferencia/Periodico nao especificado",
        abstract: cleanBibTeXValue(fields.abstract),
        doi: cleanBibTeXValue(fields.doi),
        keywords: cleanBibTeXValue(fields.keywords),
        pages: cleanBibTeXValue(fields.pages),
        volume: cleanBibTeXValue(fields.volume),
        number: cleanBibTeXValue(fields.number),
        issn: cleanBibTeXValue(fields.issn),
      });
    }

    return articles;
  }

  function handleClose() {
    setBibtexContent("");
    setError("");
    setSourceCategory("database");
    setSourceName("Scopus");
    setStudyType("");
    setBatchLabel("");
    onClose();
  }

  function handleFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) {
      setError("Selecione um arquivo .bib valido");
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      setBibtexContent(loadEvent.target?.result || "");
    };
    reader.readAsText(file, "utf-8");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!bibtexContent.trim()) {
      setError("Por favor, selecione um arquivo .bib");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const entries = parseBibTeX(bibtexContent);
      if (!entries.length) {
        setError("Nenhum artigo valido encontrado no arquivo BibTeX");
        return;
      }

      const response = await articleService.importBibTeX(projectId, {
        sourceCategory,
        sourceName,
        studyType: studyType || null,
        importBatchLabel: batchLabel || null,
        entries,
      });

      toast.success(`${response.importedCount || entries.length} registro(s) importado(s)!`);
      onSuccess?.(response);
      handleClose();
    } catch (requestError) {
      setError(`Erro ao importar artigos: ${requestError.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UploadIcon className="h-5 w-5" />
            Importar BibTeX
          </DialogTitle>
          <DialogDescription>
            Importe registros para a fase de Identificacao com origem rastreavel.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Categoria da origem</Label>
              <Select value={sourceCategory} onValueChange={setSourceCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Origem</Label>
              <Select value={sourceName} onValueChange={setSourceName}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_NAME_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tipo de estudo</Label>
            <Select value={studyType || "unclassified"} onValueChange={(value) => setStudyType(value === "unclassified" ? "" : value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unclassified">Nao classificado</SelectItem>
                {STUDY_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="batch-label">Lote de importacao</Label>
            <Input
              id="batch-label"
              value={batchLabel}
              onChange={(event) => setBatchLabel(event.target.value)}
              placeholder="Ex: Scopus-mar-2026"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bibtex-file">Arquivo .bib</Label>
            <div className="flex items-center gap-2">
              <input
                id="bibtex-file"
                type="file"
                accept=".bib,.txt,text/plain"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById("bibtex-file")?.click()}
                className="flex items-center gap-2"
              >
                <FileTextIcon className="h-4 w-4" />
                Selecionar arquivo
              </Button>
              {bibtexContent ? (
                <span className="text-xs text-[var(--syn-text-secondary)]">Arquivo carregado</span>
              ) : null}
            </div>
          </div>

          <ArticleDialogErrorAlert error={error} />

          <ArticleDialogFooter
            confirmIcon={UploadIcon}
            confirmLabel="Importar registros"
            disabled={loading || !bibtexContent.trim()}
            loading={loading}
            loadingLabel={
              <>
                <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                Importando...
              </>
            }
            onCancel={handleClose}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ImportBibTeXModal;
