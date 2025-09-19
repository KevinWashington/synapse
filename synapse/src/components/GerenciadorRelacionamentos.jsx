import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import {
  PlusIcon,
  XIcon,
  LinkIcon,
  SearchIcon,
  LoaderIcon,
  AlertTriangleIcon,
} from "lucide-react";
import { Input } from "./ui/input";
import { articleService } from "../services/artigosService";
import RecomendacoesIA from "./RecomendacoesIA";

function GerenciadorRelacionamentos({
  projetoId,
  artigoId,
  onRelationshipsChange,
}) {
  const [relacionamentos, setRelacionamentos] = useState([]);
  const [artigosDisponiveis, setArtigosDisponiveis] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingAdd, setLoadingAdd] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (projetoId && artigoId) {
      fetchRelacionamentos();
    }
  }, [projetoId, artigoId]);

  const fetchRelacionamentos = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await articleService.getArticleRelationships(
        projetoId,
        artigoId
      );
      setRelacionamentos(data.relatedArticles || []);
    } catch (err) {
      console.error("Erro ao carregar relacionamentos:", err);
      setError("Erro ao carregar relacionamentos");
    } finally {
      setLoading(false);
    }
  };

  const fetchArtigosDisponiveis = async () => {
    try {
      const data = await articleService.getArticlesByProject(projetoId, {
        search: busca,
        limit: 50,
      });

      const relacionadosIds = relacionamentos.map((r) => r._id);
      const artigosFiltrados = data.articles.filter(
        (artigo) =>
          artigo._id !== artigoId && !relacionadosIds.includes(artigo._id)
      );

      setArtigosDisponiveis(artigosFiltrados);
    } catch (err) {
      console.error("Erro ao buscar artigos:", err);
    }
  };

  useEffect(() => {
    if (dialogOpen && projetoId) {
      fetchArtigosDisponiveis();
    }
  }, [dialogOpen, busca, relacionamentos]);

  const adicionarRelacionamento = async (relatedArticleId) => {
    try {
      setLoadingAdd(true);
      await articleService.addArticleRelationship(
        projetoId,
        artigoId,
        relatedArticleId
      );

      await fetchRelacionamentos();

      if (onRelationshipsChange) {
        onRelationshipsChange();
      }

      setDialogOpen(false);
      setBusca("");
    } catch (err) {
      console.error("Erro ao adicionar relacionamento:", err);
      alert("Erro ao adicionar relacionamento: " + err.message);
    } finally {
      setLoadingAdd(false);
    }
  };

  const removerRelacionamento = async (relatedArticleId) => {
    if (!confirm("Tem certeza que deseja remover este relacionamento?")) {
      return;
    }

    try {
      await articleService.removeArticleRelationship(
        projetoId,
        artigoId,
        relatedArticleId
      );

      await fetchRelacionamentos();

      if (onRelationshipsChange) {
        onRelationshipsChange();
      }
    } catch (err) {
      console.error("Erro ao remover relacionamento:", err);
      alert("Erro ao remover relacionamento: " + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoaderIcon className="h-6 w-6 animate-spin mr-2" />
        <span>Carregando relacionamentos...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12 text-red-500">
        <AlertTriangleIcon className="h-6 w-6 mr-2" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Componente de Recomendações IA */}
      <RecomendacoesIA
        projetoId={projetoId}
        artigoId={artigoId}
        onRelationshipsChange={onRelationshipsChange}
      />

      {/* Componente original de relacionamentos */}
      <Card className="p-4">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 px-0">
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            Artigos Relacionados
            {relacionamentos.length > 0 && (
              <Badge variant="secondary">{relacionamentos.length}</Badge>
            )}
          </CardTitle>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <PlusIcon className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>Adicionar Relacionamento</DialogTitle>
              <DialogDescription>
                Selecione um artigo para criar uma conexão com este artigo.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <SearchIcon className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar artigos..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="flex-1"
                />
              </div>

              <div className="max-h-96 overflow-y-auto space-y-2">
                {artigosDisponiveis.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Nenhum artigo disponível para relacionar</p>
                    {busca && (
                      <p className="text-sm">Tente uma busca diferente</p>
                    )}
                  </div>
                ) : (
                  artigosDisponiveis.map((artigo) => (
                    <div
                      key={artigo._id}
                      className="flex items-start justify-between p-3 border rounded-lg hover:bg-muted/50 gap-3"
                    >
                      <div className="flex-1 min-w-0 space-y-1">
                        <h4
                          className="font-medium line-clamp-2 text-sm leading-tight"
                          title={artigo.title}
                        >
                          {artigo.title}
                        </h4>
                        <p
                          className="text-xs text-muted-foreground line-clamp-1"
                          title={`${artigo.authors} • ${artigo.year}`}
                        >
                          {artigo.authors} • {artigo.year}
                        </p>
                        <Badge
                          variant={
                            artigo.status === "analisado"
                              ? "default"
                              : artigo.status === "pendente"
                              ? "secondary"
                              : "destructive"
                          }
                          className="text-xs"
                        >
                          {artigo.status}
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => adicionarRelacionamento(artigo._id)}
                        disabled={loadingAdd}
                        className="flex-shrink-0"
                      >
                        {loadingAdd ? (
                          <LoaderIcon className="h-4 w-4 animate-spin" />
                        ) : (
                          <PlusIcon className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent className="px-0">
        {relacionamentos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <LinkIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhum artigo relacionado</p>
            <p className="text-sm">
              Adicione relacionamentos para conectar artigos similares
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {relacionamentos.map((artigo) => (
              <div
                key={artigo._id}
                className="flex items-start justify-between p-3 border rounded-lg hover:bg-muted/50 gap-3"
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <h4
                    className="font-medium line-clamp-2 text-sm leading-tight"
                    title={artigo.title}
                  >
                    {artigo.title}
                  </h4>
                  <p
                    className="text-xs text-muted-foreground line-clamp-1"
                    title={`${artigo.authors} • ${artigo.year}`}
                  >
                    {artigo.authors} • {artigo.year}
                  </p>
                  <Badge
                    variant={
                      artigo.status === "analisado"
                        ? "default"
                        : artigo.status === "pendente"
                        ? "secondary"
                        : "destructive"
                    }
                    className="text-xs"
                  >
                    {artigo.status}
                  </Badge>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removerRelacionamento(artigo._id)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                >
                  <XIcon className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
    </div>
  );
}

export default GerenciadorRelacionamentos;
