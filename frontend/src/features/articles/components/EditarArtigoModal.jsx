import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoaderIcon, SaveIcon, AlertTriangleIcon } from "lucide-react";
import { SlidePanel } from "@/components/ui/slide-panel";
import { articleService } from "@/services/artigosService";
import { toast } from "@/lib/toast";

function EditarArtigoModal({ isOpen, onClose, onSuccess, projeto, artigo }) {
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
    if (artigo && isOpen) {
      setFormData({
        title: artigo.title || "",
        authors: artigo.authors || "",
        year: artigo.year || "",
        journal: artigo.journal || "",
        abstract: artigo.abstract || "",
        doi: artigo.doi || "",
        keywords: artigo.keywords || "",
        pages: artigo.pages || "",
        volume: artigo.volume || "",
        number: artigo.number || "",
        issn: artigo.issn || "",
        status: artigo.status || "pendente",
      });
    }
  }, [artigo, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.authors.trim()) {
      setError("Título e autores são obrigatórios");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const updateData = {
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
      };

      await articleService.updateArticle(projeto.id, artigo.id, updateData);

      toast.success("Artigo atualizado com sucesso!");
      onSuccess();
      handleClose();
    } catch (err) {
      console.error("Erro ao atualizar artigo:", err);
      setError("Erro ao atualizar artigo: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
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
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

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
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Section title */}
        <div className="space-y-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--syn-text-secondary)]">
            Informações do Artigo
          </h3>
        </div>

        {/* Título */}
        <div className="space-y-2">
          <Label htmlFor="title" className="text-[var(--syn-text-primary)]">Título <span className="text-red-500">*</span></Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => handleInputChange("title", e.target.value)}
            placeholder="Título do artigo"
          />
        </div>

        {/* Autores */}
        <div className="space-y-2">
          <Label htmlFor="authors" className="text-[var(--syn-text-primary)]">Autores <span className="text-red-500">*</span></Label>
          <Input
            id="authors"
            value={formData.authors}
            onChange={(e) => handleInputChange("authors", e.target.value)}
            placeholder="Nome dos autores"
          />
        </div>

        {/* Ano e Revista */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="year" className="text-[var(--syn-text-primary)]">Ano</Label>
            <Input
              id="year"
              type="number"
              value={formData.year}
              onChange={(e) => handleInputChange("year", e.target.value)}
              placeholder="2023"
              min="1900"
              max="2030"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="journal" className="text-[var(--syn-text-primary)]">Revista/Conferência</Label>
            <Input
              id="journal"
              value={formData.journal}
              onChange={(e) => handleInputChange("journal", e.target.value)}
              placeholder="Nome da revista ou conferência"
            />
          </div>
        </div>

        {/* DOI */}
        <div className="space-y-2">
          <Label htmlFor="doi" className="text-[var(--syn-text-primary)]">DOI</Label>
          <Input
            id="doi"
            value={formData.doi}
            onChange={(e) => handleInputChange("doi", e.target.value)}
            placeholder="10.1000/182"
          />
        </div>

        {/* Páginas, Volume e Número */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="pages" className="text-[var(--syn-text-primary)]">Páginas</Label>
            <Input
              id="pages"
              value={formData.pages}
              onChange={(e) => handleInputChange("pages", e.target.value)}
              placeholder="1-6"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="volume" className="text-[var(--syn-text-primary)]">Volume</Label>
            <Input
              id="volume"
              value={formData.volume}
              onChange={(e) => handleInputChange("volume", e.target.value)}
              placeholder="45"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="number" className="text-[var(--syn-text-primary)]">Número</Label>
            <Input
              id="number"
              value={formData.number}
              onChange={(e) => handleInputChange("number", e.target.value)}
              placeholder="2"
            />
          </div>
        </div>

        {/* ISSN e Palavras-chave */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="issn" className="text-[var(--syn-text-primary)]">ISSN</Label>
            <Input
              id="issn"
              value={formData.issn}
              onChange={(e) => handleInputChange("issn", e.target.value)}
              placeholder="2770-0682"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="keywords" className="text-[var(--syn-text-primary)]">Palavras-chave</Label>
            <Input
              id="keywords"
              value={formData.keywords}
              onChange={(e) => handleInputChange("keywords", e.target.value)}
              placeholder="palavra1, palavra2"
            />
          </div>
        </div>

        {/* Resumo */}
        <div className="space-y-2">
          <Label htmlFor="abstract" className="text-[var(--syn-text-primary)]">Resumo</Label>
          <Textarea
            id="abstract"
            value={formData.abstract}
            onChange={(e) => handleInputChange("abstract", e.target.value)}
            placeholder="Resumo do artigo..."
            rows={4}
          />
        </div>

        {/* Status */}
        <div className="space-y-2">
          <Label className="text-[var(--syn-text-primary)]">Status</Label>
          <div className="flex flex-wrap gap-2">
            {["pendente", "analisado", "excluido"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleInputChange("status", s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${formData.status === s
                    ? "bg-[var(--syn-sidebar-bg)] text-white border-transparent"
                    : "border-[var(--syn-border)] text-[var(--syn-text-secondary)] hover:bg-[var(--syn-bg-secondary)]"
                  }`}
              >
                <StatusBadge status={s} />
              </button>
            ))}
          </div>
        </div>

        {/* Erro */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-[var(--syn-badge-high-bg)] border border-red-200 dark:border-red-800 rounded-[var(--syn-radius-card)] text-[var(--syn-badge-high-text)]">
            <AlertTriangleIcon className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}
      </form>
    </SlidePanel>
  );
}

export default EditarArtigoModal;
