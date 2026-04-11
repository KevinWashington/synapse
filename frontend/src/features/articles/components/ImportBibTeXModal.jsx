import { useState } from "react";
import { FileTextIcon, LoaderIcon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
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
import { toast } from "@/lib/toast";
import { parse as parseBibTeXLib } from "bibtex-parse";

function ImportBibTeXModal({ isOpen, onClose, onSuccess, projectId }) {
  const [bibtexContent, setBibtexContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    if (!bibtexContent.trim()) {
      setError("Por favor, selecione um arquivo .bib");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const articles = parseBibTeX(bibtexContent);

      if (articles.length === 0) {
        setError("Nenhum artigo válido encontrado no arquivo BibTeX");
        return;
      }

      for (const article of articles) {
        await articleService.createArticleJson(projectId, {
          title: article.title,
          authors: article.authors,
          year: Number.parseInt(article.year, 10),
          journal: article.journal || "Conferência/Periódico não especificado",
          abstract: article.abstract || "",
          doi: article.doi || "",
          keywords: article.keywords || "",
          pages: article.pages || "",
          volume: article.volume || "",
          number: article.number || "",
          issn: article.issn || "",
        });
      }

      toast.success(`${articles.length} artigo(s) importado(s) com sucesso!`);
      onSuccess();
      handleClose();
    } catch (requestError) {
      console.error("Erro ao importar BibTeX:", requestError);
      setError(`Erro ao importar artigos: ${requestError.message}`);
    } finally {
      setLoading(false);
    }
  }

  function parseBibTeX(content) {
    const articles = [];

    try {
      const bibEntries = parseBibTeXLib(content);

      for (const entry of bibEntries) {
        try {
          const fields = {};

          if (entry.fields && Array.isArray(entry.fields)) {
            entry.fields.forEach((field) => {
              if (field.name && field.value) {
                fields[field.name.toLowerCase()] = field.value;
              }
            });
          }

          if (entry.type === "comment" || !entry.type) {
            continue;
          }

          const title = fields.title;
          const authors = fields.author;
          const year = fields.year;

          if (title && authors && year) {
            articles.push({
              title: cleanBibTeXValue(title),
              authors: cleanBibTeXValue(authors),
              year: cleanBibTeXValue(year),
              journal: cleanBibTeXValue(fields.journal || fields.booktitle),
              abstract: cleanBibTeXValue(fields.abstract),
              doi: cleanBibTeXValue(fields.doi),
              keywords: cleanBibTeXValue(fields.keywords),
              pages: cleanBibTeXValue(fields.pages),
              volume: cleanBibTeXValue(fields.volume),
              number: cleanBibTeXValue(fields.number),
              issn: cleanBibTeXValue(fields.issn),
            });
          }
        } catch (entryError) {
          console.warn("Erro ao processar entrada BibTeX:", entryError);
        }
      }
    } catch (parseError) {
      console.error("Erro ao fazer parsing do BibTeX com biblioteca:", parseError);
      return parseBibTeXManual(content);
    }

    return articles;
  }

  function parseBibTeXManual(content) {
    const articles = [];

    try {
      const normalizedContent = content
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .trim();
      const entries = [];
      const entryPattern = /@\w+\s*{/g;
      const matches = [...normalizedContent.matchAll(entryPattern)];

      for (let index = 0; index < matches.length; index += 1) {
        const startIndex = matches[index].index;
        const endIndex =
          index < matches.length - 1
            ? matches[index + 1].index
            : normalizedContent.length;

        entries.push(normalizedContent.substring(startIndex, endIndex));
      }

      for (const entry of entries) {
        try {
          const entryMatch = entry.match(/@(\w+)\s*{\s*([^,]+),\s*([\s\S]*)/);

          if (!entryMatch) {
            continue;
          }

          const fields = parseEntryFields(entryMatch[3]);
          const title = fields.title;
          const authors = fields.author;
          const year = fields.year;

          if (title && authors && year) {
            articles.push({
              title: cleanBibTeXValue(title),
              authors: cleanBibTeXValue(authors),
              year: cleanBibTeXValue(year),
              journal: cleanBibTeXValue(fields.journal || fields.booktitle),
              abstract: cleanBibTeXValue(fields.abstract),
              doi: cleanBibTeXValue(fields.doi),
              keywords: cleanBibTeXValue(fields.keywords),
              pages: cleanBibTeXValue(fields.pages),
              volume: cleanBibTeXValue(fields.volume),
              number: cleanBibTeXValue(fields.number),
              issn: cleanBibTeXValue(fields.issn),
            });
          }
        } catch (entryError) {
          console.warn("Erro ao processar entrada BibTeX manual:", entryError);
        }
      }
    } catch (parseError) {
      console.error("Erro geral ao processar BibTeX manual:", parseError);
      throw new Error("Formato BibTeX inválido");
    }

    return articles;
  }

  function parseEntryFields(entryContent) {
    const fields = {};
    const cleanContent = entryContent.replace(/\s*}\s*$/, "");

    function findClosingBrace(text, startPosition) {
      let braceCount = 1;
      let currentPosition = startPosition;

      while (currentPosition < text.length && braceCount > 0) {
        if (text[currentPosition] === "{") {
          braceCount += 1;
        } else if (text[currentPosition] === "}") {
          braceCount -= 1;
        }

        currentPosition += 1;
      }

      return braceCount === 0 ? currentPosition - 1 : -1;
    }

    const fieldStartRegex = /(\w+)\s*=\s*{/g;
    let match;

    while ((match = fieldStartRegex.exec(cleanContent)) !== null) {
      const fieldName = match[1].toLowerCase();
      const fieldStart = match.index + match[0].length;
      const closingBrace = findClosingBrace(cleanContent, fieldStart);

      if (closingBrace !== -1) {
        fields[fieldName] = cleanContent.substring(fieldStart, closingBrace).trim();
      }
    }

    cleanContent.split(",").forEach((field) => {
      const simpleMatch = field.match(/^\s*(\w+)\s*=\s*([^{,\n}]+)\s*$/);

      if (simpleMatch) {
        const fieldName = simpleMatch[1].toLowerCase();

        if (!fields[fieldName]) {
          fields[fieldName] = simpleMatch[2].trim();
        }
      }
    });

    return fields;
  }

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

  function handleClose() {
    setBibtexContent("");
    setError("");
    onClose();
  }

  function handleFileUpload(event) {
    const file = event.target.files[0];

    if (!file) {
      setError("Por favor, selecione um arquivo .bib válido");
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      setBibtexContent(loadEvent.target.result);
    };
    reader.readAsText(file, "utf-8");
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UploadIcon className="h-5 w-5" />
            Importar Artigos BibTeX
          </DialogTitle>
          <DialogDescription>
            Faça upload de um arquivo .bib para importar múltiplos artigos de
            uma vez.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bibtex-file">Ou faça upload de um arquivo .bib</Label>
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
                onClick={() => document.getElementById("bibtex-file").click()}
                className="flex items-center gap-2"
              >
                <FileTextIcon className="h-4 w-4" />
                Selecionar Arquivo
              </Button>
            </div>
          </div>

          <ArticleDialogErrorAlert error={error} />

          <ArticleDialogFooter
            confirmIcon={UploadIcon}
            confirmLabel={`Importar ${bibtexContent ? "Arquivo" : "Artigos"}`}
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



