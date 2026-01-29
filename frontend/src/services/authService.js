import { apiService } from "./api.js";

class AuthService {
  async login(credentials) {
    const response = await apiService.post("/api/auth/login", credentials);
    return response;
  }

  async register(userData) {
    const response = await apiService.post("/api/auth/register", userData);
    return response;
  }

  async getProfile() {
    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("Token não encontrado");
    }

    const response = await apiService.get("/api/auth/profile");
    return response;
  }

  async updateProfile(userData) {
    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("Token não encontrado");
    }

    const response = await apiService.put("/api/auth/profile", userData);
    return response;
  }

  async changePassword(passwordData) {
    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("Token não encontrado");
    }

    const response = await apiService.put(
      "/api/auth/change-password",
      passwordData
    );
    return response;
  }

  async logout() {
    try {
      const token = localStorage.getItem("token");
      if (token) {
        await apiService.post("/api/auth/logout", {});
      }
    } catch (error) {
      console.error("Erro no logout:", error);
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
  }

  async validateToken() {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        return false;
      }

      await this.getProfile();
      return true;
    } catch {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      return false;
    }
  }
}

export const authService = new AuthService();
