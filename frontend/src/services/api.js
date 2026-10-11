const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const SESSION_COOKIE_NAME = import.meta.env.VITE_SESSION_COOKIE_NAME || "synapse_session";

/** @param {any} errorData @param {number} status @returns {import("../types/api").ApiErrorData} */
function normalizeErrorData(errorData, status) {
  const raw = errorData?.detail ?? errorData;
  const fallbackCode = `HTTP_${status}`;
  const fallbackMessage = "Erro na requisição";

  if (Array.isArray(raw)) {
    return {
      code: status === 422 ? "VALIDATION_ERROR" : fallbackCode,
      message: status === 422 ? "Confira os campos informados." : fallbackMessage,
      context: { fields: raw },
    };
  }

  if (typeof raw === "string") {
    const isStableCode = /^[A-Z][A-Z0-9_]*$/.test(raw);
    return {
      code: isStableCode ? raw : fallbackCode,
      message: isStableCode ? fallbackMessage : raw,
    };
  }

  const detail = raw && typeof raw === "object" ? raw : {};
  const rootExtras = errorData && typeof errorData === "object" && !Array.isArray(errorData)
    ? Object.fromEntries(Object.entries(errorData).filter(([key]) => key !== "detail"))
    : {};
  const normalized = {
    ...rootExtras,
    ...detail,
    code: detail.code || detail.errorCode || fallbackCode,
    message: detail.message || detail.error || fallbackMessage,
  };
  if (detail.context && typeof detail.context === "object") {
    normalized.context = detail.context;
  } else if (Array.isArray(detail.fields)) {
    normalized.context = { fields: detail.fields };
  }
  return normalized;
}

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  /** @param {import("../types/api").ApiRequestOptions} options */
  buildRequestConfig(options = {}) {
    const { ...fetchOptions } = options;

    /** @type {any} */
    const config = {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...fetchOptions.headers,
      },
      ...fetchOptions,
    };

    const method = (config.method || "GET").toUpperCase();
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      const csrfToken = document.cookie
        .split("; ")
        .find((cookie) => cookie.startsWith(`${SESSION_COOKIE_NAME}_csrf=`))
        ?.split("=")
        .slice(1)
        .join("=");
      if (csrfToken && !config.headers["X-CSRF-Token"]) {
        config.headers["X-CSRF-Token"] = decodeURIComponent(csrfToken);
      }
    }

    if (config.body && !(config.body instanceof FormData)) {
      config.body = JSON.stringify(config.body);
    }

    if (config.body instanceof FormData && config.headers["Content-Type"]) {
      delete config.headers["Content-Type"];
    }

    return config;
  }

  /** @param {string} endpoint @param {import("../types/api").ApiRequestOptions} options */
  async requestRaw(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const {
      skipErrorLog = false,
      suppressErrorStatuses = [],
      ...fetchOptions
    } = options;
    const config = this.buildRequestConfig(fetchOptions);

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        const data = normalizeErrorData(errorData, response.status);
        if (data.code === "DEEPSEEK_KEY_REQUIRED") {
          window.dispatchEvent(new CustomEvent("synapse:deepseek-key-required"));
        }
        throw new ApiError(
          data.message,
          response.status,
          data
        );
      }

      return response;
    } catch (error) {
      const shouldSuppressLog =
        skipErrorLog ||
        (error instanceof ApiError &&
          suppressErrorStatuses.includes(error.status));

      if (!shouldSuppressLog) {
        console.error(`ApiRequest Error [${config.method || "GET"}] ${url}:`, error);
      }

      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError("Erro de conexao com o servidor", 0, {
        code: "NETWORK_ERROR",
        message: "Erro de conexao com o servidor",
        originalError: error.message,
      });
    }
  }

  /** @param {string} endpoint @param {import("../types/api").ApiRequestOptions} options */
  async request(endpoint, options = {}) {
    const response = await this.requestRaw(endpoint, options);

    if (response.status === 204) {
      return null;
    }

    const contentType = response.headers.get("content-type");

    if (
      contentType &&
      (contentType.includes("application/pdf") ||
        contentType.includes("image/") ||
        contentType.includes("application/octet-stream"))
    ) {
      return response;
    }

    if (!contentType || !contentType.includes("application/json")) {
      return null;
    }

    const body = await response.text();
    return body ? JSON.parse(body) : null;
  }

  async get(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;

    return this.request(url, {
      method: "GET",
    });
  }

  async post(endpoint, data) {
    return this.request(endpoint, {
      method: "POST",
      body: data,
    });
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

class ApiError extends Error {
  /** @param {string} message @param {number} status @param {Partial<import("../types/api").ApiErrorData>} data */
  constructor(message, status, data = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
    this.code = data?.code;
  }
}

const apiService = new ApiService();

export { apiService, ApiError };
