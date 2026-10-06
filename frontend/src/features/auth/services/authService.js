import { apiService } from "@/services/api";

class AuthService {
  async loginWithGoogle(credential) {
    return apiService.post("/api/auth/google", { credential });
  }

  async restoreSession() {
    return apiService.get("/api/auth/profile");
  }

  async updateProfile(userData) {
    return apiService.put("/api/auth/profile", userData);
  }

  async logout() {
    return apiService.post("/api/auth/logout", {});
  }
}

export const authService = new AuthService();
