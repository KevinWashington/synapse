import { GoogleGenerativeAI } from "@google/generative-ai";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

class EmbeddingService {
  constructor() {
    this.geminiApiKey = process.env.API_KEY;
    this.ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
    this.embeddingCache = new Map();
    this.useFallbackOnly = process.env.USE_FALLBACK_ONLY === "true" || true;
  }

  async generateGeminiEmbedding(text) {
    try {
      if (!this.geminiApiKey) {
        throw new Error(
          "API key do Gemini não configurada. Verifique se a variável API_KEY está definida no arquivo .env"
        );
      }

      const genAI = new GoogleGenerativeAI(this.geminiApiKey);
      const model = genAI.getGenerativeModel({ model: "embedding-001" });

      const result = await model.embedContent(text);
      return result.embedding.values;
    } catch (error) {
      console.error("Erro ao gerar embedding com Gemini:", error);
      throw error;
    }
  }

  async generateOllamaEmbedding(text, model = "nomic-embed-text") {
    try {
      const response = await fetch(`${this.ollamaUrl}/api/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model,
          prompt: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro na API Ollama: ${response.statusText}`);
      }

      const data = await response.json();
      return data.embedding;
    } catch (error) {
      console.error("Erro ao gerar embedding com Ollama:", error);
      throw error;
    }
  }

  async generateArticleEmbedding(article, provider = "gemini") {
    try {
      // Se modo fallback estiver ativado, não tentar embeddings
      if (this.useFallbackOnly) {
        throw new Error("Modo fallback ativado - usando análise textual");
      }

      // Criar texto combinado para o embedding
      const combinedText = this.createArticleText(article);

      // Verificar cache primeiro
      const cacheKey = `${article._id}_${provider}`;
      if (this.embeddingCache.has(cacheKey)) {
        return this.embeddingCache.get(cacheKey);
      }

      let embedding;
      if (provider === "gemini") {
        embedding = await this.generateGeminiEmbedding(combinedText);
      } else {
        embedding = await this.generateOllamaEmbedding(combinedText);
      }

      // Armazenar no cache
      this.embeddingCache.set(cacheKey, embedding);

      return embedding;
    } catch (error) {
      console.error("Erro ao gerar embedding do artigo:", error);
      throw error;
    }
  }

  createArticleText(article) {
    const parts = [];

    if (article.title) parts.push(`Título: ${article.title}`);
    if (article.abstract) parts.push(`Resumo: ${article.abstract}`);
    if (article.keywords) parts.push(`Palavras-chave: ${article.keywords}`);
    if (article.authors) parts.push(`Autores: ${article.authors}`);
    if (article.journal) parts.push(`Periódico: ${article.journal}`);
    if (article.notas) parts.push(`Notas: ${article.notas}`);

    return parts.join("\n");
  }

  cosineSimilarity(embeddingA, embeddingB) {
    if (embeddingA.length !== embeddingB.length) {
      throw new Error("Embeddings devem ter a mesma dimensão");
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < embeddingA.length; i++) {
      dotProduct += embeddingA[i] * embeddingB[i];
      normA += embeddingA[i] * embeddingA[i];
      normB += embeddingB[i] * embeddingB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  async findSimilarArticles(
    targetArticle,
    candidateArticles,
    provider = "gemini",
    limit = 10
  ) {
    try {
      const targetEmbedding = await this.generateArticleEmbedding(
        targetArticle,
        provider
      );

      const similarities = [];

      for (const candidate of candidateArticles) {
        if (candidate._id.toString() === targetArticle._id.toString()) {
          continue; // Pular o próprio artigo
        }

        const candidateEmbedding = await this.generateArticleEmbedding(
          candidate,
          provider
        );
        const similarity = this.cosineSimilarity(
          targetEmbedding,
          candidateEmbedding
        );

        similarities.push({
          article: candidate,
          similarity: similarity,
          score: Math.round(similarity * 100) / 100,
        });
      }

      // Ordenar por similaridade (maior primeiro)
      similarities.sort((a, b) => b.similarity - a.similarity);

      return similarities.slice(0, limit);
    } catch (error) {
      console.error("Erro ao encontrar artigos similares:", error);
      throw error;
    }
  }

  clearCache() {
    this.embeddingCache.clear();
  }

  removeFromCache(articleId, provider = "gemini") {
    const cacheKey = `${articleId}_${provider}`;
    this.embeddingCache.delete(cacheKey);
  }
}

export default new EmbeddingService();
