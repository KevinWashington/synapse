import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { LoaderIcon, SaveIcon, AlertTriangleIcon } from "lucide-react";
import { articleService } from "../services/artigosService.js";

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

      await articleService.updateArticle(projeto._id, artigo._id, updateData);

      alert("Artigo atualizado com sucesso!");
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
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Artigo</DialogTitle>
          <DialogDescription>
            Atualize as informações do artigo "{artigo?.title}".
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              placeholder="Título do artigo"
              required
            />
          </div>

          {/* Autores */}
          <div className="space-y-2">
            <Label htmlFor="authors">Autores *</Label>
            <Input
              id="authors"
              value={formData.authors}
              onChange={(e) => handleInputChange("authors", e.target.value)}
              placeholder="Nome dos autores"
              required
            />
          </div>

          {/* Ano e Revista */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="year">Ano</Label>
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
              <Label htmlFor="journal">Revista/Conferência</Label>
              <Input
                id="journal"
                value={formData.journal}
                onChange={(e) => handleInputChange("journal", e.target.value)}
                placeholder="Nome da revista ou conferência"
              />
            </div>
          </div>

          {/* DOI e Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="doi">DOI</Label>
              <Input
                id="doi"
                value={formData.doi}
                onChange={(e) => handleInputChange("doi", e.target.value)}
                placeholder="10.1000/182"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleInputChange("status", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="analisado">Analisado</SelectItem>
                  <SelectItem value="excluido">Excluído</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Páginas, Volume e Número */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pages">Páginas</Label>
              <Input
                id="pages"
                value={formData.pages}
                onChange={(e) => handleInputChange("pages", e.target.value)}
                placeholder="1-6"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="volume">Volume</Label>
              <Input
                id="volume"
                value={formData.volume}
                onChange={(e) => handleInputChange("volume", e.target.value)}
                placeholder="45"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="number">Número</Label>
              <Input
                id="number"
                value={formData.number}
                onChange={(e) => handleInputChange("number", e.target.value)}
                placeholder="2"
              />
            </div>
          </div>

          {/* ISSN */}
          <div className="space-y-2">
            <Label htmlFor="issn">ISSN</Label>
            <Input
              id="issn"
              value={formData.issn}
              onChange={(e) => handleInputChange("issn", e.target.value)}
              placeholder="2770-0682"
            />
          </div>

          {/* Palavras-chave */}
          <div className="space-y-2">
            <Label htmlFor="keywords">Palavras-chave</Label>
            <Input
              id="keywords"
              value={formData.keywords}
              onChange={(e) => handleInputChange("keywords", e.target.value)}
              placeholder="palavra1, palavra2, palavra3"
            />
          </div>

          {/* Resumo */}
          <div className="space-y-2">
            <Label htmlFor="abstract">Resumo</Label>
            <Textarea
              id="abstract"
              value={formData.abstract}
              onChange={(e) => handleInputChange("abstract", e.target.value)}
              placeholder="Resumo do artigo..."
              rows={4}
            />
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
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <LoaderIcon className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <SaveIcon className="h-4 w-4 mr-2" />
                  Salvar Alterações
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default EditarArtigoModal;
