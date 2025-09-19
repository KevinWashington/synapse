import { useState } from "react";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  LoaderIcon,
  UploadIcon,
  FileTextIcon,
  AlertTriangleIcon,
} from "lucide-react";
import { articleService } from "../services/artigosService.js";

import { parse as parseBibTeXLib } from "bibtex-parse";

function ImportarBibTeXModal({ isOpen, onClose, onSuccess, projectId }) {
  const [bibtexContent, setBibtexContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!bibtexContent.trim()) {
      setError("Por favor, selecione um arquivo .bib");
      return;
    }

    try {
      setLoading(true);
      setError("");

      // Parse do BibTeX e criação dos artigos
      const artigos = parseBibTeX(bibtexContent);

      if (artigos.length === 0) {
        setError("Nenhum artigo válido encontrado no arquivo BibTeX");
        return;
      }

      // Criar cada artigo
      for (const artigo of artigos) {
        const formData = new FormData();
        formData.append("title", artigo.title);
        formData.append("authors", artigo.authors);
        formData.append("year", parseInt(artigo.year)); // Converter para número
        formData.append(
          "journal",
          artigo.journal || "Conferência/Periódico não especificado"
        ); // Campo obrigatório
        formData.append("abstract", artigo.abstract || "");
        formData.append("doi", artigo.doi || "");
        formData.append("keywords", artigo.keywords || "");
        formData.append("pages", artigo.pages || "");
        formData.append("volume", artigo.volume || "");
        formData.append("number", artigo.number || "");
        formData.append("issn", artigo.issn || "");

        // PDF não é mais obrigatório - artigo será criado sem PDF
        await articleService.createArticle(projectId, formData);
      }

      alert(`${artigos.length} artigo(s) importado(s) com sucesso!`);
      onSuccess();
      handleClose();
    } catch (err) {
      console.error("Erro ao importar BibTeX:", err);
      setError("Erro ao importar artigos: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const parseBibTeX = (content) => {
    const artigos = [];

    try {
      // Usar a biblioteca bibtex-parse
      const bibEntries = parseBibTeXLib(content);

      console.log(`Biblioteca encontrou ${bibEntries.length} entradas BibTeX`);

      for (const entry of bibEntries) {
        try {
          // A biblioteca bibtex-parse retorna objetos com campos em entry.fields
          // Vamos extrair os campos do array fields
          const fields = {};
          if (entry.fields && Array.isArray(entry.fields)) {
            entry.fields.forEach((field) => {
              if (field.name && field.value) {
                fields[field.name.toLowerCase()] = field.value;
              }
            });
          }

          // Debug: mostrar estrutura dos campos (removido para produção)

          // Pular entradas que não são artigos (como comentários)
          if (entry.type === "comment" || !entry.type) {
            console.log(`Pulando entrada do tipo: ${entry.type}`);
            continue;
          }

          const title = fields.title;
          const authors = fields.author;
          const year = fields.year;
          const journal = fields.journal || fields.booktitle;
          const abstract = fields.abstract;
          const doi = fields.doi;
          const keywords = fields.keywords;
          const pages = fields.pages;
          const volume = fields.volume;
          const number = fields.number;
          const issn = fields.issn;

          // Validar campos obrigatórios
          if (title && authors && year) {
            console.log(
              `✓ Artigo válido encontrado: ${title.substring(0, 50)}...`
            );
            artigos.push({
              title: cleanBibTeXValue(title),
              authors: cleanBibTeXValue(authors),
              year: cleanBibTeXValue(year),
              journal: cleanBibTeXValue(journal),
              abstract: cleanBibTeXValue(abstract),
              doi: cleanBibTeXValue(doi),
              keywords: cleanBibTeXValue(keywords),
              pages: cleanBibTeXValue(pages),
              volume: cleanBibTeXValue(volume),
              number: cleanBibTeXValue(number),
              issn: cleanBibTeXValue(issn),
            });
          } else {
            console.warn(
              `✗ Entrada BibTeX inválida (faltam campos obrigatórios)`
            );
            console.warn("Campos encontrados:", {
              title: !!title,
              authors: !!authors,
              year: !!year,
            });
            console.warn("Entry completa:", entry);
          }
        } catch (err) {
          console.warn(`Erro ao processar entrada BibTeX:`, err);
        }
      }
    } catch (err) {
      console.error("Erro ao fazer parsing do BibTeX com biblioteca:", err);

      // Fallback para parser manual em caso de erro da biblioteca
      console.log("Tentando parser manual como fallback...");
      return parseBibTeXManual(content);
    }

    console.log(`Total de artigos extraídos: ${artigos.length}`);
    return artigos;
  };

  // Parser manual como fallback
  const parseBibTeXManual = (content) => {
    const artigos = [];

    try {
      // Normalizar quebras de linha e espaços
      const normalizedContent = content
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .trim();

      // Dividir por entradas BibTeX usando uma abordagem mais robusta
      const entries = [];
      const entryPattern = /@\w+\s*{/g;
      const matches = [...normalizedContent.matchAll(entryPattern)];

      for (let i = 0; i < matches.length; i++) {
        const startIndex = matches[i].index;
        const endIndex =
          i < matches.length - 1
            ? matches[i + 1].index
            : normalizedContent.length;
        entries.push(normalizedContent.substring(startIndex, endIndex));
      }

      console.log(`Parser manual encontrou ${entries.length} entradas BibTeX`);

      for (const entry of entries) {
        try {
          // Extrair tipo, chave e conteúdo da entrada
          const entryMatch = entry.match(/@(\w+)\s*{\s*([^,]+),\s*([\s\S]*)/);
          if (!entryMatch) {
            console.warn(
              "Formato de entrada inválido:",
              entry.substring(0, 100)
            );
            continue;
          }

          const [, entryKey, entryContent] = entryMatch;

          console.log(`Processando entrada manual: ${entryKey}`);

          // Extrair campos da entrada
          const fields = parseEntryFields(entryContent);

          // Mapear campos para o formato esperado
          const title = fields.title;
          const authors = fields.author;
          const year = fields.year;
          const journal = fields.journal || fields.booktitle;
          const abstract = fields.abstract;
          const doi = fields.doi;
          const keywords = fields.keywords;
          const pages = fields.pages;
          const volume = fields.volume;
          const number = fields.number;
          const issn = fields.issn;

          // Validar campos obrigatórios
          if (title && authors && year) {
            console.log(
              `✓ Artigo válido encontrado (manual): ${title.substring(
                0,
                50
              )}...`
            );
            artigos.push({
              title: cleanBibTeXValue(title),
              authors: cleanBibTeXValue(authors),
              year: cleanBibTeXValue(year),
              journal: cleanBibTeXValue(journal),
              abstract: cleanBibTeXValue(abstract),
              doi: cleanBibTeXValue(doi),
              keywords: cleanBibTeXValue(keywords),
              pages: cleanBibTeXValue(pages),
              volume: cleanBibTeXValue(volume),
              number: cleanBibTeXValue(number),
              issn: cleanBibTeXValue(issn),
            });
          } else {
            console.warn(
              `✗ Entrada BibTeX inválida (manual - faltam campos obrigatórios): ${entryKey}`
            );
            console.warn("Campos encontrados:", {
              title: !!title,
              authors: !!authors,
              year: !!year,
            });
          }
        } catch (err) {
          console.warn(`Erro ao processar entrada BibTeX manual:`, err);
        }
      }
    } catch (err) {
      console.error("Erro geral ao processar BibTeX manual:", err);
      throw new Error("Formato BibTeX inválido");
    }

    console.log(`Total de artigos extraídos (manual): ${artigos.length}`);
    return artigos;
  };

  const parseEntryFields = (entryContent) => {
    const fields = {};

    // Remove a chave de fechamento final se existir
    const cleanContent = entryContent.replace(/\s*}\s*$/, "");

    // Função para encontrar o fechamento correto de chaves
    const findClosingBrace = (text, startPos) => {
      let braceCount = 1;
      let pos = startPos;

      while (pos < text.length && braceCount > 0) {
        if (text[pos] === "{") {
          braceCount++;
        } else if (text[pos] === "}") {
          braceCount--;
        }
        pos++;
      }

      return braceCount === 0 ? pos - 1 : -1;
    };

    // Regex para encontrar início de campo
    const fieldStartRegex = /(\w+)\s*=\s*{/g;
    let match;

    while ((match = fieldStartRegex.exec(cleanContent)) !== null) {
      const fieldName = match[1].toLowerCase();
      const fieldStart = match.index + match[0].length;
      const closingBrace = findClosingBrace(cleanContent, fieldStart);

      if (closingBrace !== -1) {
        const fieldValue = cleanContent.substring(fieldStart, closingBrace);
        fields[fieldName] = fieldValue.trim();
      }
    }

    // Tratamento especial para campos sem chaves (números, etc.)
    const simpleFields = cleanContent.split(",");
    for (const field of simpleFields) {
      const simpleMatch = field.match(/^\s*(\w+)\s*=\s*([^{,\n}]+)\s*$/);
      if (simpleMatch) {
        const [, fieldName, fieldValue] = simpleMatch;
        const normalizedFieldName = fieldName.toLowerCase();

        if (!fields[normalizedFieldName]) {
          fields[normalizedFieldName] = fieldValue.trim();
        }
      }
    }

    return fields;
  };

  const cleanBibTeXValue = (value) => {
    if (!value) return "";

    return (
      value
        // Remove comandos LaTeX
        .replace(/\\[a-zA-Z]+(\[[^\]]*\])?(\{[^}]*\})?/g, "")
        // Remove escapes de caracteres especiais
        .replace(/\\([{}$&%#^_~])/g, "$1")
        // Remove chaves extras
        .replace(/^{+|}+$/g, "")
        .replace(/([^\\]){+([^}]*)}/g, "$1$2")
        // Limpa espaços e vírgulas
        .replace(/\s*,\s*$/, "")
        .replace(/\s+/g, " ")
        // Remove aspas desnecessárias
        .replace(/^"(.*)"$/, "$1")
        .trim()
    );
  };

  const handleClose = () => {
    setBibtexContent("");
    setError("");
    onClose();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Aceita arquivos .bib, .txt ou qualquer arquivo de texto
      const reader = new FileReader();
      reader.onload = (event) => {
        setBibtexContent(event.target.result);
      };
      reader.readAsText(file, "utf-8");
    } else {
      setError("Por favor, selecione um arquivo .bib válido");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
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
          {/* Upload de arquivo */}
          <div className="space-y-2">
            <Label htmlFor="bibtex-file">
              Ou faça upload de um arquivo .bib
            </Label>
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
          {/* Erro */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 dark:bg-red-900 dark:border-red-800 dark:text-red-200">
              <AlertTriangleIcon className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Botões */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !bibtexContent.trim()}>
              {loading ? (
                <>
                  <LoaderIcon className="h-4 w-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <UploadIcon className="h-4 w-4 mr-2" />
                  Importar {bibtexContent ? "Arquivo" : "Artigos"}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ImportarBibTeXModal;
