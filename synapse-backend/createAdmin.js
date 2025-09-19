import mongoose from "mongoose";
import User from "./src/models/User.js";
import dotenv from "dotenv";

dotenv.config();

const createAdminUser = async () => {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/synapse"
    );
    console.log("✅ Conectado ao MongoDB");

    const existingAdmin = await User.findOne({ email: "admin@exemplo.com" });

    if (existingAdmin) {
      console.log("❌ Usuário admin já existe:", existingAdmin.email);
      return;
    }

    // Criar usuário admin
    const admin = new User({
      name: "Administrador",
      email: "admin@exemplo.com",
      password: "123456",
      role: "admin",
    });

    await admin.save();
    console.log("✅ Usuário admin criado com sucesso!");
    console.log("📧 Email:", admin.email);
    console.log("🔑 Senha: 123456");
    console.log("👤 Role:", admin.role);
  } catch (error) {
    console.error("❌ Erro ao criar usuário admin:", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Desconectado do MongoDB");
  }
};

createAdminUser();
