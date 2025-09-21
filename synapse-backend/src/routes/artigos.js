import express from "express";
import multer from "multer";
import {
  getArticlesByProject,
  getArticleById,
  getArticlePdf,
  getArticlePdfDownload,
  createArticle,
  updateArticle,
  updateArticleStatus,
  updateArticleNotes,
  deleteArticle,
  addArticleRelationship,
  removeArticleRelationship,
  getArticleRelationships,
  getProjectGraph,
} from "../controllers/ArtigosController.js";
import { authenticateToken } from "../middleware/auth.js";

/**
 * @swagger
 * /api/projetos/{projectId}/artigos:
 *   get:
 *     summary: Listar artigos de um projeto
 *     tags: [Artigos]
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
 *         description: Lista de artigos obtida com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Artigo'
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

/**
 * @swagger
 * /api/projetos/{projectId}/artigos:
 *   post:
 *     summary: Criar novo artigo
 *     tags: [Artigos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do projeto
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 description: Título do artigo
 *               authors:
 *                 type: string
 *                 description: Autores do artigo
 *               year:
 *                 type: integer
 *                 description: Ano de publicação
 *               journal:
 *                 type: string
 *                 description: Periódico/Revista
 *               doi:
 *                 type: string
 *                 description: DOI do artigo
 *               abstract:
 *                 type: string
 *                 description: Resumo do artigo
 *               content:
 *                 type: string
 *                 description: Conteúdo completo do artigo
 *               pdf:
 *                 type: string
 *                 format: binary
 *                 description: Arquivo PDF do artigo (opcional)
 *     responses:
 *       201:
 *         description: Artigo criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Artigo'
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
 *       404:
 *         description: Projeto não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/projetos/{projectId}/artigos/{id}:
 *   get:
 *     summary: Obter artigo por ID
 *     tags: [Artigos]
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
 *         description: Artigo obtido com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Artigo'
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
 * /api/projetos/{projectId}/artigos/{id}:
 *   put:
 *     summary: Atualizar artigo
 *     tags: [Artigos]
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: Título do artigo
 *               authors:
 *                 type: string
 *                 description: Autores do artigo
 *               year:
 *                 type: integer
 *                 description: Ano de publicação
 *               journal:
 *                 type: string
 *                 description: Periódico/Revista
 *               doi:
 *                 type: string
 *                 description: DOI do artigo
 *               abstract:
 *                 type: string
 *                 description: Resumo do artigo
 *               content:
 *                 type: string
 *                 description: Conteúdo completo do artigo
 *               pdf:
 *                 type: string
 *                 format: binary
 *                 description: Arquivo PDF do artigo
 *     responses:
 *       200:
 *         description: Artigo atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Artigo'
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
 *       404:
 *         description: Artigo não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/projetos/{projectId}/artigos/{id}:
 *   delete:
 *     summary: Excluir artigo
 *     tags: [Artigos]
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
 *         description: Artigo excluído com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Artigo excluído com sucesso
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
 * /api/projetos/{projectId}/artigos/{id}/pdf:
 *   get:
 *     summary: Visualizar PDF do artigo (sem autenticação)
 *     tags: [Artigos]
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
 *         description: PDF do artigo
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Artigo não encontrado ou PDF não disponível
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/projetos/{projectId}/artigos/{id}/download:
 *   get:
 *     summary: Download do PDF do artigo (sem autenticação)
 *     tags: [Artigos]
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
 *         description: Download do PDF do artigo
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Artigo não encontrado ou PDF não disponível
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/projetos/{projectId}/artigos/{id}/status:
 *   patch:
 *     summary: Atualizar status do artigo
 *     tags: [Artigos]
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
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pendente, analisado, rejeitado]
 *                 description: Novo status do artigo
 *     responses:
 *       200:
 *         description: Status atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Artigo'
 *       400:
 *         description: Status inválido
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
 *       404:
 *         description: Artigo não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/projetos/{projectId}/artigos/{id}/notes:
 *   patch:
 *     summary: Atualizar notas do artigo
 *     tags: [Artigos]
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
 *             required:
 *               - notas
 *             properties:
 *               notas:
 *                 type: string
 *                 description: Notas do usuário sobre o artigo
 *     responses:
 *       200:
 *         description: Notas atualizadas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Artigo'
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
 *       404:
 *         description: Artigo não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/projetos/{projectId}/artigos/{id}/relacionamentos:
 *   get:
 *     summary: Obter relacionamentos do artigo
 *     tags: [Artigos]
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
 *         description: Relacionamentos obtidos com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   relatedArticle:
 *                     $ref: '#/components/schemas/Artigo'
 *                   relationshipType:
 *                     type: string
 *                   description:
 *                     type: string
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
 * /api/projetos/{projectId}/artigos/{id}/relacionamentos:
 *   post:
 *     summary: Adicionar relacionamento entre artigos
 *     tags: [Artigos]
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
 *             required:
 *               - relatedArticleId
 *               - relationshipType
 *             properties:
 *               relatedArticleId:
 *                 type: string
 *                 description: ID do artigo relacionado
 *               relationshipType:
 *                 type: string
 *                 description: Tipo de relacionamento
 *               description:
 *                 type: string
 *                 description: Descrição do relacionamento
 *     responses:
 *       201:
 *         description: Relacionamento adicionado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Relacionamento adicionado com sucesso
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
 *       404:
 *         description: Artigo não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/projetos/{projectId}/artigos/{id}/relacionamentos/{relatedId}:
 *   delete:
 *     summary: Remover relacionamento entre artigos
 *     tags: [Artigos]
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
 *       - in: path
 *         name: relatedId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do relacionamento
 *     responses:
 *       200:
 *         description: Relacionamento removido com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Relacionamento removido com sucesso
 *       401:
 *         description: Token inválido ou expirado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Relacionamento não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // Limite de 10MB
  },
  fileFilter: (req, file, cb) => {
    // Se há arquivo, deve ser PDF
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Apenas arquivos PDF são permitidos"), false);
    }
  },
});

// Upload opcional para criação de artigos (PDF não obrigatório)
const uploadOptional = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // Limite de 10MB
  },
  fileFilter: (req, file, cb) => {
    // Se há arquivo, deve ser PDF
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Apenas arquivos PDF são permitidos"), false);
    }
  },
});

const router = express.Router({ mergeParams: true }); // mergeParams para acessar projectId

// Rota de PDF sem autenticação (visualização inline)
router.get("/:id/pdf", getArticlePdf); // GET /api/projetos/:projetoId/artigos/:id/pdf

// Rota de download de PDF sem autenticação (força download)
router.get("/:id/download", getArticlePdfDownload); // GET /api/projetos/:projetoId/artigos/:id/download

// Todas as outras rotas de artigos exigem autenticação
router.use(authenticateToken);

// Rotas CRUD de artigos
router.get("/", getArticlesByProject); // GET /api/projetos/:projetoId/artigos
router.get("/:id", getArticleById); // GET /api/projetos/:projetoId/artigos/:id
router.post("/", uploadOptional.any(), createArticle); // POST /api/projetos/:projetoId/artigos
router.put("/:id", upload.single("pdf"), updateArticle); // PUT /api/projetos/:projetoId/artigos/:id
router.patch("/:id/status", updateArticleStatus); // PATCH /api/projetos/:projetoId/artigos/:id/status
router.patch("/:id/notes", updateArticleNotes); // PATCH /api/projetos/:projetoId/artigos/:id/notes
router.delete("/:id", deleteArticle); // DELETE /api/projetos/:projetoId/artigos/:id

// Rotas de relacionamentos
router.get("/:id/relacionamentos", getArticleRelationships); // GET /api/projetos/:projectId/artigos/:id/relacionamentos
router.post("/:id/relacionamentos", addArticleRelationship); // POST /api/projetos/:projectId/artigos/:id/relacionamentos
router.delete("/:id/relacionamentos/:relatedId", removeArticleRelationship); // DELETE /api/projetos/:projectId/artigos/:id/relacionamentos/:relatedId

export default router;
