import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fetch from "node-fetch";
import swaggerUi from "swagger-ui-express";
import swaggerSpecs from "./src/config/swagger.js";

// Importar rotas
import projectRoutes from "./src/routes/projetos.js";
import authRoutes from "./src/routes/auth.js";
import recommendationsRoutes from "./src/routes/recommendations.js";
import { authenticateToken } from "./src/middleware/auth.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Função para obter o modelo de IA baseado na configuração
const getAIModel = (aiConfig) => {
  if (!aiConfig || !aiConfig.provider) {
    const genAI = new GoogleGenerativeAI(process.env.API_KEY);
    return genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  }

  if (aiConfig.provider === "gemini") {
    const apiKey = aiConfig.gemini?.apiKey || process.env.API_KEY;
    const model = aiConfig.gemini?.model || "gemini-2.0-flash";
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({ model });
  }

  return null;
};

const generateWithOllama = async (prompt, ollamaConfig) => {
  const url = ollamaConfig?.url || "http://localhost:11434";
  const model = ollamaConfig?.model || "phi3";

  try {
    const response = await fetch(`${url}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Ollama retornou status ${response.status}: ${response.statusText}`
      );
    }

    const data = await response.json();

    if (!data.response) {
      throw new Error("Ollama não retornou resposta válida");
    }
    return data.response;
  } catch (error) {
    throw new Error(`Falha na comunicação com Ollama: ${error.message}`);
  }
};

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware para lidar com erros do Multer
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        error: "Arquivo muito grande",
        details: "O tamanho máximo permitido é 10MB",
      });
    }
    return res.status(400).json({
      error: "Erro no upload de arquivo",
      details: err.message,
    });
  }

  if (err) {
    return res.status(500).json({
      error: "Erro interno no servidor",
      details: err.message,
    });
  }

  next();
});

// Swagger UI
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpecs, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "Synapse API Documentation",
  })
);

// Rotas
app.get("/", (req, res) => {
  res.json({
    message: "🚀 API Synapse funcionando!",
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: "/api/auth",
      projetos: "/api/projetos",
      health: "/health",
      docs: "/api-docs",
    },
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    database:
      mongoose.connection.readyState === 1 ? "Conectado" : "Desconectado",
  });
});

// Rotas de autenticação
app.use("/api/auth", authRoutes);

// Rotas
app.use("/api/projetos", projectRoutes);

// Rotas de recomendações
app.use("/api", recommendationsRoutes);

/**
 * @swagger
 * /api/stats:
 *   get:
 *     summary: Obter estatísticas do usuário
 *     tags: [Estatísticas]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estatísticas obtidas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StatsResponse'
 *       401:
 *         description: Token inválido ou expirado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/generate-research-questions:
 *   post:
 *     summary: Gerar perguntas de pesquisa baseadas no framework PICOC
 *     tags: [IA]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResearchQuestionsRequest'
 *     responses:
 *       200:
 *         description: Perguntas de pesquisa geradas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ResearchQuestionsResponse'
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Token inválido ou expirado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erro na geração de perguntas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/generate-search-strings:
 *   post:
 *     summary: Gerar strings de busca baseadas nas perguntas de pesquisa
 *     tags: [IA]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SearchStringsRequest'
 *     responses:
 *       200:
 *         description: Strings de busca geradas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SearchStringsResponse'
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Token inválido ou expirado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erro na geração de strings de busca
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/chat:
 *   post:
 *     summary: Chat com IA para análise de artigos
 *     tags: [IA]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChatRequest'
 *     responses:
 *       200:
 *         description: Resposta do chat obtida com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatResponse'
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Token inválido ou expirado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erro na comunicação com IA
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

// Rota de estatísticas
app.get("/api/stats", authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const Project = (await import("./src/models/Project.js")).default;
    const Artigo = (await import("./src/models/Artigo.js")).default;

    const totalProjects = await Project.countDocuments({ owner: userId });

    const totalArticles = await Artigo.countDocuments({ owner: userId });

    const totalArticlesReviewed = await Artigo.countDocuments({
      status: "analisado",
      owner: userId,
    });

    const textsToReview = await Artigo.countDocuments({
      status: "pendente",
      owner: userId,
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const textsReviewedToday = await Artigo.countDocuments({
      status: "analisado",
      owner: userId,
      updatedAt: { $gte: today },
    });

    const lastProject = await Project.findOne({ owner: userId }).sort({
      createdAt: -1,
    });

    // Buscar artigos pendentes com informações do projeto
    const pendingArticles = await Artigo.find({
      status: "pendente",
      owner: userId,
    })
      .populate("projectId", "title")
      .sort({ createdAt: -1 })
      .limit(10);

    // Calcular artigos revisados por dia nos últimos 5 dias
    const dailyReviews = [];
    for (let i = 4; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const reviewsCount = await Artigo.countDocuments({
        status: "analisado",
        owner: userId,
        updatedAt: {
          $gte: date,
          $lt: nextDate,
        },
      });

      dailyReviews.push({
        date: date.toISOString().split("T")[0], // YYYY-MM-DD format
        count: reviewsCount,
        dayName: date.toLocaleDateString("pt-BR", { weekday: "short" }),
      });
    }

    const progressPercentage =
      totalArticles > 0
        ? Math.round((totalArticlesReviewed / totalArticles) * 100)
        : 0;

    res.json({
      totalProjects,
      totalArticles,
      totalArticlesReviewed,
      textsReviewedToday,
      textsToReview,
      lastProject,
      progressPercentage,
      pendingArticles,
      dailyReviews,
    });
  } catch (error) {
    console.error("Erro ao buscar estatísticas:", error);
    res.status(500).json({
      error: "Erro ao buscar estatísticas",
      details: error.message,
    });
  }
});

// Rota para gerar research questions
app.post(
  "/api/generate-research-questions",
  authenticateToken,
  async (req, res) => {
    const { picocData, projeto, aiConfig } = req.body;

    try {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
      );

      const systemMessage = `Você é um especialista em metodologia de pesquisa acadêmica. 
Sua tarefa é gerar perguntas de pesquisa específicas e bem estruturadas baseadas nos dados do framework PICOC fornecidos.

Framework PICOC:
- População/Pessoa: ${picocData.pessoa || "Não especificado"}
- Intervenção: ${picocData.intervencao || "Não especificado"}
- Comparação: ${picocData.comparacao || "Não especificado"}
- Outcome (Resultado): ${picocData.outcome || "Não especificado"}
- Contexto: ${picocData.contexto || "Não especificado"}

Instruções:
1. Gere 3-5 perguntas de pesquisa específicas e mensuráveis
2. Cada pergunta deve ser clara e focada
3. Use linguagem acadêmica apropriada
4. As perguntas devem ser baseadas nos elementos do PICOC
5. Formate cada pergunta em uma linha separada, numerada (1., 2., etc.)
6. Foque em perguntas que podem ser respondidas através de revisão sistemática

Gere as perguntas agora:`;

      let text;
      if (aiConfig?.provider === "ollama") {
        text = await generateWithOllama(systemMessage, aiConfig.ollama);
      } else {
        const model = getAIModel(aiConfig);
        const result = await model.generateContent(systemMessage);
        const response = await result.response;
        text = response.text();
      }

      const questions = text
        .split("\n")
        .filter(
          (line) => line.trim() && (line.includes("?") || line.match(/^\d+\./))
        )
        .map((q) => q.replace(/^\d+\.\s*/, "").trim())
        .filter((q) => q.length > 10);

      res.json({ researchQuestions: questions });
    } catch (error) {
      if (!res.headersSent) {
        res.status(500).json({
          error: "Falha na geração de perguntas",
          details: error.message,
        });
      }
    }
  }
);

// Rota para gerar strings de busca
app.post(
  "/api/generate-search-strings",
  authenticateToken,
  async (req, res) => {
    const { researchQuestions, picocData, projeto, aiConfig } = req.body;

    try {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
      );

      const systemMessage = `Você é um especialista em estratégias de busca bibliográfica para revisões sistemáticas. 
Sua tarefa é gerar strings de busca eficazes baseadas nas perguntas de pesquisa e dados do PICOC fornecidos.

Perguntas de Pesquisa:
${researchQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Framework PICOC:
- População/Pessoa: ${picocData.pessoa || "Não especificado"}
- Intervenção: ${picocData.intervencao || "Não especificado"}
- Comparação: ${picocData.comparacao || "Não especificado"}
- Outcome (Resultado): ${picocData.outcome || "Não especificado"}
- Contexto: ${picocData.contexto || "Não especificado"}

Instruções:
1. Gere 3-5 strings de busca otimizadas para bases de dados acadêmicas (PubMed, Scopus, Web of Science, etc.)
2. Cada string deve usar operadores booleanos (AND, OR, NOT) adequadamente
3. Inclua sinônimos e variações de termos importantes
4. Use truncamento (*) quando apropriado para capturar variações
5. Considere termos em inglês e português quando relevante
6. Formate cada string em uma linha separada, numerada (1., 2., etc.)
7. Foque em termos que maximizem a recuperação de estudos relevantes

Gere as strings de busca agora:`;

      let text;
      if (aiConfig?.provider === "ollama") {
        text = await generateWithOllama(systemMessage, aiConfig.ollama);
      } else {
        const model = getAIModel(aiConfig);
        const result = await model.generateContent(systemMessage);
        const response = await result.response;
        text = response.text();
      }

      const searchStrings = text
        .split("\n")
        .filter((line) => line.trim() && line.match(/^\d+\./))
        .map((s) => s.replace(/^\d+\.\s*/, "").trim())
        .filter((s) => s.length > 10);

      res.json({ searchStrings });
    } catch (error) {
      console.error("Erro ao gerar strings de busca:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Falha na geração de strings de busca" });
      }
    }
  }
);

// Rota de chat
app.post("/api/chat", authenticateToken, async (req, res) => {
  const { messages, artigo, aiConfig } = req.body;

  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );

    let systemMessage =
      "PERSONA: Você é um Mecanismo de Extração Literal (Literal Extraction Engine). Sua única função é operar como uma API de software que localiza e extrai trechos exatos de um texto-fonte. Você não interpreta, não resume e não gera texto novo.";

    if (artigo) {
      systemMessage += `\n\nVocê está analisando o seguinte artigo acadêmico:\n\nTítulo: ${artigo.title}`;
      if (artigo.authors) systemMessage += `\nAutores: ${artigo.authors}`;
      if (artigo.year) systemMessage += `\nAno: ${artigo.year}`;
      if (artigo.journal) systemMessage += `\nPeriódico: ${artigo.journal}`;
      if (artigo.doi) systemMessage += `\nDOI: ${artigo.doi}`;
      if (artigo.abstract) systemMessage += `\n\nResumo:\n${artigo.abstract}`;
      if (artigo.content)
        systemMessage += `\n\nCONTEÚDO COMPLETO DO ARTIGO:\n${artigo.content}`;
      else if (!artigo.abstract)
        systemMessage += `\n\nOBS: Este artigo não possui resumo (abstract) ou conteúdo extraído disponível.`;
      if (artigo.notas)
        systemMessage += `\n\nNotas existentes do usuário:\n${artigo.notas}`;
      systemMessage += `\n\nDIRETIVA PRIMÁRIA: Sua operação é análoga a um Ctrl+F (Localizar) para encontrar a frase ou sentenças exatas no artigo-fonte que respondem à pergunta do usuário, seguido de um Ctrl+C (Copiar) e Ctrl+V (Colar) na saída. Você NÃO é um assistente e NÃO é um chatbot.

              PROTOCOLO DE OPERAÇÃO (SEGUIR ESTRITAMENTE):
              ANÁLISE DA CONSULTA: Analise a pergunta do usuário para identificar as palavras-chave e a intenção principal da busca.

              VARREDURA LITERAL: Execute uma busca exata no artigo-fonte por sentenças que contenham as palavras-chave e correspondam à intenção da consulta. A busca é por correspondência direta de informação, não por inferência.

              EXTRAÇÃO E RETORNO:

              Se uma ou mais sentenças forem uma correspondência direta e inequívoca, copie-as verbatim (palavra por palavra, sem nenhuma alteração) para a saída, respeitando as regras de formatação abaixo.

              Se múltiplos pontos distintos do texto respondem à pergunta (ex: uma lista de métodos), liste-os usando bullet points (- ). Cada bullet point DEVE ser uma citação direta e exata.

              TRATAMENTO DE FALHA (Handling Failures):

              Se nenhuma sentença ou trecho no artigo responde diretamente à consulta, sua ÚNICA saída permitida é a string: Informação não disponível no artigo.

              Se a pergunta do usuário for muito vaga ou ambígua para permitir uma busca literal (ex: "fale sobre o artigo"), sua ÚNICA saída permitida é a string: Consulta muito ampla para extração literal. Por favor, faça uma pergunta específica.

              REGRAS DE FORMATAÇÃO DA SAÍDA (INVIOLÁVEIS):
              NÃO PARAFRASEAR: A saída deve ser uma cópia exata do texto do artigo. Nenhuma palavra pode ser alterada, resumida ou reordenada.

              ZERO ADIÇÕES: NÃO inclua NENHUM texto que não tenha sido copiado do artigo. Isso inclui (mas não se limita a): "A resposta é...", "De acordo com o texto...", saudações, ou qualquer frase de conexão. A resposta começa na primeira palavra do trecho extraído.

              FORMATAÇÃO MÍNIMA:

              A única formatação permitida é o uso de bullet points (- ) para listar múltiplos itens extraídos.

              NÃO use cabeçalhos, títulos, aspas, itálico, sublinhado ou qualquer outra formatação.

              O uso de negrito é permitido para destacar o termo-chave da pergunta do usuário, se e somente se esse termo estiver na citação extraída.

              EXEMPLOS DE OPERAÇÃO:
              CONTEXTO: Artigo sobre técnicas de programação.

              USUÁRIO PERGUNTA: "Quais foram os métodos de teste utilizados?"

              SAÍDA CORRETA:

              - Testes de unidade com JUnit.
              - Testes de integração com mocks.
              - Análise de cobertura de código com JaCoCo.
              USUÁRIO PERGUNTA: "Qual a principal conclusão sobre a técnica XP?"

              SAÍDA CORRETA:

              A conclusão principal é que a **técnica XP** demonstrou um aumento de 15% na satisfação do cliente em projetos de escopo reduzido.
              USUÁRIO PERGUNTA: "O que o autor acha de Python?" (Supondo que o artigo não mencione a opinião do autor)

              SAÍDA CORRETA:

              Informação não disponível no artigo.`;
    }

    const lastMessage = messages[messages.length - 1];
    const userInput = lastMessage?.role === "user" ? lastMessage.content : "";

    const finalPrompt =
      systemMessage +
      "\n\nUsuário: " +
      userInput +
      "\n\n[LEMBRE-SE: Resposta em no máximo 2 parágrafos pequenos. Seja extremamente conciso.]";

    let text;
    if (aiConfig?.provider === "ollama") {
      text = await generateWithOllama(finalPrompt, aiConfig.ollama);
    } else {
      const model = getAIModel(aiConfig);
      const result = await model.generateContent(finalPrompt);
      const response = await result.response;
      text = response.text();
    }

    res.json({ content: text });
  } catch (error) {
    console.error("Erro no chat:", error);
    if (!res.headersSent) {
      res
        .status(500)
        .json({ error: "Falha na comunicação com o modelo de IA" });
    }
  }
});

// Middleware de erro para rotas não encontradas
app.use((req, res) => {
  res.status(404).json({
    error: "Rota não encontrada",
    message: `${req.method} ${req.originalUrl} não existe`,
  });
});

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/synapse";

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("✅ Conectado ao MongoDB");
  })
  .catch((err) => {
    console.error("❌ Erro ao conectar no MongoDB:", err.message);
  });

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
