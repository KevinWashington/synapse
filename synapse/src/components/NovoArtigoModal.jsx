import { useState } from "react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  LoaderIcon,
  PlusIcon,
  UploadIcon,
  AlertCircleIcon,
  FileIcon,
} from "lucide-react";
import { articleService } from "../services/artigosService.js";

function NovoArtigoModal({ isOpen, onClose, onSuccess, projectId }) {
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

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];

    if (!file) {
      return;
    }

    if (file.type !== "application/pdf") {
      setErrors((prev) => ({
        ...prev,
        pdf: "O arquivo deve ser um PDF",
      }));
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrors((prev) => ({
        ...prev,
        pdf: "O arquivo não pode ser maior que 10MB",
      }));
      return;
    }

    setSelectedFile(file);

    if (errors.pdf) {
      setErrors((prev) => ({
        ...prev,
        pdf: "",
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = "Título é obrigatório";
    } else if (formData.title.length > 200) {
      newErrors.title = "Título não pode ter mais que 200 caracteres";
    }

    if (!formData.authors.trim()) {
      newErrors.authors = "Autores são obrigatórios";
    } else if (formData.authors.length > 300) {
      newErrors.authors = "Autores não podem ter mais que 300 caracteres";
    }

    if (!formData.year) {
      newErrors.year = "Ano é obrigatório";
    } else {
      const yearNum = parseInt(formData.year);
      if (isNaN(yearNum) || yearNum < 1900 || yearNum > currentYear + 1) {
        newErrors.year = `Ano deve estar entre 1900 e ${currentYear + 1}`;
      }
    }

    if (!formData.journal.trim()) {
      newErrors.journal = "Periódico/Conferência é obrigatório";
    } else if (formData.journal.length > 200) {
      newErrors.journal = "Periódico não pode ter mais que 200 caracteres";
    }

    if (formData.doi && formData.doi.length > 50) {
      newErrors.doi = "DOI não pode ter mais que 50 caracteres";
    }

    if (formData.abstract && formData.abstract.length > 3000) {
      newErrors.abstract = "Resumo não pode ter mais que 3000 caracteres";
    }

    if (!selectedFile) {
      newErrors.pdf = "Arquivo PDF é obrigatório";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      const formDataToSend = new FormData();
      formDataToSend.append("title", formData.title);
      formDataToSend.append("authors", formData.authors);
      formDataToSend.append("year", formData.year);
      formDataToSend.append("journal", formData.journal);

      if (formData.doi) {
        formDataToSend.append("doi", formData.doi);
      }

      if (formData.abstract) {
        formDataToSend.append("abstract", formData.abstract);
      }

      formDataToSend.append("status", formData.status);
      formDataToSend.append("pdf", selectedFile);
      formDataToSend.append("notas", formData.notas);

      const response = await articleService.createArticle(
        projectId,
        formDataToSend
      );

      if (onSuccess) {
        onSuccess(response.article);
      }
      handleClose();

      alert("Artigo adicionado com sucesso!");
    } catch (error) {
      console.error("Erro ao adicionar artigo:", error);

      if (error.status === 400 && error.data?.details) {
        const serverErrors = {};

        if (Array.isArray(error.data.details)) {
          error.data.details.forEach((detail) => {
            if (detail.toLowerCase().includes("título")) {
              serverErrors.title = detail;
            } else if (detail.toLowerCase().includes("autores")) {
              serverErrors.authors = detail;
            } else if (detail.toLowerCase().includes("ano")) {
              serverErrors.year = detail;
            } else if (detail.toLowerCase().includes("periódico")) {
              serverErrors.journal = detail;
            } else if (detail.toLowerCase().includes("doi")) {
              serverErrors.doi = detail;
            } else if (detail.toLowerCase().includes("resumo")) {
              serverErrors.abstract = detail;
            } else if (
              detail.toLowerCase().includes("pdf") ||
              detail.toLowerCase().includes("arquivo")
            ) {
              serverErrors.pdf = detail;
            }
          });
        }

        setErrors((prev) => ({ ...prev, ...serverErrors }));
      } else {
        alert("Erro ao adicionar artigo: " + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      title: "",
      authors: "",
      year: currentYear,
      journal: "",
      doi: "",
      abstract: "",
      status: "pendente",
    });
    setSelectedFile(null);
    setErrors({});
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar Novo Artigo</DialogTitle>
          <DialogDescription>
            Adicione um novo artigo ao seu projeto de revisão literária.
            Preencha as informações e faça upload do PDF.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Título */}
            <div className="grid gap-2">
              <Label htmlFor="title">
                Título <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange("title", e.target.value)}
                placeholder="Ex: Artificial Intelligence in Higher Education: A Systematic Review"
                className={errors.title ? "border-red-500" : ""}
                maxLength={200}
              />
              {errors.title && (
                <p className="text-sm text-red-500">{errors.title}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {formData.title.length}/200 caracteres
              </p>
            </div>

            {/* Autores */}
            <div className="grid gap-2">
              <Label htmlFor="authors">
                Autores <span className="text-red-500">*</span>
              </Label>
              <Input
                id="authors"
                value={formData.authors}
                onChange={(e) => handleInputChange("authors", e.target.value)}
                placeholder="Ex: Smith, J.; Johnson, A.; Brown, M."
                className={errors.authors ? "border-red-500" : ""}
                maxLength={300}
              />
              {errors.authors && (
                <p className="text-sm text-red-500">{errors.authors}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {formData.authors.length}/300 caracteres
              </p>
            </div>

            {/* Ano e Periódico */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Ano */}
              <div className="grid gap-2">
                <Label htmlFor="year">
                  Ano <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="year"
                  type="number"
                  min={1900}
                  max={currentYear + 1}
                  value={formData.year}
                  onChange={(e) => handleInputChange("year", e.target.value)}
                  className={errors.year ? "border-red-500" : ""}
                />
                {errors.year && (
                  <p className="text-sm text-red-500">{errors.year}</p>
                )}
              </div>

              {/* Periódico/Conferência */}
              <div className="grid gap-2">
                <Label htmlFor="journal">
                  Periódico/Conferência <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="journal"
                  value={formData.journal}
                  onChange={(e) => handleInputChange("journal", e.target.value)}
                  placeholder="Ex: Journal of Educational Technology"
                  className={errors.journal ? "border-red-500" : ""}
                  maxLength={200}
                />
                {errors.journal && (
                  <p className="text-sm text-red-500">{errors.journal}</p>
                )}
              </div>
            </div>

            {/* DOI */}
            <div className="grid gap-2">
              <Label htmlFor="doi">
                DOI{" "}
                <span className="text-muted-foreground text-xs">
                  (opcional)
                </span>
              </Label>
              <Input
                id="doi"
                value={formData.doi}
                onChange={(e) => handleInputChange("doi", e.target.value)}
                placeholder="Ex: 10.1234/journal.2023.001"
                className={errors.doi ? "border-red-500" : ""}
                maxLength={50}
              />
              {errors.doi && (
                <p className="text-sm text-red-500">{errors.doi}</p>
              )}
            </div>

            {/* Resumo */}
            <div className="grid gap-2">
              <Label htmlFor="abstract">
                Resumo{" "}
                <span className="text-muted-foreground text-xs">
                  (opcional)
                </span>
              </Label>
              <Textarea
                id="abstract"
                value={formData.abstract}
                onChange={(e) => handleInputChange("abstract", e.target.value)}
                placeholder="Insira o resumo do artigo..."
                className={errors.abstract ? "border-red-500" : ""}
                rows={4}
                maxLength={3000}
              />
              {errors.abstract && (
                <p className="text-sm text-red-500">{errors.abstract}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {formData.abstract.length}/3000 caracteres
              </p>
            </div>

            {/* Upload de PDF */}
            <div className="grid gap-2">
              <Label htmlFor="pdf">
                Arquivo PDF <span className="text-red-500">*</span>
              </Label>

              <div
                className={`border-2 border-dashed rounded-md p-6 text-center ${
                  errors.pdf
                    ? "border-red-300 bg-red-50"
                    : "border-muted-foreground/25 hover:bg-muted/25"
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
                    <FileIcon className="h-8 w-8 text-primary mb-2" />
                    <p className="text-sm font-medium">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
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
                  <label
                    htmlFor="pdf"
                    className="cursor-pointer flex flex-col items-center"
                  >
                    <UploadIcon className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm font-medium">
                      Clique para selecionar um PDF
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ou arraste e solte
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Máximo: 10MB
                    </p>
                  </label>
                )}
              </div>

              {errors.pdf && (
                <div className="flex items-center gap-1 text-red-500">
                  <AlertCircleIcon className="h-4 w-4" />
                  <p className="text-sm">{errors.pdf}</p>
                </div>
              )}
            </div>

            {/* Status */}
            <div className="grid gap-2">
              <Label htmlFor="status">Status Inicial</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleInputChange("status", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                      Pendente
                    </div>
                  </SelectItem>
                  <SelectItem value="analisado">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      Analisado
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <LoaderIcon className="w-4 h-4 mr-2 animate-spin" />
                  Adicionando...
                </>
              ) : (
                <>
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Adicionar Artigo
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default NovoArtigoModal;
