import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { LoaderIcon, PlusIcon, CheckIcon } from "lucide-react";
import { toast } from "@/lib/toast";
import { FRAMEWORKS } from "@/lib/frameworkConfig";
import { projectService } from "@features/projects/services/projectService";

function NewProjectModal({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    objetivo: "",
    status: "ideia",
    framework: "PICOC",
  });
  const [errors, setErrors] = useState({});

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.title.trim()) {
      newErrors.title = "Título é obrigatório";
    } else if (formData.title.length > 100) {
      newErrors.title = "Título não pode ter mais que 100 caracteres";
    }
    if (!formData.objetivo.trim()) {
      newErrors.objetivo = "Objetivo é obrigatório";
    } else if (formData.objetivo.length > 1000) {
      newErrors.objetivo = "Objetivo não pode ter mais que 1000 caracteres";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setLoading(true);
      const response = await projectService.createProject(formData);
      if (onSuccess) onSuccess(response.project);
      handleClose();
      toast.success("Projeto criado com sucesso!");
    } catch (error) {
      console.error("Erro ao criar projeto:", error);
      if (error.status === 400 && error.data?.details) {
        const serverErrors = {};
        error.data.details.forEach((detail) => {
          if (detail.includes("Título")) serverErrors.title = detail;
          else if (detail.includes("Objetivo")) serverErrors.objetivo = detail;
        });
        setErrors(serverErrors);
      } else {
        toast.error("Erro ao criar projeto: " + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({ title: "", objetivo: "", status: "ideia", framework: "PICOC" });
    setErrors({});
    onClose();
  };

  const frameworkKeys = Object.keys(FRAMEWORKS);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlusIcon className="h-4 w-4 text-[#6259ff]" />
            Novo Projeto
          </DialogTitle>
          <DialogDescription>
            Configure as informacoes iniciais da sua revisao sistematica.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="title">
              Titulo <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              placeholder="Ex: Revisão Sistemática - IA na Educação"
              className={errors.title ? "border-red-500" : ""}
              maxLength={100}
            />
            {errors.title && <p className="text-sm text-red-500">{errors.title}</p>}
            <p className="text-xs text-[var(--syn-text-secondary)]">
              {formData.title.length}/100 caracteres
            </p>
          </div>

          {/* Objetivo */}
          <div className="space-y-2">
            <Label htmlFor="objetivo">
              Objetivo <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="objetivo"
              value={formData.objetivo}
              onChange={(e) => handleInputChange("objetivo", e.target.value)}
              placeholder="Descreva o objetivo e escopo do seu projeto de revisão sistemática..."
              className={errors.objetivo ? "border-red-500" : ""}
              rows={3}
              maxLength={1000}
            />
            {errors.objetivo && <p className="text-sm text-red-500">{errors.objetivo}</p>}
            <p className="text-xs text-[var(--syn-text-secondary)]">
              {formData.objetivo.length}/1000 caracteres
            </p>
          </div>

          {/* Framework Selector */}
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold uppercase tracking-wider">
                Framework de Pesquisa
              </Label>
              <p className="text-xs text-[var(--syn-text-secondary)]">
                Selecione o framework de formulacao da questao de pesquisa
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {frameworkKeys.map((fw) => {
                const info = FRAMEWORKS[fw];
                const isSelected = formData.framework === fw;
                return (
                  <button
                    key={fw}
                    type="button"
                    onClick={() => handleInputChange("framework", fw)}
                    className={`relative text-left p-3 rounded-lg border-2 transition-all ${isSelected
                        ? "border-[var(--syn-sidebar-accent)] bg-[var(--syn-sidebar-accent)]/5 shadow-sm"
                        : "border-[var(--syn-border)] hover:border-[var(--syn-text-secondary)]/40 bg-[var(--syn-bg-secondary)]"
                      }`}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[var(--syn-sidebar-accent)] flex items-center justify-center">
                        <CheckIcon className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <div className="font-semibold text-sm text-[var(--syn-text-primary)]">
                      {info.name}
                    </div>
                    <div className="text-[11px] text-[var(--syn-text-secondary)] mt-0.5 leading-snug">
                      {info.description}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {info.recommendedAreas.map((area) => (
                        <span
                          key={area}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--syn-bg-primary)] text-[var(--syn-text-secondary)] border border-[var(--syn-border)]"
                        >
                          {area}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status Inicial */}
          <div className="space-y-2">
            <Label htmlFor="status">Status Inicial</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => handleInputChange("status", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ideia">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-gray-500" />
                    Ideia
                  </div>
                </SelectItem>
                <SelectItem value="em-progresso">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    Em Progresso
                  </div>
                </SelectItem>
                <SelectItem value="concluido">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    Concluído
                  </div>
                </SelectItem>
                <SelectItem value="pausado">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-orange-500" />
                    Pausado
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="gap-2">
              {loading ? (
                <>
                  <LoaderIcon className="w-4 h-4 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <PlusIcon className="w-4 h-4" />
                  Criar Projeto
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default NewProjectModal;
