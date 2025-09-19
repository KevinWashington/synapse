import express from "express";
import {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
} from "../controllers/ProjetosController.js";

import { getProjectGraph } from "../controllers/ArtigosController.js";
import { authenticateToken } from "../middleware/auth.js";

// Importar as rotas de artigos
import artigosRoutes from "./artigos.js";

const router = express.Router();

// Rotas CRUD de projetos (exigem autenticação)
router.get("/", authenticateToken, getAllProjects); // GET /api/projetos
router.get("/:id", authenticateToken, getProjectById); // GET /api/projetos/:id
router.post("/", authenticateToken, createProject); // POST /api/projetos
router.put("/:id", authenticateToken, updateProject); // PUT /api/projetos/:id
router.delete("/:id", authenticateToken, deleteProject); // DELETE /api/projetos/:id

// Rota para obter grafo de relacionamentos (exige autenticação)
router.get("/:id/grafo", authenticateToken, getProjectGraph); // GET /api/projetos/:id/grafo

// Rotas de artigos (algumas com autenticação, outras sem)
router.use("/:projectId/artigos", artigosRoutes);

export default router;
