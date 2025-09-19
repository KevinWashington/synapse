import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Título é obrigatório"],
      trim: true,
      maxLength: [100, "Título não pode ter mais que 100 caracteres"],
    },
    objetivo: {
      type: String,
      required: [true, "Objetivo é obrigatório"],
      trim: true,
      maxLength: [1000, "Objetivo não pode ter mais que 1000 caracteres"],
    },
    status: {
      type: String,
      enum: ["ideia", "em-progresso", "concluido", "pausado"],
      default: "ideia",
      lowercase: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Proprietário é obrigatório"],
    },
    // Campos PICOC para revisão sistemática
    picoc: {
      pessoa: {
        type: String,
        trim: true,
        maxLength: [500, "Campo Pessoa não pode ter mais que 500 caracteres"],
      },
      intervencao: {
        type: String,
        trim: true,
        maxLength: [
          500,
          "Campo Intervenção não pode ter mais que 500 caracteres",
        ],
      },
      comparacao: {
        type: String,
        trim: true,
        maxLength: [
          500,
          "Campo Comparação não pode ter mais que 500 caracteres",
        ],
      },
      outcome: {
        type: String,
        trim: true,
        maxLength: [500, "Campo Outcome não pode ter mais que 500 caracteres"],
      },
      contexto: {
        type: String,
        trim: true,
        maxLength: [500, "Campo Contexto não pode ter mais que 500 caracteres"],
      },
    },
    // Perguntas de pesquisa
    researchQuestions: [
      {
        type: String,
        trim: true,
        maxLength: [
          1000,
          "Pergunta de pesquisa não pode ter mais que 1000 caracteres",
        ],
      },
    ],
    // Palavras-chave
    keywords: [
      {
        type: String,
        trim: true,
        maxLength: [100, "Palavra-chave não pode ter mais que 100 caracteres"],
      },
    ],
    // Strings de busca
    searchStrings: [
      {
        type: String,
        trim: true,
        maxLength: [
          2000,
          "String de busca não pode ter mais que 2000 caracteres",
        ],
      },
    ],
    // Critérios de inclusão
    criteriosInclusao: [
      {
        type: String,
        trim: true,
        maxLength: [
          1000,
          "Critério de inclusão não pode ter mais que 1000 caracteres",
        ],
      },
    ],
    // Critérios de exclusão
    criteriosExclusao: [
      {
        type: String,
        trim: true,
        maxLength: [
          1000,
          "Critério de exclusão não pode ter mais que 1000 caracteres",
        ],
      },
    ],
  },
  {
    timestamps: true,
  }
);

projectSchema.index({
  title: "text",
  objetivo: "text",
  "picoc.pessoa": "text",
  "picoc.intervencao": "text",
  "picoc.comparacao": "text",
  "picoc.outcome": "text",
  "picoc.contexto": "text",
  keywords: "text",
  searchStrings: "text",
});
projectSchema.index({ owner: 1, status: 1 });
projectSchema.index({ owner: 1, createdAt: -1 });

const Project = mongoose.model("Project", projectSchema);

export default Project;
