import { useState } from "react";
import { LoaderIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { SlidePanel } from "@/components/ui/SlidePanel";
import ArticleCommonFields from "@features/articles/components/ArticleCommonFields";
import { articleService } from "@features/articles/services/articleService";
import { SOURCE_CATEGORY_OPTIONS, SOURCE_NAME_OPTIONS, STUDY_TYPE_OPTIONS } from "@features/articles/utils/selectionFlow";
import { toast } from "@/lib/toast";

function NewArticleModal({ isOpen, onClose, onSuccess, projectId }) {
  const currentYear = new Date().getFullYear();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({
    title: "",
    authors: "",
    year: currentYear,
    journal: "",
    doi: "",
    abstract: "",
    notas: "",
    sourceCategory: "database",
    sourceNamePreset: "Scopus",
    sourceNameCustom: "",
    studyType: "",
  });

  function handleInputChange(field, value) {
    setFormData((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  }

  function validateForm() {
    const nextErrors = {};
    if (!formData.title.trim()) nextErrors.title = "Titulo e obrigatorio";
    if (!formData.authors.trim()) nextErrors.authors = "Autores sao obrigatorios";
    if (!formData.journal.trim()) nextErrors.journal = "Veiculo e obrigatorio";
    const resolvedSourceName =
      formData.sourceNamePreset === "outra" ? formData.sourceNameCustom : formData.sourceNamePreset;
    if (!resolvedSourceName?.trim()) nextErrors.sourceName = "Origem e obrigatoria";
    if (!formData.sourceCategory) nextErrors.sourceCategory = "Categoria de origem e obrigatoria";
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
      const response = await articleService.createArticleJson(projectId, {
        title: formData.title,
        authors: formData.authors,
        year: Number.parseInt(formData.year, 10),
        journal: formData.journal,
        doi: formData.doi || null,
        abstract: formData.abstract || null,
        notas: formData.notas || null,
        sourceCategory: formData.sourceCategory,
        sourceName:
          formData.sourceNamePreset === "outra" ? formData.sourceNameCustom : formData.sourceNamePreset,
        studyType: formData.studyType || null,
        entryMethod: "manual",
      });
      onSuccess?.(response);
      toast.success("Registro adicionado com sucesso!");
      handleClose();
    } catch (error) {
      toast.error(`Erro ao adicionar registro: ${error.message}`);
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
        sourceCategory: "database",
        sourceNamePreset: "Scopus",
        sourceNameCustom: "",
        studyType: "",
      });
    setErrors({});
    onClose();
  }

  return (
    <SlidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Novo Registro"
        breadcrumb="Identificacao"
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
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
                <PlusIcon className="h-4 w-4" />
                Adicionar
              </>
            )}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Categoria da origem</Label>
            <Select value={formData.sourceCategory} onValueChange={(value) => handleInputChange("sourceCategory", value)}>
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
            {errors.sourceCategory ? <p className="text-sm text-red-500">{errors.sourceCategory}</p> : null}
          </div>

          <div className="space-y-2">
            <Label>Origem</Label>
            <Select value={formData.sourceNamePreset} onValueChange={(value) => handleInputChange("sourceNamePreset", value)}>
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
            {formData.sourceNamePreset === "outra" ? (
              <Input
                value={formData.sourceNameCustom}
                onChange={(event) => handleInputChange("sourceNameCustom", event.target.value)}
                placeholder="Descreva a origem"
              />
            ) : null}
            {errors.sourceName ? <p className="text-sm text-red-500">{errors.sourceName}</p> : null}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Tipo de estudo</Label>
          <Select value={formData.studyType || "unclassified"} onValueChange={(value) => handleInputChange("studyType", value === "unclassified" ? "" : value)}>
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

        <ArticleCommonFields
          currentYear={currentYear}
          errors={errors}
          fieldPrefix="create-article"
          formData={formData}
          journalLabel="Periodico/Conferencia"
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
          <Label htmlFor="new-article-notes">Notas iniciais</Label>
          <textarea
            id="new-article-notes"
            value={formData.notas}
            onChange={(event) => handleInputChange("notas", event.target.value)}
            rows={3}
            className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-1 focus-visible:outline-none"
            placeholder="Observacoes opcionais do registro..."
          />
        </div>
      </form>
    </SlidePanel>
  );
}

export default NewArticleModal;
