import express from "express";
import {
  getArticleRecommendations,
  autoRelateSimilarArticles,
  getProjectInsights,
} from "../controllers/RecommendationsController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

/**
 * @swagger
 * /api/projetos/{projectId}/artigos/{id}/recomendacoes:
 *   get:
 *     summary: Obter recomendações para um artigo
 *     tags: [Recomendações]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do projeto
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do artigo
 *     responses:
 *       200:
 *         description: Recomendações obtidas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 recommendations:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       article:
 *                         $ref: '#/components/schemas/Artigo'
 *                       similarity:
 *                         type: number
 *                         description: Score de similaridade (0-1)
 *                       reason:
 *                         type: string
 *                         description: Motivo da recomendação
 *       401:
 *         description: Token inválido ou expirado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Artigo não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/projetos/{projectId}/artigos/{id}/recomendacoes/auto-relacionar:
 *   post:
 *     summary: Relacionar automaticamente artigos similares
 *     tags: [Recomendações]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do projeto
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do artigo
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               threshold:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 1
 *                 default: 0.7
 *                 description: Limiar de similaridade para relacionamento automático
 *     responses:
 *       200:
 *         description: Relacionamentos automáticos criados com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Relacionamentos automáticos criados com sucesso
 *                 relationshipsCreated:
 *                   type: integer
 *                   description: Número de relacionamentos criados
 *       401:
 *         description: Token inválido ou expirado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Artigo não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/projetos/{projectId}/recomendacoes/insights:
 *   get:
 *     summary: Obter insights do projeto
 *     tags: [Recomendações]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do projeto
 *     responses:
 *       200:
 *         description: Insights obtidos com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 insights:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       type:
 *                         type: string
 *                         description: Tipo de insight
 *                       title:
 *                         type: string
 *                         description: Título do insight
 *                       description:
 *                         type: string
 *                         description: Descrição do insight
 *                       articles:
 *                         type: array
 *                         items:
 *                           $ref: '#/components/schemas/Artigo'
 *                 clusters:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       articles:
 *                         type: array
 *                         items:
 *                           $ref: '#/components/schemas/Artigo'
 *       401:
 *         description: Token inválido ou expirado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Projeto não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

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
