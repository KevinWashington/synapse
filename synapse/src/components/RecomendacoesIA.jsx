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
  BrainIcon,
  PlusIcon,
  LoaderIcon,
  AlertTriangleIcon,
  TrendingUpIcon,
} from "lucide-react";
import { recommendationsService } from "../services/recommendationsService";
import { articleService } from "../services/artigosService";
import { useAIConfig } from "../hooks/useAIConfig";

function RecomendacoesIA({ projetoId, artigoId, onRelationshipsChange }) {
  const [recomendacoes, setRecomendacoes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addingArticle, setAddingArticle] = useState(null); // Para controlar qual botão está sendo clicado
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState(null);
  const { getCurrentConfig } = useAIConfig();

  useEffect(() => {
    if (projetoId && artigoId) {
      fetchRecommendations();
    }
  }, [projetoId, artigoId]);

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      setError(null);

      const aiConfig = getCurrentConfig();

      const data = await recommendationsService.getArticleRecommendations(
        projetoId,
        artigoId,
        {
          provider: aiConfig.provider,
          limit: 10,
          minSimilarity: 0.1, // Reduzido de 0.3 para 0.1
        }
      );

      setRecomendacoes(data.recommendations || []);
    } catch (err) {
      console.error("Erro ao carregar recomendações:", err);
      setError("Erro ao carregar recomendações de IA");
    } finally {
      setLoading(false);
    }
  };

  const adicionarRelacionamento = async (relatedArticleId) => {
    if (!confirm("Deseja adicionar este artigo como relacionado?")) {
      return;
    }

    try {
      setAddingArticle(relatedArticleId);

      // Usar o serviço de artigos para adicionar relacionamento
      await articleService.addArticleRelationship(
        projetoId,
        artigoId,
        relatedArticleId
      );

      alert("Relacionamento adicionado com sucesso!");

      if (onRelationshipsChange) {
        onRelationshipsChange();
      }

      // Recarregar recomendações para atualizar a lista
      await fetchRecommendations();
    } catch (err) {
      console.error("Erro ao adicionar relacionamento:", err);
      alert("Erro ao adicionar relacionamento: " + err.message);
    } finally {
      setAddingArticle(null);
    }
  };

  const getSimilarityColor = (similarity) => {
    if (similarity >= 0.8) return "bg-green-500";
    if (similarity >= 0.6) return "bg-blue-500";
    if (similarity >= 0.4) return "bg-yellow-500";
    return "bg-gray-500";
  };

  const getSimilarityLabel = (similarity) => {
    if (similarity >= 0.8) return "Muito Alta";
    if (similarity >= 0.6) return "Alta";
    if (similarity >= 0.4) return "Moderada";
    return "Baixa";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoaderIcon className="h-6 w-6 animate-spin mr-2" />
        <span>Analisando artigos com IA...</span>
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
    <Card className="p-4">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 px-0">
        <CardTitle className="flex items-center gap-2">
          <BrainIcon className="h-5 w-5" />
          Recomendações de IA
          {recomendacoes.length > 0 && (
            <Badge variant="secondary">{recomendacoes.length}</Badge>
          )}
        </CardTitle>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <TrendingUpIcon className="h-4 w-4 mr-1" />
              Ver Recomendações
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>Recomendações de Artigos Similares</DialogTitle>
              <DialogDescription>
                Artigos recomendados com base em análise semântica usando IA
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="max-h-96 overflow-y-auto space-y-3">
                {recomendacoes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <BrainIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma recomendação encontrada</p>
                    <p className="text-sm">
                      Tente ajustar os parâmetros de similaridade
                    </p>
                  </div>
                ) : (
                  recomendacoes.map((rec) => (
                    <div
                      key={rec._id}
                      className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 gap-3"
                    >
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2">
                          <h4
                            className="font-medium line-clamp-2 text-sm leading-tight"
                            title={rec.title}
                          >
                            {rec.title}
                          </h4>
                          <Badge
                            variant="outline"
                            className={`text-xs ${getSimilarityColor(
                              rec.similarity
                            )} text-white`}
                          >
                            {Math.round(rec.similarity * 100)}%
                          </Badge>
                        </div>

                        <p
                          className="text-xs text-muted-foreground line-clamp-1"
                          title={`${rec.authors} • ${rec.year}`}
                        >
                          {rec.authors} • {rec.year}
                        </p>

                        {rec.journal && (
                          <p className="text-xs text-muted-foreground">
                            {rec.journal}
                          </p>
                        )}

                        <p className="text-xs text-blue-600">{rec.reason}</p>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {getSimilarityLabel(rec.similarity)}
                        </Badge>
                        <Button
                          size="sm"
                          onClick={() => adicionarRelacionamento(rec._id)}
                          disabled={addingArticle === rec._id}
                          className="text-xs"
                        >
                          {addingArticle === rec._id ? (
                            <LoaderIcon className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <PlusIcon className="h-3 w-3 mr-1" />
                          )}
                          Adicionar
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent className="px-0">
        {recomendacoes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <BrainIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhuma recomendação disponível</p>
            <p className="text-sm">
              A IA analisará os artigos para encontrar conexões semânticas
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground mb-3">
              {recomendacoes.length} artigos similares encontrados
            </div>

            {recomendacoes.slice(0, 3).map((rec) => (
              <div
                key={rec._id}
                className="flex items-start justify-between p-3 border rounded-lg hover:bg-muted/50 gap-3"
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <h4
                    className="font-medium line-clamp-2 text-sm leading-tight"
                    title={rec.title}
                  >
                    {rec.title}
                  </h4>
                  <p
                    className="text-xs text-muted-foreground line-clamp-1"
                    title={`${rec.authors} • ${rec.year}`}
                  >
                    {rec.authors} • {rec.year}
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-xs ${getSimilarityColor(
                        rec.similarity
                      )} text-white`}
                    >
                      {Math.round(rec.similarity * 100)}%
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {getSimilarityLabel(rec.similarity)}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {recomendacoes.length > 3 && (
              <div className="text-center">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDialogOpen(true)}
                >
                  Ver mais {recomendacoes.length - 3} recomendações
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default RecomendacoesIA;
