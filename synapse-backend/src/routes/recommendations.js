import express from "express";
import {
  getArticleRecommendations,
  autoRelateSimilarArticles,
  getProjectInsights,
} from "../controllers/RecommendationsController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticateToken);

// GET /api/projetos/:projectId/artigos/:id/recomendacoes
router.get(
  "/projetos/:projectId/artigos/:id/recomendacoes",
  getArticleRecommendations
);

// POST /api/projetos/:projectId/artigos/:id/recomendacoes/auto-relacionar
router.post(
  "/projetos/:projectId/artigos/:id/recomendacoes/auto-relacionar",
  autoRelateSimilarArticles
);

// GET /api/projetos/:projectId/recomendacoes/insights
router.get("/projetos/:projectId/recomendacoes/insights", getProjectInsights);

export default router;
