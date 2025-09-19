import Project from "../models/Project.js";
import Artigo from "../models/Artigo.js";

// GET /api/projetos - Listar projetos do usuário logado
export const getAllProjects = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 10 } = req.query;
    const userId = req.user._id;

    const filters = { owner: userId };
    if (status) filters.status = status;
    if (search) {
      filters.$text = { $search: search };
    }

    const skip = (page - 1) * limit;

    const projects = await Project.find(filters)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Calcular progresso para cada projeto
    const projectsWithProgress = await Promise.all(
      projects.map(async (project) => {
        const totalArticles = await Artigo.countDocuments({
          projectId: project._id,
          owner: userId,
        });
        const reviewedArticles = await Artigo.countDocuments({
          projectId: project._id,
          status: "analisado",
          owner: userId,
        });

        const progress =
          totalArticles > 0 ? (reviewedArticles / totalArticles) * 100 : 0;

        return {
          ...project.toObject(),
          progress: Math.round(progress),
          totalArticles,
          reviewedArticles,
        };
      })
    );

    const totalProjects = await Project.countDocuments(filters);

    res.json({
      projects: projectsWithProgress,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalProjects / limit),
        totalProjects,
        hasNext: page * limit < totalProjects,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("Erro ao buscar projetos:", error);
    res.status(500).json({
      error: "Erro interno do servidor",
      message: "Erro ao buscar projetos",
    });
  }
};

// GET /api/projetos/:id - Buscar projeto específico
export const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const project = await Project.findOne({ _id: id, owner: userId });

    if (!project) {
      return res.status(404).json({
        error: "Projeto não encontrado",
        message: "Projeto não existe ou você não tem permissão para acessá-lo",
      });
    }

    // Buscar artigos do projeto
    const articles = await Artigo.find({
      projectId: id,
      owner: userId,
    }).sort({ createdAt: -1 });

    // Calcular estatísticas
    const totalArticles = articles.length;
    const reviewedArticles = articles.filter(
      (article) => article.status === "analisado"
    ).length;
    const pendingArticles = articles.filter(
      (article) => article.status === "pendente"
    ).length;

    const projectWithStats = {
      ...project.toObject(),
      articles,
      stats: {
        totalArticles,
        reviewedArticles,
        pendingArticles,
        progress:
          totalArticles > 0
            ? Math.round((reviewedArticles / totalArticles) * 100)
            : 0,
      },
    };

    res.json(projectWithStats);
  } catch (error) {
    console.error("Erro ao buscar projeto:", error);
    res.status(500).json({
      error: "Erro interno do servidor",
      message: "Erro ao buscar projeto",
    });
  }
};

// POST /api/projetos - Criar novo projeto
export const createProject = async (req, res) => {
  try {
    const {
      title,
      objetivo,
      status,
      picoc,
      researchQuestions,
      keywords,
      searchStrings,
      criteriosInclusao,
      criteriosExclusao,
      aiConfig, // Capturar aiConfig mas não usar no modelo
    } = req.body;
    const userId = req.user._id;

    const project = new Project({
      title,
      objetivo,
      status: status || "ideia",
      owner: userId,
      picoc: picoc || {},
      researchQuestions: researchQuestions || [],
      keywords: keywords || [],
      searchStrings: searchStrings || [],
      criteriosInclusao: criteriosInclusao || [],
      criteriosExclusao: criteriosExclusao || [],
    });

    await project.save();

    res.status(201).json({
      success: true,
      message: "Projeto criado com sucesso",
      project,
    });
  } catch (error) {
    console.error("Erro ao criar projeto:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        error: "Dados inválidos",
        message: messages.join(", "),
      });
    }

    res.status(500).json({
      error: "Erro interno do servidor",
      message: "Erro ao criar projeto",
    });
  }
};

// PUT /api/projetos/:id - Atualizar projeto
export const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      objetivo,
      status,
      picoc,
      researchQuestions,
      keywords,
      searchStrings,
      criteriosInclusao,
      criteriosExclusao,
      aiConfig, 
    } = req.body;
    const userId = req.user._id;

    const project = await Project.findOne({ _id: id, owner: userId });

    if (!project) {
      return res.status(404).json({
        error: "Projeto não encontrado",
        message: "Projeto não existe ou você não tem permissão para editá-lo",
      });
    }

    // Atualizar campos básicos
    if (title !== undefined) project.title = title;
    if (objetivo !== undefined) project.objetivo = objetivo;
    if (status !== undefined) project.status = status;

    // Atualizar campos PICOC
    if (picoc !== undefined) {
      if (picoc.pessoa !== undefined) project.picoc.pessoa = picoc.pessoa;
      if (picoc.intervencao !== undefined)
        project.picoc.intervencao = picoc.intervencao;
      if (picoc.comparacao !== undefined)
        project.picoc.comparacao = picoc.comparacao;
      if (picoc.outcome !== undefined) project.picoc.outcome = picoc.outcome;
      if (picoc.contexto !== undefined) project.picoc.contexto = picoc.contexto;
    }

    // Atualizar arrays
    if (researchQuestions !== undefined)
      project.researchQuestions = researchQuestions;
    if (keywords !== undefined) project.keywords = keywords;
    if (searchStrings !== undefined) project.searchStrings = searchStrings;
    if (criteriosInclusao !== undefined)
      project.criteriosInclusao = criteriosInclusao;
    if (criteriosExclusao !== undefined)
      project.criteriosExclusao = criteriosExclusao;

    await project.save();

    res.json({
      success: true,
      message: "Projeto atualizado com sucesso",
      project,
    });
  } catch (error) {
    console.error("Erro ao atualizar projeto:", error);
    console.error("Detalhes do erro:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        error: "Dados inválidos",
        message: messages.join(", "),
      });
    }

    res.status(500).json({
      error: "Erro interno do servidor",
      message: "Erro ao atualizar projeto",
    });
  }
};

// DELETE /api/projetos/:id - Deletar projeto
export const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const project = await Project.findOne({ _id: id, owner: userId });

    if (!project) {
      return res.status(404).json({
        error: "Projeto não encontrado",
        message: "Projeto não existe ou você não tem permissão para deletá-lo",
      });
    }

    // Deletar todos os artigos relacionados
    await Artigo.deleteMany({ projectId: id, owner: userId });

    // Deletar o projeto
    await Project.findByIdAndDelete(id);

    res.json({
      success: true,
      message:
        "Projeto e todos os artigos relacionados foram deletados com sucesso",
    });
  } catch (error) {
    console.error("Erro ao deletar projeto:", error);
    res.status(500).json({
      error: "Erro interno do servidor",
      message: "Erro ao deletar projeto",
    });
  }
};
