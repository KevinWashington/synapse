import { useState } from "react";
import { AlertCircleIcon, FileIcon, LoaderIcon, PlusIcon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { SlidePanel } from "@/components/ui/SlidePanel";
import ArticleCommonFields from "@features/articles/components/ArticleCommonFields";
import ArticleStatusSelector from "@features/articles/components/ArticleStatusSelector";
import { articleService } from "@features/articles/services/articleService";
import { toast } from "@/lib/toast";

function NewArticleModal({ isOpen, onClose, onSuccess, projectId }) {
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [errors, setErrors] = useState({});
  const currentYear = new Date().getFullYear();

  const [formData, setFormData] = useState({
    title: "",
    authors: "",
    year: currentYear,
    journal: "",
    doi: "",
    abstract: "",
    notas: "",
    status: "pendente",
  });

  function handleInputChange(field, value) {
    setFormData((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));

    if (errors[field]) {
      setErrors((currentErrors) => ({
        ...currentErrors,
        [field]: "",
      }));
    }
  }

  function handleFileChange(event) {
    const file = event.target.files[0];

    if (!file) {
      return;
    }

    if (file.type !== "application/pdf") {
      setErrors((currentErrors) => ({
        ...currentErrors,
        pdf: "O arquivo deve ser um PDF",
      }));
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrors((currentErrors) => ({
        ...currentErrors,
        pdf: "O arquivo não pode ser maior que 10MB",
      }));
      return;
    }

    setSelectedFile(file);

    if (errors.pdf) {
      setErrors((currentErrors) => ({
        ...currentErrors,
        pdf: "",
      }));
    }
  }

  function validateForm() {
    const nextErrors = {};

    if (!formData.title.trim()) {
      nextErrors.title = "Título é obrigatório";
    } else if (formData.title.length > 200) {
      nextErrors.title = "Título não pode ter mais que 200 caracteres";
    }

    if (!formData.authors.trim()) {
      nextErrors.authors = "Autores são obrigatórios";
    } else if (formData.authors.length > 300) {
      nextErrors.authors = "Autores não podem ter mais que 300 caracteres";
    }

    if (!formData.year) {
      nextErrors.year = "Ano é obrigatório";
    } else {
      const yearNumber = Number.parseInt(formData.year, 10);

      if (
        Number.isNaN(yearNumber) ||
        yearNumber < 1900 ||
        yearNumber > currentYear + 1
      ) {
        nextErrors.year = `Ano deve estar entre 1900 e ${currentYear + 1}`;
      }
    }

    if (!formData.journal.trim()) {
      nextErrors.journal = "Periódico/Conferência é obrigatório";
    } else if (formData.journal.length > 200) {
      nextErrors.journal = "Periódico não pode ter mais que 200 caracteres";
    }

    if (formData.doi && formData.doi.length > 50) {
      nextErrors.doi = "DOI não pode ter mais que 50 caracteres";
    }

    if (formData.abstract && formData.abstract.length > 3000) {
      nextErrors.abstract = "Resumo não pode ter mais que 3000 caracteres";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      const articleData = {
        title: formData.title,
        authors: formData.authors,
        year: Number.parseInt(formData.year, 10),
        journal: formData.journal,
      };

      if (formData.doi) {
        articleData.doi = formData.doi;
      }

      if (formData.abstract) {
        articleData.abstract = formData.abstract;
      }

      if (formData.notas) {
        articleData.notas = formData.notas;
      }

      const response = await articleService.createArticleJson(projectId, articleData);

      if (selectedFile && response?.id) {
        try {
          await articleService.uploadPdf(projectId, response.id, selectedFile);
        } catch (pdfError) {
          console.error("Erro ao enviar PDF:", pdfError);
          toast.error("Artigo criado, mas houve erro ao enviar o PDF.");
        }
      }

      if (onSuccess) {
        onSuccess(response);
      }

      handleClose();
      toast.success("Artigo adicionado com sucesso!");
    } catch (error) {
      console.error("Erro ao adicionar artigo:", error);

      if (error.status === 400 && error.data?.details) {
        const serverErrors = {};

        if (Array.isArray(error.data.details)) {
          error.data.details.forEach((detail) => {
            const normalizedDetail = detail.toLowerCase();

            if (normalizedDetail.includes("título")) {
              serverErrors.title = detail;
            } else if (normalizedDetail.includes("autores")) {
              serverErrors.authors = detail;
            } else if (normalizedDetail.includes("ano")) {
              serverErrors.year = detail;
            } else if (normalizedDetail.includes("periódico")) {
              serverErrors.journal = detail;
            } else if (normalizedDetail.includes("doi")) {
              serverErrors.doi = detail;
            } else if (normalizedDetail.includes("resumo")) {
              serverErrors.abstract = detail;
            } else if (
              normalizedDetail.includes("pdf") ||
              normalizedDetail.includes("arquivo")
            ) {
              serverErrors.pdf = detail;
            }
          });
        }

        setErrors((currentErrors) => ({
          ...currentErrors,
          ...serverErrors,
        }));
      } else {
        toast.error(`Erro ao adicionar artigo: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setFormData({
      title: "",
      authors: "",
      year: currentYear,
      journal: "",
      doi: "",
      abstract: "",
      notas: "",
      status: "pendente",
    });
    setSelectedFile(null);
    setErrors({});
    onClose();
  }

  return (
    <SlidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Novo Artigo"
      breadcrumb="Artigos"
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="gap-2">
            {loading ? (
              <>
                <LoaderIcon className="h-4 w-4 animate-spin" />
                Adicionando...
              </>
            ) : (
              <>
                <PlusIcon className="h-4 w-4" />
                Adicionar Artigo
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
          currentYear={currentYear}
          errors={errors}
          fieldPrefix="create-article"
          formData={formData}
          journalLabel="Periódico/Conferência"
          onFieldChange={handleInputChange}
          placeholders={{
            title: "Ex: Artificial Intelligence in Higher Education",
            authors: "Ex: Smith, J.; Johnson, A.; Brown, M.",
            year: "",
            journal: "Ex: Journal of Educational Technology",
            doi: "Ex: 10.1234/journal.2023.001",
            abstract: "Insira o resumo do artigo...",
          }}
          requiredFields
          showCounters
        />

        <div className="space-y-2">
          <Label htmlFor="pdf">
            Arquivo PDF{" "}
            <span className="text-xs text-[var(--syn-text-secondary)]">
              (opcional)
            </span>
          </Label>

          <div
            className={`rounded-[var(--syn-radius-card)] border-2 border-dashed p-6 text-center ${
              errors.pdf
                ? "border-red-300 bg-red-50 dark:bg-red-950"
                : "border-[var(--syn-border)] hover:bg-[var(--syn-bg-secondary)]"
            }`}
          >
            <input
              type="file"
              id="pdf"
              accept="application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />

            {selectedFile ? (
              <div className="flex flex-col items-center">
                <FileIcon className="mb-2 h-8 w-8 text-[var(--syn-badge-blue-text)]" />
                <p className="text-sm font-medium text-[var(--syn-text-primary)]">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-[var(--syn-text-secondary)]">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFile(null)}
                  className="mt-2"
                >
                  Remover
                </Button>
              </div>
            ) : (
              <label htmlFor="pdf" className="flex cursor-pointer flex-col items-center">
                <UploadIcon className="mb-2 h-8 w-8 text-[var(--syn-text-secondary)]" />
                <p className="text-sm font-medium text-[var(--syn-text-primary)]">
                  Clique para selecionar um PDF
                </p>
                <p className="mt-1 text-xs text-[var(--syn-text-secondary)]">
                  Máximo: 10MB
                </p>
              </label>
            )}
          </div>

          {errors.pdf ? (
            <div className="flex items-center gap-1 text-red-500">
              <AlertCircleIcon className="h-4 w-4" />
              <p className="text-sm">{errors.pdf}</p>
            </div>
          ) : null}
        </div>

        <ArticleStatusSelector
          label="Status Inicial"
          onChange={(status) => handleInputChange("status", status)}
          options={["pendente", "analisado"]}
          selectedStatus={formData.status}
        />
      </form>
    </SlidePanel>
  );
}

export default NewArticleModal;

