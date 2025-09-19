const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  getAuthToken() {
    return localStorage.getItem("token");
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;

    const config = {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    };

    const token = this.getAuthToken();
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (config.body && !(config.body instanceof FormData)) {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
        }

        throw new ApiError(
          errorData.error || "Erro na requisição",
          response.status,
          errorData
        );
      }

      const contentType = response.headers.get("content-type");

      // Se for PDF ou outro tipo binário, retornar a resposta diretamente
      if (
        contentType &&
        (contentType.includes("application/pdf") ||
          contentType.includes("image/") ||
          contentType.includes("application/octet-stream"))
      ) {
        return response;
      }

      // Se não for JSON, retornar null
      if (!contentType || !contentType.includes("application/json")) {
        return null;
      }

      return await response.json();
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError("Erro de conexão com o servidor", 0, {
        originalError: error.message,
      });
    }
  }

  async get(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;

    return this.request(url, {
      method: "GET",
    });
  }

  async post(endpoint, data) {
    // Adicionar configurações de IA se disponíveis
    const aiConfig = this.getAIConfig();
    const requestData = aiConfig ? { ...data, aiConfig } : data;

    return this.request(endpoint, {
      method: "POST",
      body: requestData,
    });
  }

  getAIConfig() {
    try {
      const aiProvider = localStorage.getItem("aiProvider");
      const ollamaConfig = localStorage.getItem("ollamaConfig");
      const geminiConfig = localStorage.getItem("geminiConfig");

      if (!aiProvider) return null;

      return {
        provider: aiProvider,
        ollama: ollamaConfig ? JSON.parse(ollamaConfig) : null,
        gemini: geminiConfig ? JSON.parse(geminiConfig) : null,
      };
    } catch (error) {
      console.error("Erro ao obter configurações de IA:", error);
      return null;
    }
  }

  async postFormData(endpoint, formData) {
    return this.request(endpoint, {
      method: "POST",
      headers: {},
      body: formData,
    });
  }

  async put(endpoint, data) {
    return this.request(endpoint, {
      method: "PUT",
      body: data,
    });
  }

  async putFormData(endpoint, formData) {
    return this.request(endpoint, {
      method: "PUT",
      headers: {},
      body: formData,
    });
  }

  async patch(endpoint, data) {
    return this.request(endpoint, {
      method: "PATCH",
      body: data,
    });
  }

  async delete(endpoint) {
    return this.request(endpoint, {
      method: "DELETE",
    });
  }
}

// Classe de erro personalizada
class ApiError extends Error {
  constructor(message, status, data = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

const apiService = new ApiService();

export { apiService, ApiError };
