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
