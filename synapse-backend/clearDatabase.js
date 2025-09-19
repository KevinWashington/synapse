import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/synapse";

// Conectar ao MongoDB
async function connectToDatabase() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Conectado ao MongoDB");
  } catch (error) {
    console.error("❌ Erro ao conectar no MongoDB:", error.message);
    process.exit(1);
  }
}

// Função para limpar completamente o banco de dados
async function clearAllData() {
  try {
    console.log("🧹 Iniciando limpeza completa do banco de dados...");

    // Limpar todas as coleções
    const collections = await mongoose.connection.db
      .listCollections()
      .toArray();

    for (const collection of collections) {
      const collectionName = collection.name;
      const result = await mongoose.connection.db
        .collection(collectionName)
        .deleteMany({});
      console.log(
        `🗑️  Coleção '${collectionName}': ${result.deletedCount} documentos removidos`
      );
    }

    console.log("✅ Limpeza completa concluída!");
  } catch (error) {
    console.error("❌ Erro durante a limpeza:", error.message);
  }
}

// Função para limpar apenas uma coleção específica
async function clearCollection(collectionName) {
  try {
    console.log(`🧹 Limpando coleção '${collectionName}'...`);

    const result = await mongoose.connection.db
      .collection(collectionName)
      .deleteMany({});
    console.log(
      `🗑️  Coleção '${collectionName}': ${result.deletedCount} documentos removidos`
    );

    console.log(`✅ Limpeza da coleção '${collectionName}' concluída!`);
  } catch (error) {
    console.error(
      `❌ Erro ao limpar coleção '${collectionName}':`,
      error.message
    );
  }
}

// Função para mostrar estatísticas do banco
async function showDatabaseStats() {
  try {
    console.log("\n📊 Estatísticas do banco de dados:");
    console.log("=".repeat(50));

    const collections = await mongoose.connection.db
      .listCollections()
      .toArray();

    for (const collection of collections) {
      const count = await mongoose.connection.db
        .collection(collection.name)
        .countDocuments();
      console.log(`📁 ${collection.name}: ${count} documentos`);
    }

    console.log("=".repeat(50));
  } catch (error) {
    console.error("❌ Erro ao obter estatísticas:", error.message);
  }
}

// Função principal
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  await connectToDatabase();

  switch (command) {
    case "all":
      await clearAllData();
      break;
    case "users":
      await clearCollection("users");
      break;
    case "projects":
      await clearCollection("projects");
      break;
    case "articles":
      await clearCollection("articles");
      break;
    case "stats":
      await showDatabaseStats();
      break;
    default:
      console.log(`
🧹 Script de Limpeza do Banco de Dados Synapse

Uso: node clearDatabase.js [comando]

Comandos disponíveis:
  all      - Remove TODOS os dados do banco (usuários, projetos e artigos)
  users    - Remove apenas os usuários
  projects - Remove apenas os projetos
  articles - Remove apenas os artigos
  stats    - Mostra estatísticas do banco de dados

Exemplos:
  node clearDatabase.js all      # Limpa tudo
  node clearDatabase.js users    # Remove apenas usuários
  node clearDatabase.js stats    # Mostra quantos documentos existem

⚠️  ATENÇÃO: Esta operação é IRREVERSÍVEL!
   Certifique-se de fazer backup antes de executar.
      `);
      break;
  }

  await mongoose.connection.close();
  console.log("🔌 Conexão com MongoDB fechada");
}

// Executar apenas se este arquivo for chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { clearAllData, clearCollection, showDatabaseStats };
