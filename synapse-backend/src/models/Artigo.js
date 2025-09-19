import mongoose from "mongoose";

const articleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Título é obrigatório"],
      trim: true,
      maxLength: [200, "Título não pode ter mais que 200 caracteres"],
    },
    authors: {
      type: String,
      required: [true, "Autores são obrigatórios"],
      trim: true,
      maxLength: [300, "Autores não podem ter mais que 300 caracteres"],
    },
    notas: {
      type: String,
      trim: true,
      default: "",
    },
    year: {
      type: Number,
      required: [true, "Ano é obrigatório"],
      min: [1900, "Ano deve ser maior que 1900"],
      max: [new Date().getFullYear() + 1, "Ano não pode ser no futuro"],
    },
    journal: {
      type: String,
      required: [true, "Periódico/Conferência é obrigatório"],
      trim: true,
      maxLength: [200, "Periódico não pode ter mais que 200 caracteres"],
    },
    doi: {
      type: String,
      trim: true,
      maxLength: [50, "DOI não pode ter mais que 50 caracteres"],
    },
    abstract: {
      type: String,
      trim: true,
      maxLength: [3000, "Resumo não pode ter mais que 3000 caracteres"],
    },
    keywords: {
      type: String,
      trim: true,
      maxLength: [500, "Palavras-chave não podem ter mais que 500 caracteres"],
    },
    pages: {
      type: String,
      trim: true,
      maxLength: [20, "Páginas não podem ter mais que 20 caracteres"],
    },
    volume: {
      type: String,
      trim: true,
      maxLength: [20, "Volume não pode ter mais que 20 caracteres"],
    },
    number: {
      type: String,
      trim: true,
      maxLength: [20, "Número não pode ter mais que 20 caracteres"],
    },
    issn: {
      type: String,
      trim: true,
      maxLength: [20, "ISSN não pode ter mais que 20 caracteres"],
    },
    status: {
      type: String,
      enum: ["pendente", "analisado", "excluido"],
      default: "pendente",
    },
    pdfFile: {
      type: String,
      default: "",
    },
    pdfData: {
      type: Buffer,
      default: null,
    },
    pdfContentType: {
      type: String,
      default: "application/pdf",
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: [true, "ID do projeto é obrigatório"],
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Proprietário é obrigatório"],
    },
    relatedArticles: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Article",
      },
    ],
  },
  {
    timestamps: true,
  }
);

articleSchema.index({ title: "text", authors: "text", abstract: "text" });
articleSchema.index({ projectId: 1, status: 1 });
articleSchema.index({ owner: 1, projectId: 1 });
articleSchema.index({ owner: 1, status: 1 });
articleSchema.index({ year: 1 });

const Article = mongoose.model("Article", articleSchema);

export default Article;
