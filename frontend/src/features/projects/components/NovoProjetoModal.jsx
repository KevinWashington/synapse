import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoaderIcon, PlusIcon } from "lucide-react";
import { SlidePanel } from "@/components/ui/slide-panel";
import { projectService } from "@/features/projects";
import { toast } from "@/lib/toast";

function NovoProjetoModal({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    objetivo: "",
    status: "ideia",
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
    setFormData({ title: "", objetivo: "", status: "ideia" });
    setErrors({});
    onClose();
  };

  return (
    <SlidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Novo Projeto"
      breadcrumb="Projetos"
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="gap-2">
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
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Informações do Projeto */}
        <div className="space-y-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--syn-text-secondary)]">
            Informações do Projeto
          </h3>
        </div>

        {/* Título */}
        <div className="space-y-2">
          <Label htmlFor="title">
            Título <span className="text-red-500">*</span>
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
            rows={4}
            maxLength={1000}
          />
          {errors.objetivo && <p className="text-sm text-red-500">{errors.objetivo}</p>}
          <p className="text-xs text-[var(--syn-text-secondary)]">
            {formData.objetivo.length}/1000 caracteres
          </p>
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
      </form>
    </SlidePanel>
  );
}

export default NovoProjetoModal;
