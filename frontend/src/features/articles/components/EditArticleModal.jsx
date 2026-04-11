import { useEffect, useState } from "react";
import { AlertTriangleIcon, LoaderIcon, SaveIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SlidePanel } from "@/components/ui/SlidePanel";
import ArticleCommonFields from "@features/articles/components/ArticleCommonFields";
import ArticlePublicationFields from "@features/articles/components/ArticlePublicationFields";
import ArticleStatusSelector from "@features/articles/components/ArticleStatusSelector";
import { articleService } from "@features/articles/services/articleService";
import { toast } from "@/lib/toast";

function EditArticleModal({ isOpen, onClose, onSuccess, project, article }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    title: "",
    authors: "",
    year: "",
    journal: "",
    abstract: "",
    doi: "",
    keywords: "",
    pages: "",
    volume: "",
    number: "",
    issn: "",
    status: "pendente",
  });

  useEffect(() => {
    if (article && isOpen) {
      setFormData({
        title: article.title || "",
        authors: article.authors || "",
        year: article.year || "",
        journal: article.journal || "",
        abstract: article.abstract || "",
        doi: article.doi || "",
        keywords: article.keywords || "",
        pages: article.pages || "",
        volume: article.volume || "",
        number: article.number || "",
        issn: article.issn || "",
        status: article.status || "pendente",
      });
    }
  }, [article, isOpen]);

  function handleInputChange(field, value) {
    setFormData((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!formData.title.trim() || !formData.authors.trim()) {
      setError("Título e autores são obrigatórios");
      return;
    }

    try {
      setLoading(true);
      setError("");

      await articleService.updateArticle(project.id, article.id, {
        title: formData.title,
        authors: formData.authors,
        year: formData.year,
        journal: formData.journal,
        abstract: formData.abstract,
        doi: formData.doi,
        keywords: formData.keywords,
        pages: formData.pages,
        volume: formData.volume,
        number: formData.number,
        issn: formData.issn,
        status: formData.status,
      });

      toast.success("Artigo atualizado com sucesso!");
      onSuccess();
      handleClose();
    } catch (requestError) {
      console.error("Erro ao atualizar artigo:", requestError);
      setError(`Erro ao atualizar artigo: ${requestError.message}`);
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setFormData({
      title: "",
      authors: "",
      year: "",
      journal: "",
      abstract: "",
      doi: "",
      keywords: "",
      pages: "",
      volume: "",
      number: "",
      issn: "",
      status: "pendente",
    });
    setError("");
    onClose();
  }

  return (
    <SlidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Editar Artigo"
      breadcrumb="Artigos"
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="gap-2">
            {loading ? (
              <>
                <LoaderIcon className="h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <SaveIcon className="h-4 w-4" />
                Salvar Alterações
              </>
            )}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6 p-6">
        <div className="space-y-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--syn-text-secondary)]">
            Informações do Artigo
          </h3>
        </div>

        <ArticleCommonFields
          currentYear={new Date().getFullYear()}
          fieldPrefix="edit-article"
          formData={formData}
          journalLabel="Revista/Conferência"
          onFieldChange={handleInputChange}
          placeholders={{
            title: "Título do artigo",
            authors: "Nome dos autores",
            year: "2023",
            journal: "Nome da revista ou conferência",
            doi: "10.1000/182",
            abstract: "Resumo do artigo...",
          }}
          requiredFields
        />

        <ArticlePublicationFields
          fieldPrefix="edit-article"
          formData={formData}
          onFieldChange={handleInputChange}
        />

        <ArticleStatusSelector
          onChange={(status) => handleInputChange("status", status)}
          options={["pendente", "analisado", "excluido"]}
          selectedStatus={formData.status}
        />

        {error ? (
          <div className="flex items-center gap-2 rounded-[var(--syn-radius-card)] border border-red-200 bg-[var(--syn-badge-high-bg)] p-3 text-[var(--syn-badge-high-text)] dark:border-red-800">
            <AlertTriangleIcon className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        ) : null}
      </form>
    </SlidePanel>
  );
}

export default EditArticleModal;

