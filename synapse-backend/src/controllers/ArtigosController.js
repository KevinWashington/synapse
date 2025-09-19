import Article from "../models/Artigo.js";
import Project from "../models/Project.js";
import mongoose from "mongoose";

// GET /api/projetos/:projectId/artigos - Listar artigos de um projeto
export const getArticlesByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { status, search, page = 1, limit = 20 } = req.query;
    const userId = req.user._id;

    // Validar se o projeto existe e pertence ao usuário
    const project = await Project.findOne({ _id: projectId, owner: userId });

    if (!project) {
      return res.status(404).json({
        error: "Projeto não encontrado",
        message: "Projeto não existe ou você não tem permissão para acessá-lo",
      });
    }

    // Montar os filtros
    const filters = { projectId, owner: userId };
    if (status && status !== "todos") {
      filters.status = status;
    }
    if (search) {
      filters.$text = { $search: search };
    }

    const skip = (page - 1) * limit;

    // Buscar artigos do projeto (sem incluir o PDF para performance)
    const articles = await Article.find(filters, { pdfData: 0 })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalArticles = await Article.countDocuments(filters);

    res.json({
      articles,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalArticles / limit),
        totalArticles,
        hasNext: page * limit < totalArticles,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("Erro ao buscar artigos:", error);
    res.status(500).json({
      error: "Erro interno do servidor",
      message: "Erro ao buscar artigos",
    });
  }
};

// GET /api/projetos/:projectId/artigos/:id - Buscar artigo específico
export const getArticleById = async (req, res) => {
  try {
    const { projectId, id } = req.params;
    const userId = req.user._id;

    // Validar se o projeto existe e pertence ao usuário
    const project = await Project.findOne({ _id: projectId, owner: userId });
    if (!project) {
      return res.status(404).json({
        error: "Projeto não encontrado",
        message: "Projeto não existe ou você não tem permissão para acessá-lo",
      });
    }

    const article = await Article.findOne({
      _id: id,
      projectId,
      owner: userId,
    });

    if (!article) {
      return res.status(404).json({
        error: "Artigo não encontrado",
        message: "Artigo não existe ou você não tem permissão para acessá-lo",
      });
    }

    res.json(article);
  } catch (error) {
    console.error("Erro ao buscar artigo:", error);
    res.status(500).json({
      error: "Erro interno do servidor",
      message: "Erro ao buscar artigo",
    });
  }
};

// GET /api/projetos/:projectId/artigos/:id/pdf - Baixar PDF do artigo
export const getArticlePdf = async (req, res) => {
  try {
    const { projectId, id } = req.params;

    // Validar se o projeto existe
    const project = await Project.findOne({ _id: projectId });
    if (!project) {
      return res.status(404).json({
        error: "Projeto não encontrado",
        message: "Projeto não existe",
      });
    }

    const article = await Article.findOne({
      _id: id,
      projectId,
    });

    if (!article) {
      return res.status(404).json({
        error: "Artigo não encontrado",
        message: "Artigo não existe",
      });
    }

    res.setHeader("Content-Type", article.pdfContentType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${article.pdfFile}"`
    );
    res.send(article.pdfData);
  } catch (error) {
    console.error("Erro ao baixar PDF:", error);
    res.status(500).json({
      error: "Erro interno do servidor",
      message: "Erro ao baixar PDF",
    });
  }
};

// GET /api/projetos/:projectId/artigos/:id/download - Download PDF do artigo
export const getArticlePdfDownload = async (req, res) => {
  try {
    const { projectId, id } = req.params;

    // Validar se o projeto existe
    const project = await Project.findOne({ _id: projectId });
    if (!project) {
      return res.status(404).json({
        error: "Projeto não encontrado",
        message: "Projeto não existe",
      });
    }

    const article = await Article.findOne({
      _id: id,
      projectId,
    });

    if (!article) {
      return res.status(404).json({
        error: "Artigo não encontrado",
        message: "Artigo não existe",
      });
    }

    res.setHeader("Content-Type", article.pdfContentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${article.pdfFile}"`
    );
    res.send(article.pdfData);
  } catch (error) {
    console.error("Erro ao baixar PDF:", error);
    res.status(500).json({
      error: "Erro interno do servidor",
      message: "Erro ao baixar PDF",
    });
  }
};

// POST /api/projetos/:projectId/artigos - Criar novo artigo
export const createArticle = async (req, res) => {
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

    const {
      title,
      authors,
      year,
      journal,
      doi,
      abstract,
      notas,
      keywords,
      pages,
      volume,
      number,
      issn,
    } = req.body;

    // PDF é opcional agora - buscar arquivo PDF nos files
    const pdfFile =
      req.files && req.files.find((file) => file.fieldname === "pdf");

    const article = new Article({
      title,
      authors,
      year,
      journal,
      doi,
      abstract,
      notas: notas || "",
      keywords: keywords || "",
      pages: pages || "",
      volume: volume || "",
      number: number || "",
      issn: issn || "",
      pdfFile: pdfFile ? pdfFile.originalname : "",
      pdfData: pdfFile ? pdfFile.buffer : null,
      pdfContentType: pdfFile ? pdfFile.mimetype : "application/pdf",
      projectId,
      owner: userId,
    });

    await article.save();

    res.status(201).json({
      success: true,
      message: "Artigo criado com sucesso",
      article: {
        _id: article._id,
        title: article.title,
        authors: article.authors,
        year: article.year,
        journal: article.journal,
        doi: article.doi,
        abstract: article.abstract,
        notas: article.notas,
        keywords: article.keywords,
        pages: article.pages,
        volume: article.volume,
        number: article.number,
        issn: article.issn,
        status: article.status,
        projectId: article.projectId,
        createdAt: article.createdAt,
        updatedAt: article.updatedAt,
      },
    });
  } catch (error) {
    console.error("Erro ao criar artigo:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        error: "Dados inválidos",
        message: messages.join(", "),
      });
    }

    res.status(500).json({
      error: "Erro interno do servidor",
      message: "Erro ao criar artigo",
    });
  }
};

// PUT /api/projetos/:projectId/artigos/:id - Atualizar artigo
export const updateArticle = async (req, res) => {
  try {
    const { projectId, id } = req.params;
    const userId = req.user._id;

    // Validar se o projeto existe e pertence ao usuário
    const project = await Project.findOne({ _id: projectId, owner: userId });
    if (!project) {
      return res.status(404).json({
        error: "Projeto não encontrado",
        message: "Projeto não existe ou você não tem permissão para acessá-lo",
      });
    }

    const article = await Article.findOne({
      _id: id,
      projectId,
      owner: userId,
    });

    if (!article) {
      return res.status(404).json({
        error: "Artigo não encontrado",
        message: "Artigo não existe ou você não tem permissão para editá-lo",
      });
    }

    // Se for FormData (upload de arquivo), processar campos do FormData
    if (req.file) {
      // Atualizar PDF se um arquivo foi enviado
      article.pdfFile = req.file.originalname;
      article.pdfData = req.file.buffer;
      article.pdfContentType = req.file.mimetype;
    }

    // Processar campos do body (pode ser JSON ou FormData)
    const {
      title,
      authors,
      year,
      journal,
      doi,
      abstract,
      notas,
      keywords,
      pages,
      volume,
      number,
      issn,
      status,
    } = req.body;

    // Atualizar campos se fornecidos
    if (title !== undefined) article.title = title;
    if (authors !== undefined) article.authors = authors;
    if (year !== undefined) article.year = year;
    if (journal !== undefined) article.journal = journal;
    if (doi !== undefined) article.doi = doi;
    if (abstract !== undefined) article.abstract = abstract;
    if (notas !== undefined) article.notas = notas;
    if (keywords !== undefined) article.keywords = keywords;
    if (pages !== undefined) article.pages = pages;
    if (volume !== undefined) article.volume = volume;
    if (number !== undefined) article.number = number;
    if (issn !== undefined) article.issn = issn;
    if (status !== undefined) article.status = status;

    await article.save();

    res.json({
      success: true,
      message: "Artigo atualizado com sucesso",
      article: {
        _id: article._id,
        title: article.title,
        authors: article.authors,
        year: article.year,
        journal: article.journal,
        doi: article.doi,
        abstract: article.abstract,
        notas: article.notas,
        keywords: article.keywords,
        pages: article.pages,
        volume: article.volume,
        number: article.number,
        issn: article.issn,
        status: article.status,
        projectId: article.projectId,
        createdAt: article.createdAt,
        updatedAt: article.updatedAt,
      },
    });
  } catch (error) {
    console.error("Erro ao atualizar artigo:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        error: "Dados inválidos",
        message: messages.join(", "),
      });
    }

    res.status(500).json({
      error: "Erro interno do servidor",
      message: "Erro ao atualizar artigo",
    });
  }
};

// PATCH /api/projetos/:projectId/artigos/:id/status - Atualizar status do artigo
export const updateArticleStatus = async (req, res) => {
  try {
    const { projectId, id } = req.params;
    const { status } = req.body;
    const userId = req.user._id;

    // Validar se o projeto existe e pertence ao usuário
    const project = await Project.findOne({ _id: projectId, owner: userId });
    if (!project) {
      return res.status(404).json({
        error: "Projeto não encontrado",
        message: "Projeto não existe ou você não tem permissão para acessá-lo",
      });
    }

    const article = await Article.findOne({
      _id: id,
      projectId,
      owner: userId,
    });

    if (!article) {
      return res.status(404).json({
        error: "Artigo não encontrado",
        message: "Artigo não existe ou você não tem permissão para editá-lo",
      });
    }

    article.status = status;
    await article.save();

    res.json({
      success: true,
      message: "Status do artigo atualizado com sucesso",
      article,
    });
  } catch (error) {
    console.error("Erro ao atualizar status do artigo:", error);
    res.status(500).json({
      error: "Erro interno do servidor",
      message: "Erro ao atualizar status do artigo",
    });
  }
};

// PATCH /api/projetos/:projectId/artigos/:id/notes - Atualizar notas do artigo
export const updateArticleNotes = async (req, res) => {
  try {
    const { projectId, id } = req.params;
    const { notas } = req.body;
    const userId = req.user._id;

    // Validar se o projeto existe e pertence ao usuário
    const project = await Project.findOne({ _id: projectId, owner: userId });
    if (!project) {
      return res.status(404).json({
        error: "Projeto não encontrado",
        message: "Projeto não existe ou você não tem permissão para acessá-lo",
      });
    }

    const article = await Article.findOne({
      _id: id,
      projectId,
      owner: userId,
    });

    if (!article) {
      return res.status(404).json({
        error: "Artigo não encontrado",
        message: "Artigo não existe ou você não tem permissão para editá-lo",
      });
    }

    article.notas = notas || "";
    await article.save();

    res.json({
      success: true,
      message: "Notas do artigo atualizadas com sucesso",
      article,
    });
  } catch (error) {
    console.error("Erro ao atualizar notas do artigo:", error);
    res.status(500).json({
      error: "Erro interno do servidor",
      message: "Erro ao atualizar notas do artigo",
    });
  }
};

// DELETE /api/projetos/:projectId/artigos/:id - Deletar artigo
export const deleteArticle = async (req, res) => {
  try {
    const { projectId, id } = req.params;
    const userId = req.user._id;

    // Validar se o projeto existe e pertence ao usuário
    const project = await Project.findOne({ _id: projectId, owner: userId });
    if (!project) {
      return res.status(404).json({
        error: "Projeto não encontrado",
        message: "Projeto não existe ou você não tem permissão para acessá-lo",
      });
    }

    const article = await Article.findOne({
      _id: id,
      projectId,
      owner: userId,
    });

    if (!article) {
      return res.status(404).json({
        error: "Artigo não encontrado",
        message: "Artigo não existe ou você não tem permissão para deletá-lo",
      });
    }

    await Article.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Artigo deletado com sucesso",
    });
  } catch (error) {
    console.error("Erro ao deletar artigo:", error);
    res.status(500).json({
      error: "Erro interno do servidor",
      message: "Erro ao deletar artigo",
    });
  }
};

// POST /api/projetos/:projectId/artigos/:id/relacionamentos - Adicionar relacionamento
export const addArticleRelationship = async (req, res) => {
  try {
    const { projectId, id } = req.params;
    const { relatedArticleId } = req.body;
    const userId = req.user._id;

    // Validar se o projeto existe e pertence ao usuário
    const project = await Project.findOne({ _id: projectId, owner: userId });
    if (!project) {
      return res.status(404).json({
        error: "Projeto não encontrado",
        message: "Projeto não existe ou você não tem permissão para acessá-lo",
      });
    }

    const article = await Article.findOne({
      _id: id,
      projectId,
      owner: userId,
    });

    if (!article) {
      return res.status(404).json({
        error: "Artigo não encontrado",
        message: "Artigo não existe ou você não tem permissão para editá-lo",
      });
    }

    // Verificar se o artigo relacionado existe e pertence ao usuário
    const relatedArticle = await Article.findOne({
      _id: relatedArticleId,
      owner: userId,
    });

    if (!relatedArticle) {
      return res.status(404).json({
        error: "Artigo relacionado não encontrado",
        message:
          "Artigo relacionado não existe ou você não tem permissão para acessá-lo",
      });
    }

    // Adicionar relacionamento se não existir
    if (!article.relatedArticles.includes(relatedArticleId)) {
      article.relatedArticles.push(relatedArticleId);
      await article.save();
    }

    res.json({
      success: true,
      message: "Relacionamento adicionado com sucesso",
      article,
    });
  } catch (error) {
    console.error("Erro ao adicionar relacionamento:", error);
    res.status(500).json({
      error: "Erro interno do servidor",
      message: "Erro ao adicionar relacionamento",
    });
  }
};

// DELETE /api/projetos/:projectId/artigos/:id/relacionamentos/:relatedId - Remover relacionamento
export const removeArticleRelationship = async (req, res) => {
  try {
    const { projectId, id, relatedId } = req.params;
    const userId = req.user._id;

    // Validar se o projeto existe e pertence ao usuário
    const project = await Project.findOne({ _id: projectId, owner: userId });
    if (!project) {
      return res.status(404).json({
        error: "Projeto não encontrado",
        message: "Projeto não existe ou você não tem permissão para acessá-lo",
      });
    }

    const article = await Article.findOne({
      _id: id,
      projectId,
      owner: userId,
    });

    if (!article) {
      return res.status(404).json({
        error: "Artigo não encontrado",
        message: "Artigo não existe ou você não tem permissão para editá-lo",
      });
    }

    // Remover relacionamento
    article.relatedArticles = article.relatedArticles.filter(
      (relatedArticleId) => relatedArticleId.toString() !== relatedId
    );
    await article.save();

    res.json({
      success: true,
      message: "Relacionamento removido com sucesso",
      article,
    });
  } catch (error) {
    console.error("Erro ao remover relacionamento:", error);
    res.status(500).json({
      error: "Erro interno do servidor",
      message: "Erro ao remover relacionamento",
    });
  }
};

// GET /api/projetos/:projectId/artigos/:id/relacionamentos - Listar relacionamentos
export const getArticleRelationships = async (req, res) => {
  try {
    const { projectId, id } = req.params;
    const userId = req.user._id;

    // Validar se o projeto existe e pertence ao usuário
    const project = await Project.findOne({ _id: projectId, owner: userId });
    if (!project) {
      return res.status(404).json({
        error: "Projeto não encontrado",
        message: "Projeto não existe ou você não tem permissão para acessá-lo",
      });
    }

    const article = await Article.findOne({
      _id: id,
      projectId,
      owner: userId,
    }).populate("relatedArticles", "title authors year journal");

    if (!article) {
      return res.status(404).json({
        error: "Artigo não encontrado",
        message: "Artigo não existe ou você não tem permissão para acessá-lo",
      });
    }

    res.json({
      article: {
        _id: article._id,
        title: article.title,
        authors: article.authors,
        year: article.year,
        journal: article.journal,
      },
      relatedArticles: article.relatedArticles,
    });
  } catch (error) {
    console.error("Erro ao buscar relacionamentos:", error);
    res.status(500).json({
      error: "Erro interno do servidor",
      message: "Erro ao buscar relacionamentos",
    });
  }
};

// GET /api/projetos/:id/grafo - Obter grafo de relacionamentos do projeto
export const getProjectGraph = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // Validar se o projeto existe e pertence ao usuário
    const project = await Project.findOne({ _id: id, owner: userId });
    if (!project) {
      return res.status(404).json({
        error: "Projeto não encontrado",
        message: "Projeto não existe ou você não tem permissão para acessá-lo",
      });
    }

    // Buscar todos os artigos do projeto
    const articles = await Article.find({
      projectId: id,
      owner: userId,
    }).select("title authors year journal status relatedArticles");

    // Construir o grafo
    const nodes = articles.map((article) => ({
      id: article._id.toString(),
      title: article.title,
      authors: article.authors,
      year: article.year,
      journal: article.journal,
      status: article.status,
    }));

    const edges = [];
    const articleIds = new Set(
      articles.map((article) => article._id.toString())
    );

    articles.forEach((article) => {
      article.relatedArticles.forEach((relatedId) => {
        const sourceId = article._id.toString();
        const targetId = relatedId.toString();

        // Só criar aresta se ambos os nós existirem
        if (articleIds.has(sourceId) && articleIds.has(targetId)) {
          edges.push({
            source: sourceId,
            target: targetId,
          });
        }
      });
    });

    res.json({
      nodes,
      edges,
    });
  } catch (error) {
    console.error("Erro ao gerar grafo:", error);
    res.status(500).json({
      error: "Erro interno do servidor",
      message: "Erro ao gerar grafo",
    });
  }
};
