import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Save, Loader2, Sparkles } from "lucide-react";
import { projectService } from "../services/projetosService.js";

function PlanejamentoProjeto({ projeto = {} }) {
  const [loading, setLoading] = useState(false);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [generatingStrings, setGeneratingStrings] = useState(false);
  const [data, setData] = useState({
    title: "",
    objetivo: "",
    picoc: {
      pessoa: "",
      intervencao: "",
      comparacao: "",
      outcome: "",
      contexto: "",
    },
    researchQuestions: [],
    keywords: [],
    searchStrings: [],
    criteriosInclusao: [],
    criteriosExclusao: [],
  });

  useEffect(() => {
    if (projeto) {
      setData((prev) => ({ ...prev, ...projeto }));
    }
  }, [projeto]);

  const updateField = (field, value) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const updatePICOC = (field, value) => {
    setData((prev) => ({
      ...prev,
      picoc: { ...prev.picoc, [field]: value },
    }));
  };

  const addToArray = (field, value) => {
    if (!value.trim()) return;
    setData((prev) => ({
      ...prev,
      [field]: [...prev[field], value.trim()],
    }));
  };

  const removeFromArray = (field, index) => {
    setData((prev) => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    if (!data.title.trim()) {
      alert("Título é obrigatório");
      return;
    }

    try {
      setLoading(true);
      await projectService.updateProject(projeto._id, data);
      alert("Projeto salvo com sucesso!");
    } catch (error) {
      alert("Erro ao salvar: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const generateResearchQuestions = async () => {
    if (!data.picoc.pessoa || !data.picoc.intervencao || !data.picoc.outcome) {
      alert(
        "Preencha pelo menos População, Intervenção e Resultado no PICOC antes de gerar perguntas"
      );
      return;
    }

    try {
      setGeneratingQuestions(true);
      const response = await projectService.generateResearchQuestions(
        data.picoc,
        {
          title: data.title,
          objetivo: data.objetivo,
        }
      );

      // Adicionar as perguntas geradas ao array existente
      setData((prev) => ({
        ...prev,
        researchQuestions: [
          ...prev.researchQuestions,
          ...response.researchQuestions,
        ],
      }));
    } catch (error) {
      alert("Erro ao gerar perguntas: " + error.message);
    } finally {
      setGeneratingQuestions(false);
    }
  };

  const generateSearchStrings = async () => {
    if (!data.researchQuestions || data.researchQuestions.length === 0) {
      alert(
        "Adicione pelo menos uma pergunta de pesquisa antes de gerar strings de busca"
      );
      return;
    }

    if (!data.picoc.pessoa || !data.picoc.intervencao || !data.picoc.outcome) {
      alert(
        "Preencha pelo menos População, Intervenção e Resultado no PICOC antes de gerar strings"
      );
      return;
    }

    try {
      setGeneratingStrings(true);
      const response = await projectService.generateSearchStrings(
        data.researchQuestions,
        data.picoc,
        {
          title: data.title,
          objetivo: data.objetivo,
        }
      );

      // Adicionar as strings geradas ao array existente
      setData((prev) => ({
        ...prev,
        searchStrings: [...prev.searchStrings, ...response.searchStrings],
      }));
    } catch (error) {
      alert("Erro ao gerar strings de busca: " + error.message);
    } finally {
      setGeneratingStrings(false);
    }
  };

  // Componente para campos de array
  const ArrayField = ({ label, field, placeholder }) => {
    const [input, setInput] = useState("");

    const handleAdd = () => {
      addToArray(field, input);
      setInput("");
    };

    const handleKeyDown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAdd();
      }
    };

    return (
      <div className="space-y-3">
        <Label>{label}</Label>

        {/* Lista de items */}
        {data[field].length > 0 && (
          <div className="space-y-2">
            {data[field].map((item, index) => (
              <div key={index} className="flex items-center gap-1">
                <Badge
                  variant="secondary"
                  className="flex-1 justify-start text-left p-1 px-4"
                >
                  {item}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFromArray(field, index)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Input para adicionar */}
        <div className="flex gap-2">
          <Input
            placeholder={placeholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <Button
            variant="outline"
            onClick={handleAdd}
            disabled={!input.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Informações Básicas */}
      <Card>
        <CardHeader>
          <CardTitle>Informações Básicas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={data.title}
              onChange={(e) => updateField("title", e.target.value)}
              placeholder="Ex: Revisão Sistemática - IA na Educação"
            />
          </div>

          <div>
            <Label htmlFor="objetivo">Objetivo</Label>
            <Textarea
              id="objetivo"
              value={data.objetivo}
              onChange={(e) => updateField("objetivo", e.target.value)}
              placeholder="Descreva o objetivo do seu projeto..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* PICOC */}
      <Card>
        <CardHeader>
          <CardTitle>Framework PICOC</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            {
              key: "pessoa",
              label: "Pessoa/População",
              placeholder: "Descreva a população...",
            },
            {
              key: "intervencao",
              label: "Intervenção",
              placeholder: "Descreva a intervenção...",
            },
            {
              key: "comparacao",
              label: "Comparação",
              placeholder: "Descreva a comparação...",
            },
            {
              key: "outcome",
              label: "Resultado",
              placeholder: "Descreva os resultados...",
            },
            {
              key: "contexto",
              label: "Contexto",
              placeholder: "Descreva o contexto...",
            },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <Label>{label}</Label>
              <Input
                value={data.picoc[key]}
                onChange={(e) => updatePICOC(key, e.target.value)}
                placeholder={placeholder}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Perguntas de Pesquisa */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Perguntas de Pesquisa
            <Button
              variant="outline"
              size="sm"
              onClick={generateResearchQuestions}
              disabled={generatingQuestions}
              className="ml-2"
            >
              {generatingQuestions ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Gerar com IA
                </>
              )}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ArrayField
            label="Perguntas"
            field="researchQuestions"
            placeholder="Digite uma pergunta de pesquisa..."
          />
        </CardContent>
      </Card>

      {/* Palavras-chave */}
      <Card>
        <CardHeader>
          <CardTitle>Palavras-chave</CardTitle>
        </CardHeader>
        <CardContent>
          <ArrayField
            label="Palavras-chave"
            field="keywords"
            placeholder="Digite uma palavra-chave..."
          />
        </CardContent>
      </Card>

      {/* Strings de Busca */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Strings de Busca
            <Button
              variant="outline"
              size="sm"
              onClick={generateSearchStrings}
              disabled={generatingStrings}
              className="ml-2"
            >
              {generatingStrings ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Gerar com IA
                </>
              )}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ArrayField
            label="Strings"
            field="searchStrings"
            placeholder="Digite uma string de busca..."
          />
        </CardContent>
      </Card>

      {/* Critérios */}
      <Card>
        <CardHeader>
          <CardTitle>Critérios de Inclusão e Exclusão</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <ArrayField
              label="Critérios de Inclusão"
              field="criteriosInclusao"
              placeholder="Digite um critério de inclusão..."
            />
            <ArrayField
              label="Critérios de Exclusão"
              field="criteriosExclusao"
              placeholder="Digite um critério de exclusão..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Botão Salvar */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Salvar
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default PlanejamentoProjeto;
