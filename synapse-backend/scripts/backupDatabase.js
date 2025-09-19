import mongoose from "mongoose";
import fs from "fs";
import path from "path";
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

// Função para criar backup do banco de dados
async function createBackup() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupDir = path.join(process.cwd(), "backups");

    // Criar diretório de backup se não existir
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const backupFile = path.join(backupDir, `synapse-backup-${timestamp}.json`);

    console.log("💾 Criando backup do banco de dados...");

    const collections = await mongoose.connection.db
      .listCollections()
      .toArray();
    const backupData = {};

    for (const collection of collections) {
      const collectionName = collection.name;
      const documents = await mongoose.connection.db
        .collection(collectionName)
        .find({})
        .toArray();
      backupData[collectionName] = documents;
      console.log(
        `📁 Backup da coleção '${collectionName}': ${documents.length} documentos`
      );
    }

    // Salvar backup em arquivo JSON
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));

    console.log(`✅ Backup criado com sucesso: ${backupFile}`);
    console.log(`📊 Total de coleções: ${collections.length}`);

    return backupFile;
  } catch (error) {
    console.error("❌ Erro ao criar backup:", error.message);
    throw error;
  }
}

// Função para restaurar backup
async function restoreBackup(backupFile) {
  try {
    if (!fs.existsSync(backupFile)) {
      throw new Error(`Arquivo de backup não encontrado: ${backupFile}`);
    }

    console.log(`🔄 Restaurando backup de: ${backupFile}`);

    const backupData = JSON.parse(fs.readFileSync(backupFile, "utf8"));

    // Limpar dados existentes
    const collections = await mongoose.connection.db
      .listCollections()
      .toArray();
    for (const collection of collections) {
      await mongoose.connection.db.collection(collection.name).deleteMany({});
    }

    // Restaurar dados do backup
    for (const [collectionName, documents] of Object.entries(backupData)) {
      if (documents.length > 0) {
        await mongoose.connection.db
          .collection(collectionName)
          .insertMany(documents);
        console.log(
          `📁 Restaurada coleção '${collectionName}': ${documents.length} documentos`
        );
      }
    }

    console.log("✅ Backup restaurado com sucesso!");
  } catch (error) {
    console.error("❌ Erro ao restaurar backup:", error.message);
    throw error;
  }
}

// Função principal
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const backupFile = args[1];

  await connectToDatabase();

  switch (command) {
    case "create":
      await createBackup();
      break;
    case "restore":
      if (!backupFile) {
        console.error(
          "❌ Por favor, especifique o arquivo de backup para restaurar"
        );
        console.log("Uso: node backupDatabase.js restore <caminho-do-arquivo>");
        process.exit(1);
      }
      await restoreBackup(backupFile);
      break;
    default:
      console.log(`
💾 Script de Backup e Restauração do Banco de Dados Synapse

Uso: node backupDatabase.js [comando] [arquivo]

Comandos disponíveis:
  create                    - Cria um backup completo do banco de dados
  restore <arquivo>         - Restaura o banco a partir de um arquivo de backup

Exemplos:
  node backupDatabase.js create
  node backupDatabase.js restore ./backups/synapse-backup-2024-01-15T10-30-00-000Z.json

📁 Os backups são salvos na pasta 'backups/' com timestamp
⚠️  ATENÇÃO: Restaurar um backup substitui TODOS os dados atuais!
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

export { createBackup, restoreBackup };
