import { createContext, useState, useEffect } from "react";
import { authService } from "../services/authService.js";

const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem("token");
        const storedUser = localStorage.getItem("user");

        if (token && storedUser) {
          const isValid = await authService.validateToken();

          if (isValid) {
            setUser(JSON.parse(storedUser));
          } else {
            localStorage.removeItem("user");
            localStorage.removeItem("token");
          }
        }
      } catch (error) {
        console.error("Erro ao verificar autenticação:", error);
        localStorage.removeItem("user");
        localStorage.removeItem("token");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (credentials) => {
    setLoading(true);
    setError(null);

    try {
      const response = await authService.login(credentials);

      if (response.success) {
        const userData = {
          id: response.user._id,
          name: response.user.name,
          email: response.user.email,
          role: response.user.role,
          avatar: response.user.avatar,
          lastLogin: response.user.lastLogin,
          stats: {
            totalProjects: 0,
            totalArticles: 0,
            totalArticlesReviewed: 0,
            textsReviewedToday: 0,
            textsToReview: 0,
            lastProjectCreated: 0,
          },
        };

        localStorage.setItem("user", JSON.stringify(userData));
        localStorage.setItem("token", response.token);

        setUser(userData);
        return { success: true };
      } else {
        setError(response.message || "Erro ao fazer login");
        return { success: false, error: response.message };
      }
    } catch (error) {
      const errorMessage =
        error.data?.message || error.message || "Erro interno do servidor";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData) => {
    setLoading(true);
    setError(null);

    try {
      const response = await authService.register(userData);

      if (response.success) {
        const newUserData = {
          id: response.user._id,
          name: response.user.name,
          email: response.user.email,
          role: response.user.role,
          avatar: response.user.avatar,
          stats: {
            totalProjects: 0,
            totalArticles: 0,
            totalArticlesReviewed: 0,
            textsReviewedToday: 0,
            textsToReview: 0,
            lastProjectCreated: 0,
          },
        };

        localStorage.setItem("user", JSON.stringify(newUserData));
        localStorage.setItem("token", response.token);

        setUser(newUserData);
        return { success: true };
      } else {
        setError(response.message || "Erro ao criar conta");
        return { success: false, error: response.message };
      }
    } catch (error) {
      const errorMessage =
        error.data?.message || error.message || "Erro interno do servidor";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error("Erro no logout:", error);
    } finally {
      setUser(null);
      localStorage.removeItem("user");
      localStorage.removeItem("token");
    }
  };

  const isAuthenticated = () => {
    return !!user;
  };

  const getToken = () => {
    return localStorage.getItem("token");
  };

  const updateUser = async (userData) => {
    try {
      const response = await authService.updateProfile(userData);

      if (response.success) {
        const updatedUser = { ...user, ...response.user };
        setUser(updatedUser);
        localStorage.setItem("user", JSON.stringify(updatedUser));
        return { success: true };
      } else {
        setError(response.message || "Erro ao atualizar perfil");
        return { success: false, error: response.message };
      }
    } catch (error) {
      const errorMessage =
        error.data?.message || error.message || "Erro ao atualizar perfil";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const changePassword = async (passwordData) => {
    try {
      const response = await authService.changePassword(passwordData);

      if (response.success) {
        return { success: true };
      } else {
        setError(response.message || "Erro ao alterar senha");
        return { success: false, error: response.message };
      }
    } catch (error) {
      const errorMessage =
        error.data?.message || error.message || "Erro ao alterar senha";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const value = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    isAuthenticated,
    getToken,
    updateUser,
    changePassword,
    setError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
export { AuthContext };
