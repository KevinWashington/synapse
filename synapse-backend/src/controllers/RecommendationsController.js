import Article from "../models/Artigo.js";
import Project from "../models/Project.js";
import embeddingService from "../services/embeddingService.js";

// GET /api/projetos/:projectId/artigos/:id/recomendacoes - Obter recomendações de artigos
export const getArticleRecommendations = async (req, res) => {
  try {
    const { projectId, id } = req.params;
    const { provider = "gemini", limit = 10, minSimilarity = 0.1 } = req.query; // Reduzido de 0.3 para 0.1
    const userId = req.user._id;

    // Validar se o projeto existe e pertence ao usuário
    const project = await Project.findOne({ _id: projectId, owner: userId });
    if (!project) {
      return res.status(404).json({
        error: "Projeto não encontrado",
        message: "Projeto não existe ou você não tem permissão para acessá-lo",
      });
    }

    // Buscar o artigo alvo
    const targetArticle = await Article.findOne({
      _id: id,
      projectId,
      owner: userId,
    });

    if (!targetArticle) {
      return res.status(404).json({
        error: "Artigo não encontrado",
        message: "Artigo não existe ou você não tem permissão para acessá-lo",
      });
    }

    // Buscar todos os outros artigos do projeto (excluindo o alvo e os já relacionados)
    const candidateArticles = await Article.find({
      _id: { $ne: id },
      projectId,
      owner: userId,
      relatedArticles: { $ne: id }, // Excluir artigos já relacionados
    }).select("title authors year journal abstract keywords notas");

    if (candidateArticles.length === 0) {
      return res.json({
        targetArticle: {
          _id: targetArticle._id,
          title: targetArticle.title,
          authors: targetArticle.authors,
          year: targetArticle.year,
        },
        recommendations: [],
        message: "Nenhum artigo candidato encontrado para recomendação",
      });
    }

    // Gerar recomendações usando embeddings ou fallback
    let similarities = [];

    try {
      similarities = await embeddingService.findSimilarArticles(
        targetArticle,
        candidateArticles,
        provider,
        parseInt(limit)
      );
    } catch (embeddingError) {
      console.warn(
        "Erro ao gerar embeddings, usando fallback:",
        embeddingError.message
      );

      // Fallback: usar similaridade baseada em texto simples
      similarities = generateTextBasedSimilarity(
        targetArticle,
        candidateArticles,
        parseInt(limit)
      );
    }

    // Filtrar por similaridade mínima
    const filteredRecommendations = similarities.filter(
      (rec) => rec.similarity >= parseFloat(minSimilarity)
    );

    res.json({
      targetArticle: {
        _id: targetArticle._id,
        title: targetArticle.title,
        authors: targetArticle.authors,
        year: targetArticle.year,
      },
      recommendations: filteredRecommendations.map((rec) => ({
        _id: rec.article._id,
        title: rec.article.title,
        authors: rec.article.authors,
        year: rec.article.year,
        journal: rec.article.journal,
        abstract: rec.article.abstract,
        keywords: rec.article.keywords,
        similarity: rec.score,
        reason: generateRecommendationReason(rec.article, rec.similarity),
      })),
      metadata: {
        totalCandidates: candidateArticles.length,
        recommendationsFound: filteredRecommendations.length,
        provider: provider,
        minSimilarity: parseFloat(minSimilarity),
      },
    });
  } catch (error) {
    console.error("Erro ao gerar recomendações:", error);
    res.status(500).json({
      error: "Erro interno do servidor",
      message: "Erro ao gerar recomendações de artigos",
    });
  }
};

// POST /api/projetos/:projectId/artigos/:id/recomendacoes/auto-relacionar - Auto-relacionar artigos similares
export const autoRelateSimilarArticles = async (req, res) => {
  try {
    const { projectId, id } = req.params;
    const {
      provider = "gemini",
      similarityThreshold = 0.7,
      maxRelations = 5,
    } = req.body;
    const userId = req.user._id;

    // Validar se o projeto existe e pertence ao usuário
    const project = await Project.findOne({ _id: projectId, owner: userId });
    if (!project) {
      return res.status(404).json({
        error: "Projeto não encontrado",
        message: "Projeto não existe ou você não tem permissão para acessá-lo",
      });
    }

    // Buscar o artigo alvo
    const targetArticle = await Article.findOne({
      _id: id,
      projectId,
      owner: userId,
    });

    if (!targetArticle) {
      return res.status(404).json({
        error: "Artigo não encontrado",
        message: "Artigo não existe ou você não tem permissão para acessá-lo",
      });
    }

    // Buscar artigos candidatos
    const candidateArticles = await Article.find({
      _id: { $ne: id },
      projectId,
      owner: userId,
      relatedArticles: { $ne: id },
    }).select("title authors year journal abstract keywords notas");

    if (candidateArticles.length === 0) {
      return res.json({
        success: true,
        message: "Nenhum artigo candidato encontrado",
        relationsCreated: 0,
      });
    }

    // Gerar recomendações
    let similarities = [];

    try {
      similarities = await embeddingService.findSimilarArticles(
        targetArticle,
        candidateArticles,
        provider,
        parseInt(maxRelations)
      );
    } catch (embeddingError) {
      console.warn(
        "Erro ao gerar embeddings para auto-relacionamento, usando fallback:",
        embeddingError.message
      );

      // Fallback: usar similaridade baseada em texto simples
      similarities = generateTextBasedSimilarity(
        targetArticle,
        candidateArticles,
        parseInt(maxRelations)
      );
    }

    // Filtrar por threshold e criar relacionamentos
    const highSimilarityArticles = similarities.filter(
      (rec) => rec.similarity >= similarityThreshold
    );

    let relationsCreated = 0;
    const createdRelations = [];

    for (const rec of highSimilarityArticles) {
      try {
        // Adicionar relacionamento bidirecional
        if (!targetArticle.relatedArticles.includes(rec.article._id)) {
          targetArticle.relatedArticles.push(rec.article._id);
          await targetArticle.save();

          const relatedArticle = await Article.findById(rec.article._id);
          if (relatedArticle && !relatedArticle.relatedArticles.includes(id)) {
            relatedArticle.relatedArticles.push(id);
            await relatedArticle.save();
          }

          relationsCreated++;
          createdRelations.push({
            articleId: rec.article._id,
            title: rec.article.title,
            similarity: rec.score,
          });
        }
      } catch (error) {
        console.error(
          `Erro ao criar relacionamento com artigo ${rec.article._id}:`,
          error
        );
      }
    }

    res.json({
      success: true,
      message: `${relationsCreated} relacionamentos criados automaticamente`,
      relationsCreated,
      createdRelations,
      metadata: {
        similarityThreshold,
        maxRelations: parseInt(maxRelations),
        provider,
      },
    });
  } catch (error) {
    console.error("Erro ao auto-relacionar artigos:", error);
    res.status(500).json({
      error: "Erro interno do servidor",
      message: "Erro ao criar relacionamentos automáticos",
    });
  }
};

// GET /api/projetos/:projectId/recomendacoes/insights - Obter insights de relacionamentos
export const getProjectInsights = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user._id;

    // Validar se o projeto existe e pertence ao usuário
    const project = await Project.findOne({ _id: projectId, owner: userId });
    if (!project) {
      return res.status(404).json({
        error: "Projeto não encontrado",
        message: "Projeto não existe ou você não tem permissão para acessá-lo",
      });
    }

    // Buscar todos os artigos do projeto
    const articles = await Article.find({
      projectId,
      owner: userId,
    }).select(
      "title authors year journal abstract keywords notas relatedArticles"
    );

    if (articles.length < 2) {
      return res.json({
        insights: [],
        message: "É necessário pelo menos 2 artigos para gerar insights",
      });
    }

    // Gerar insights básicos
    const insights = await generateProjectInsights(articles);

    res.json({
      insights,
      metadata: {
        totalArticles: articles.length,
        totalRelations:
          articles.reduce(
            (sum, article) => sum + article.relatedArticles.length,
            0
          ) / 2,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Erro ao gerar insights:", error);
    res.status(500).json({
      error: "Erro interno do servidor",
      message: "Erro ao gerar insights do projeto",
    });
  }
};

// Função auxiliar para gerar razão da recomendação
function generateRecommendationReason(article, similarity) {
  const reasons = [];

  if (similarity >= 0.8) {
    reasons.push("Muito alta similaridade");
  } else if (similarity >= 0.6) {
    reasons.push("Alta similaridade");
  } else if (similarity >= 0.4) {
    reasons.push("Similaridade moderada");
  } else if (similarity >= 0.2) {
    reasons.push("Similaridade baixa");
  }

  if (article.keywords && article.keywords.trim()) {
    reasons.push("Palavras-chave relacionadas");
  }

  if (article.abstract && article.abstract.length > 100) {
    reasons.push("Conteúdo do resumo similar");
  }

  if (article.title && article.title.length > 20) {
    reasons.push("Título relacionado");
  }

  return reasons.join(", ") || "Similaridade baseada em conteúdo textual";
}

// Função auxiliar para gerar insights do projeto
async function generateProjectInsights(articles) {
  const insights = [];

  // Insight 1: Artigos mais conectados
  const mostConnected = articles
    .map((article) => ({
      title: article.title,
      connections: article.relatedArticles.length,
    }))
    .sort((a, b) => b.connections - a.connections)
    .slice(0, 3);

  if (mostConnected.length > 0) {
    insights.push({
      type: "most_connected",
      title: "Artigos Mais Conectados",
      description: "Artigos com maior número de relacionamentos",
      data: mostConnected,
    });
  }

  // Insight 2: Artigos isolados
  const isolated = articles
    .filter((article) => article.relatedArticles.length === 0)
    .map((article) => ({
      title: article.title,
      authors: article.authors,
      year: article.year,
    }));

  if (isolated.length > 0) {
    insights.push({
      type: "isolated_articles",
      title: "Artigos Isolados",
      description: "Artigos que ainda não possuem relacionamentos",
      data: isolated,
      recommendation:
        "Considere analisar estes artigos para identificar possíveis conexões",
    });
  }

  // Insight 3: Distribuição por ano
  const yearDistribution = articles.reduce((acc, article) => {
    acc[article.year] = (acc[article.year] || 0) + 1;
    return acc;
  }, {});

  insights.push({
    type: "year_distribution",
    title: "Distribuição por Ano",
    description: "Quantidade de artigos por ano de publicação",
    data: Object.entries(yearDistribution)
      .map(([year, count]) => ({ year: parseInt(year), count }))
      .sort((a, b) => b.year - a.year),
  });

  return insights;
}

// Função de fallback para similaridade baseada em texto
function generateTextBasedSimilarity(targetArticle, candidateArticles, limit) {
  const similarities = [];

  for (const candidate of candidateArticles) {
    let similarity = 0;
    let matches = 0;
    let totalChecks = 0;

    // Comparar título
    if (targetArticle.title && candidate.title) {
      totalChecks++;
      const titleSimilarity = calculateTextSimilarity(
        targetArticle.title.toLowerCase(),
        candidate.title.toLowerCase()
      );
      if (titleSimilarity > 0.1) {
        // Reduzido de 0.3 para 0.1
        similarity += titleSimilarity * 0.4; // Peso alto para título
        matches++;
      }
    }

    // Comparar palavras-chave
    if (targetArticle.keywords && candidate.keywords) {
      totalChecks++;
      const keywordsSimilarity = calculateTextSimilarity(
        targetArticle.keywords.toLowerCase(),
        candidate.keywords.toLowerCase()
      );
      if (keywordsSimilarity > 0.05) {
        // Reduzido de 0.2 para 0.05
        similarity += keywordsSimilarity * 0.3; // Peso médio para palavras-chave
        matches++;
      }
    }

    // Comparar resumo
    if (targetArticle.abstract && candidate.abstract) {
      totalChecks++;
      const abstractSimilarity = calculateTextSimilarity(
        targetArticle.abstract.toLowerCase(),
        candidate.abstract.toLowerCase()
      );
      if (abstractSimilarity > 0.02) {
        // Reduzido de 0.1 para 0.02
        similarity += abstractSimilarity * 0.2; // Peso baixo para resumo
        matches++;
      }
    }

    // Comparar autores
    if (targetArticle.authors && candidate.authors) {
      totalChecks++;
      const authorsSimilarity = calculateTextSimilarity(
        targetArticle.authors.toLowerCase(),
        candidate.authors.toLowerCase()
      );
      if (authorsSimilarity > 0.1) {
        // Reduzido de 0.3 para 0.1
        similarity += authorsSimilarity * 0.1; // Peso baixo para autores
        matches++;
      }
    }

    // Normalizar similaridade
    if (totalChecks > 0) {
      similarity = similarity / totalChecks;

      // Bonus por múltiplas correspondências
      if (matches > 1) {
        similarity += (matches - 1) * 0.1;
      }

      similarities.push({
        article: candidate,
        similarity: Math.min(similarity, 1), // Cap em 1
        score: Math.round(similarity * 100) / 100,
      });
    }
  }

  // Ordenar por similaridade e retornar top N
  similarities.sort((a, b) => b.similarity - a.similarity);
  return similarities.slice(0, limit);
}

// Função auxiliar para calcular similaridade de texto simples
function calculateTextSimilarity(text1, text2) {
  if (!text1 || !text2) return 0;

  const words1 = text1.split(/\s+/);
  const words2 = text2.split(/\s+/);

  const set1 = new Set(words1);
  const set2 = new Set(words2);

  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size; // Jaccard similarity
}
